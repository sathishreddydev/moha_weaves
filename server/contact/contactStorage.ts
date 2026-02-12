import { desc, eq } from "drizzle-orm";
import { contactMessages, type ContactMessage, type InsertContactMessage } from "../../shared/schema";
import { db } from "../db";



export class ContactStorage {
  // Create a new contact message
  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    try {
      const [newMessage] = await db
        .insert(contactMessages)
        .values({
          ...message,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      return newMessage;
    } catch (error) {
      console.error("Error creating contact message:", error);
      throw new Error("Failed to create contact message");
    }
  }

  // Get all contact messages (for admin)
  async getAllContactMessages(): Promise<any[]> {
    try {
      const messages = await db
        .select()
        .from(contactMessages)
        .orderBy(desc(contactMessages.createdAt));
      
      return messages;
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      throw new Error("Failed to fetch contact messages");
    }
  }

  // Get contact message by ID
  async getContactMessageById(id: string): Promise<ContactMessage | null> {
    try {
      const [message] = await db
        .select()
        .from(contactMessages)
        .where(eq(contactMessages.id, id));
      
      return message || null;
    } catch (error) {
      console.error("Error fetching contact message:", error);
      throw new Error("Failed to fetch contact message");
    }
  }

  // Update contact message status
  async updateContactMessageStatus(id: string, status: string): Promise<ContactMessage> {
    try {
      const [updatedMessage] = await db
        .update(contactMessages)
        .set({ 
          status,
          updatedAt: new Date(),
        })
        .where(eq(contactMessages.id, id))
        .returning();
      
      return updatedMessage;
    } catch (error) {
      console.error("Error updating contact message status:", error);
      throw new Error("Failed to update contact message status");
    }
  }

  // Delete contact message
  async deleteContactMessage(id: string): Promise<void> {
    try {
      await db
        .delete(contactMessages)
        .where(eq(contactMessages.id, id));
    } catch (error) {
      console.error("Error deleting contact message:", error);
      throw new Error("Failed to delete contact message");
    }
  }

  // Get contact messages by status
  async getContactMessagesByStatus(status: string): Promise<any[]> {
    try {
      const messages = await db
        .select()
        .from(contactMessages)
        .where(eq(contactMessages.status, status))
        .orderBy(desc(contactMessages.createdAt));
      
      return messages;
    } catch (error) {
      console.error("Error fetching contact messages by status:", error);
      throw new Error("Failed to fetch contact messages by status");
    }
  }
}

export const contactStorage = new ContactStorage();
