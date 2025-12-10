import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { authRoutes } from "./auth/authRoutes";
import { adminRoutes } from "./admin/adminRoutes";
import { cartRoutes } from "./cart/cartRoutes";
import { orderRoutes } from "./order/orderRoutes";
import { createAuthMiddleware } from "./authMiddleware";
import { addressRoutes } from "./address/addressRoutes";
import { inventoryRoutes } from "./inventory/inventoryRoutes";
import { storeRoutes } from "./store/storeRoutes";
import { userRoutes } from "./user/userRoutes";
import { publicRoutes } from "./public/publicRoutes";
import multer from "multer";
import { salesService } from "./sales&offer/salesStorage";
import { sareeService } from "./saree/sareeStorage";

const authAny = createAuthMiddleware(["user", "admin", "inventory", "store"]);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Public routes (categories, colors, fabrics, sales)
  publicRoutes(app);

  // Auth routes (public)
  authRoutes(app);
  adminRoutes(app);
  cartRoutes(app);
  orderRoutes(app);
  addressRoutes(app);
  inventoryRoutes(app);
  storeRoutes(app);
  userRoutes(app);

  // ==================== FILE UPLOAD ROUTES ====================

  // Serve uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Cloudinary upload endpoint
  app.post("/api/uploads/cloudinary", authAny, async (req, res) => {
    try {
      const multer = await import("multer");
      const cloudinary = await import("cloudinary");

      cloudinary.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const upload = multer.default({ storage: multer.default.memoryStorage() });
      const uploadMiddleware = upload.single("file");

      uploadMiddleware(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: "File upload failed" });
        }

        const file = (req as any).file;
        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const fileType = req.body.fileType || "image";
        const resourceType = fileType === "video" ? "video" : "image";

        const uploadStream = cloudinary.v2.uploader.upload_stream(
          {
            resource_type: resourceType,
            folder: `mohaweaves/${fileType}s`,
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              return res.status(500).json({ error: "Upload failed" });
            }
            res.json({ url: result!.secure_url, publicId: result!.public_id });
          }
        );

        uploadStream.end(file.buffer);
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({ error: "Failed to upload to Cloudinary" });
    }
  });

  // Cloudinary delete endpoint
  app.delete("/api/uploads/cloudinary", authAny, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const cloudinary = await import("cloudinary");

      cloudinary.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      // Extract public_id from Cloudinary URL
      // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{extension}
      const urlParts = url.split("/");
      const uploadIndex = urlParts.indexOf("upload");
      if (uploadIndex === -1) {
        return res.status(400).json({ error: "Invalid Cloudinary URL" });
      }

      const publicIdWithExt = urlParts.slice(uploadIndex + 1).join("/");
      const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf("."));

      // Determine resource type from URL
      const resourceType = url.includes("/video/") ? "video" : "image";

      await cloudinary.v2.uploader.destroy(publicId, { resource_type: resourceType });

      res.json({ success: true, message: "File deleted successfully" });
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      res.status(500).json({ error: "Failed to delete from Cloudinary" });
    }
  });

  // Get presigned upload URL (requires inventory or admin auth)
  app.post("/api/uploads/presigned-url", authAny, async (req, res) => {
    try {
      const { fileType } = req.body;
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath, uploadToken } =
        await objectStorageService.getObjectEntityUploadURL(
          fileType || "image"
        );
      res.json({ uploadURL, objectPath, uploadToken });
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Confirm upload and get normalized path
  app.post("/api/uploads/confirm", authAny, async (req, res) => {
    try {
      const { objectPath, uploadToken } = req.body;
      if (!objectPath || !uploadToken) {
        return res
          .status(400)
          .json({ error: "objectPath and uploadToken are required" });
      }

      const objectStorageService = new ObjectStorageService();

      if (!objectStorageService.verifyUploadToken(uploadToken, objectPath)) {
        return res
          .status(403)
          .json({ error: "Invalid or expired upload token" });
      }

      if (!objectStorageService.isValidObjectPath(objectPath)) {
        return res.status(400).json({ error: "Invalid object path" });
      }

      const userId = (req as any).user?.id;
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(
          objectPath
        );
        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: userId || "system",
          visibility: "public",
        });
      } catch (fileError) {
        return res.status(400).json({
          error: "Upload not found - file may not have been uploaded",
        });
      }

      res.json({ objectPath });
    } catch (error) {
      console.error("Error confirming upload:", error);
      res.status(500).json({ error: "Failed to confirm upload" });
    }
  });

  // User: Get notifications
  app.get("/api/user/notifications", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      const { unreadOnly } = req.query;
      const notifications = await storage.getNotifications(
        user.id,
        unreadOnly === "true"
      );
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // User: Get unread notification count
  app.get("/api/user/notifications/unread-count", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  // User: Mark notification as read
  app.patch("/api/user/notifications/:id/read", authAny, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // User: Mark all notifications as read
  app.post(
    "/api/user/notifications/mark-all-read",
    authAny,
    async (req, res) => {
      try {
        const user = (req as any).user;
        await storage.markAllNotificationsAsRead(user.id);
        res.json({ message: "All notifications marked as read" });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to mark notifications as read" });
      }
    }
  );

  // Get single sale with products
  app.get("/api/sales/:id", async (req, res) => {
    const sale = await salesService.getSale(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }
    res.json(sale);
  });

  // Get products for a specific sale
  app.get("/api/sales/:id/products", async (req, res) => {
    const sale = await salesService.getSale(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    let products: any[] = [];

    if (sale.offerType === "category" && sale.categoryId) {
      // Get all products in this category
      products = await sareeService.getSarees({ 
        category: sale.categoryId,
        onSale: true 
      });
    } else if (sale.offerType === "product") {
      // Get specific products in the sale
      const sareeIds = sale.products.map(p => p.sareeId).filter(Boolean);
      if (sareeIds.length > 0) {
        const allSarees = await sareeService.getSarees({ onSale: true });
        products = allSarees.filter(s => sareeIds.includes(s.id));
      }
    }

    res.json(products);
  });


  return httpServer;
}