import { orders } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { publishRealtimeEvent } from "realtime/events";
import { createAuthMiddleware } from "../authMiddleware";
import { db } from "../db";
import { orderService, VALID_ITEM_STATUSES } from "../order/orderStorage";
import { storage } from "../storage";

export const inventoryOrderRoutes = (app: Express) => {
  const authInventory = createAuthMiddleware(["inventory", "admin"]);

  // Bulk update all items on an order
  app.patch(
    "/api/inventory/orders/:id/status",
    authInventory,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const { status, note, orderItemIds } = req.body;

        if (!status) {
          return res.status(400).json({ message: "Status is required" });
        }
        if (!(VALID_ITEM_STATUSES as readonly string[]).includes(status)) {
          return res.status(400).json({
            message: `"${status}" is not a valid status. Allowed: ${VALID_ITEM_STATUSES.join(", ")}`,
          });
        }

        const order = await orderService.getBasicOrder(req.params.id, "inventory");
        if (!order) {
          return res.status(404).json({ message: "Order not found" });
        }

        const resolvedNote = note || `Status updated to ${status}`;
        const targetItemIds: string[] =
          orderItemIds && Array.isArray(orderItemIds) && orderItemIds.length > 0
            ? orderItemIds
            : order.items.map((i) => i.id);

        const updatedItems = [];
        for (const orderItemId of targetItemIds) {
          const updatedItem = await orderService.updateItemStatus(
            orderItemId,
            status,
            user.id,
            resolvedNote,
            order.userId,
          );
          if (updatedItem) updatedItems.push(updatedItem);
        }

        // Sync order-level status only if all items were updated
        if (updatedItems.length === targetItemIds.length) {
          try {
            await orderService.updateOrderStatus(req.params.id, status, user.id, resolvedNote);
          } catch (err) {
            console.warn("Failed to sync order-level status:", err);
          }
        }

        // Emit realtime event for each updated item
        for (const orderItemId of targetItemIds) {
          await publishRealtimeEvent("order_item_status_updated", {
            userId: order.userId,
            orderId: req.params.id,
            itemId: orderItemId,
            status,
          });
        }

        // Order-level notification
        const orderNotifications: Record<string, string> = {
          confirmed: "Your order has been confirmed and is being processed.",
          processing: "Your order is being prepared for shipment.",
          shipped: "Your order has been shipped! Track it for delivery updates.",
          delivered: "Your order has been delivered. Enjoy your purchase!",
          cancelled: "Your order has been cancelled.",
        };
        const orderMessage = orderNotifications[status];
        if (orderMessage) {
          await storage.createNotification({
            userId: order.userId,
            type: "order",
            title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: orderMessage,
            relatedId: order.id,
            relatedType: "order",
          });
        }

        res.json({
          message:
            targetItemIds.length === 1
              ? "Order item status updated successfully"
              : "All order items status updated successfully",
          items: updatedItems,
        });
      } catch (error) {
        console.error("Error updating order item status:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("INVALID_STATUS_TRANSITION:")) {
          return res.status(400).json({
            message: message.replace("INVALID_STATUS_TRANSITION:", "").trim(),
          });
        }
        res.status(500).json({ message: "Failed to update order item status" });
      }
    },
  );

  // Update individual item status
  app.patch(
    "/api/inventory/orders/:orderId/items/:itemId/status",
    authInventory,
    async (req, res) => {
      try {
        const user = (req as any).user;
        const { status, note } = req.body;
        const { orderId, itemId } = req.params;

        if (!status) {
          return res.status(400).json({ message: "Status is required" });
        }
        if (!(VALID_ITEM_STATUSES as readonly string[]).includes(status)) {
          return res.status(400).json({
            message: `"${status}" is not a valid status. Allowed: ${VALID_ITEM_STATUSES.join(", ")}`,
          });
        }

        const orderItem = await orderService.verifyItemBelongsToOrder(orderId, itemId);
        if (!orderItem) {
          const [orderExists] = await db
            .select({ id: orders.id })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);
          return res.status(404).json({
            message: orderExists ? "Order item not found" : "Order not found",
          });
        }

        const updatedItem = await orderService.updateItemStatus(
          itemId,
          status,
          user.id,
          note || `Status updated to ${status}`,
          orderItem.userId,
        );

        if (!updatedItem) {
          return res.status(500).json({ message: "Failed to update item status" });
        }

        res.json({ message: "Item status updated successfully", item: updatedItem });

        // Emit realtime event
        await publishRealtimeEvent("order_item_status_updated", {
          userId: orderItem.userId,
          orderId,
          itemId,
          status,
        });
      } catch (error) {
        console.error("Error updating individual item status:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("INVALID_STATUS_TRANSITION:")) {
          return res.status(400).json({
            message: message.replace("INVALID_STATUS_TRANSITION:", "").trim(),
          });
        }
        res.status(500).json({ message: "Failed to update item status" });
      }
    },
  );
};
