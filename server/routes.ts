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

const authAny = createAuthMiddleware(["user", "admin", "inventory", "store"]);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  authRoutes(app);
  adminRoutes(app);
  cartRoutes(app);
  orderRoutes(app);
  addressRoutes(app);
  inventoryRoutes(app);
  storeRoutes(app);
  userRoutes(app);
  publicRoutes(app);

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

  return httpServer;
}
