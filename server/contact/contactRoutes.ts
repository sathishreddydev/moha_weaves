import type { Express, Request, Response } from "express";
import { insertContactMessageSchema } from "../../shared/schema";
import { contactStorage } from "./contactStorage";

export function contactRoutes(app: Express) {
  // Public route - submit contact form
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = insertContactMessageSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid form data",
          errors: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      const contactData = validationResult.data;
      
      // Create contact message
      const message = await contactStorage.createContactMessage(contactData);
      
      // In a real application, you might want to:
      // 1. Send email notification to admin
      // 2. Send confirmation email to user
      // 3. Store in analytics
      
      res.status(201).json({
        message: "Contact message submitted successfully",
        data: {
          id: message.id,
          name: message.name,
          email: message.email,
          subject: message.subject,
          createdAt: message.createdAt
        }
      });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      res.status(500).json({
        message: "Failed to submit contact form. Please try again later."
      });
    }
  });

  // Admin route - get all contact messages
  app.get("/api/admin/contact-messages", async (req: Request, res: Response) => {
    try {
      const messages = await contactStorage.getAllContactMessages();
      res.json({
        message: "Contact messages retrieved successfully",
        data: messages
      });
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({
        message: "Failed to fetch contact messages"
      });
    }
  });

  // Admin route - get contact message by ID
  app.get("/api/admin/contact-messages/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const message = await contactStorage.getContactMessageById(id);
      
      if (!message) {
        return res.status(404).json({
          message: "Contact message not found"
        });
      }
      
      res.json({
        message: "Contact message retrieved successfully",
        data: message
      });
    } catch (error) {
      console.error("Error fetching contact message:", error);
      res.status(500).json({
        message: "Failed to fetch contact message"
      });
    }
  });

  // Admin route - update contact message status
  app.patch("/api/admin/contact-messages/:id/status", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({
          message: "Status is required and must be a string"
        });
      }
      
      const updatedMessage = await contactStorage.updateContactMessageStatus(id, status);
      
      res.json({
        message: "Contact message status updated successfully",
        data: updatedMessage
      });
    } catch (error) {
      console.error("Error updating contact message status:", error);
      res.status(500).json({
        message: "Failed to update contact message status"
      });
    }
  });

  // Admin route - delete contact message
  app.delete("/api/admin/contact-messages/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await contactStorage.deleteContactMessage(id);
      
      res.json({
        message: "Contact message deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting contact message:", error);
      res.status(500).json({
        message: "Failed to delete contact message"
      });
    }
  });

  // Admin route - get contact messages by status
  app.get("/api/admin/contact-messages/status/:status", async (req: Request, res: Response) => {
    try {
      const status = req.params.status;
      const messages = await contactStorage.getContactMessagesByStatus(status);
      
      res.json({
        message: "Contact messages retrieved successfully",
        data: messages
      });
    } catch (error) {
      console.error("Error fetching contact messages by status:", error);
      res.status(500).json({
        message: "Failed to fetch contact messages by status"
      });
    }
  });
}
