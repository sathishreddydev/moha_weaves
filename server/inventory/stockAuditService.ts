import { auditLogs, stockMovements, users } from "@shared/schema";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import { db } from "../db";

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: 'product' | 'stock_request' | 'order' | 'stock_movement';
  entityId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  notes?: string;
}

export interface StockAuditFilter {
  userId?: string;
  productId?: string;
  action?: string;
  movementType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export class StockAuditService {

  /**
   * Create an audit log entry for stock operations
   */
  async createAuditLog(entry: {
    userId: string;
    action: string;
    entityType: 'product' | 'stock_request' | 'order' | 'stock_movement';
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
    notes?: string;
  }): Promise<void> {
    try {
      // Get user details for attribution
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, entry.userId))
        .limit(1);

      // This would ideally go to a dedicated audit_logs table
      // For now, we'll enhance the stock movements table with user context
      // if (entry.entityType === 'stock_movement') {
      //   await db.insert(stockMovements).values({
      //     productId: entry.entityId,
      //     quantity: entry.newValues?.quantity || 0,
      //     movementType: entry.action as any,
      //     source: "online", // Must be "store" | "online" per schema
      //     orderRefId: entry.notes?.includes('order') ? entry.notes.split('order')[1]?.trim() : "", // Use empty string for non-order movements
      //     notes: `${entry.action} by ${user?.name || user?.email || 'Unknown User'}: ${entry.notes || 'No additional notes'}`,
      //     createdAt: new Date()
      //   });
      // }

      // Use the dedicated audit_logs table for comprehensive audit tracking
      await db.insert(auditLogs).values({
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues || null,
        newValues: entry.newValues || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        notes: `${entry.action} by ${user?.name || user?.email || 'Unknown User'}: ${entry.notes || 'No additional notes'}`,
        createdAt: new Date()
      });

    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw here - audit logging failures shouldn't break the main operation
    }
  }

  /**
   * Get stock movement history with user attribution
   */
  async getStockMovementHistory(filters: StockAuditFilter = {}): Promise<{
    data: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        userId,
        productId,
        action,
        movementType,
        dateFrom,
        dateTo,
        search,
        page = 1,
        pageSize = 20
      } = filters;

      // Build conditions
      const conditions = [];

      if (productId) {
        conditions.push(eq(stockMovements.productId, productId));
      }

      if (movementType) {
        conditions.push(eq(stockMovements.movementType, movementType as any));
      }

      if (dateFrom) {
        conditions.push(sql`${stockMovements.createdAt} >= ${new Date(dateFrom)}`);
      }

      if (dateTo) {
        conditions.push(sql`${stockMovements.createdAt} <= ${new Date(dateTo)}`);
      }

      if (search) {
        conditions.push(
          sql`(${stockMovements.notes} ILIKE ${'%' + search + '%'} OR ${stockMovements.orderRefId} ILIKE ${'%' + search + '%'})`
        );
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(stockMovements)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const offset = (page - 1) * pageSize;
      const movements = await db
        .select({
          id: stockMovements.id,
          productId: stockMovements.productId,
          quantity: stockMovements.quantity,
          movementType: stockMovements.movementType,
          source: stockMovements.source,
          orderRefId: stockMovements.orderRefId,
          notes: stockMovements.notes,
          createdAt: stockMovements.createdAt,
          // Extract user info from notes (temporary solution until dedicated audit table)
          userName: sql<string>`CASE 
            WHEN ${stockMovements.notes} ~ 'by [^:]+:' 
            THEN SUBSTRING(${stockMovements.notes}, POSITION('by ' IN ${stockMovements.notes}) + 3, POSITION(':' IN ${stockMovements.notes}) - POSITION('by ' IN ${stockMovements.notes}) - 3)
            ELSE 'System'
          END`
        })
        .from(stockMovements)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(stockMovements.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Transform to audit log entries
      const auditEntries: AuditLogEntry[] = movements.map(movement => {
        // Parse user information from notes
        const userMatch = movement.notes?.match(/by ([^:]+):/);
        const userName = userMatch?.[1] || 'System';
        const cleanNotes = movement.notes?.replace(/by [^:]+:\s*/, '') || movement.notes || undefined;

        return {
          id: movement.id,
          userId: 'unknown', // Would be available in dedicated audit table
          userName,
          userEmail: undefined,
          action: movement.movementType,
          entityType: 'stock_movement',
          entityId: movement.productId,
          newValues: {
            quantity: movement.quantity,
            source: movement.source,
            orderRefId: movement.orderRefId
          },
          timestamp: movement.createdAt,
          notes: cleanNotes
        };
      });

      return {
        data: auditEntries,
        total,
        page,
        pageSize
      };

    } catch (error) {
      console.error('Error fetching stock movement history:', error);
      throw new Error('Failed to fetch audit history');
    }
  }

  /**
   * Get user-specific audit trail
   */
  async getUserAuditTrail(userId: string, options: {
    page?: number;
    pageSize?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{
    data: AuditLogEntry[];
    total: number;
  }> {
    return this.getStockMovementHistory({
      userId,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      page: options.page,
      pageSize: options.pageSize
    });
  }

  /**
   * Get product-specific audit trail
   */
  async getProductAuditTrail(productId: string, options: {
    page?: number;
    pageSize?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{
    data: AuditLogEntry[];
    total: number;
  }> {
    return this.getStockMovementHistory({
      productId,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      page: options.page,
      pageSize: options.pageSize
    });
  }

  /**
   * Generate audit report for compliance
   */
  async generateAuditReport(filters: {
    dateFrom: string;
    dateTo: string;
    userId?: string;
    productId?: string;
    movementType?: string;
  }): Promise<{
    summary: {
      totalMovements: number;
      totalQuantityChanged: number;
      uniqueUsers: number;
      uniqueProducts: number;
      movementsByType: Record<string, number>;
      movementsByUser: Array<{ userName: string; count: number; totalQuantity: number }>;
    };
    details: AuditLogEntry[];
  }> {
    const history = await this.getStockMovementHistory({
      userId: filters.userId,
      productId: filters.productId,
      movementType: filters.movementType,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      pageSize: 10000 // Large page size for reporting
    });

    const movements = history.data;

    // Calculate summary statistics
    const movementsByType: Record<string, number> = {};
    const movementsByUser: Record<string, { count: number; totalQuantity: number }> = {};
    let totalQuantityChanged = 0;

    movements.forEach(movement => {
      // Count by type
      movementsByType[movement.action] = (movementsByType[movement.action] || 0) + 1;

      // Count by user
      const userName = movement.userName || 'Unknown';
      if (!movementsByUser[userName]) {
        movementsByUser[userName] = { count: 0, totalQuantity: 0 };
      }
      movementsByUser[userName].count += 1;
      movementsByUser[userName].totalQuantity += Math.abs(movement.newValues?.quantity || 0);

      // Sum quantity changes
      totalQuantityChanged += Math.abs(movement.newValues?.quantity || 0);
    });

    const summary = {
      totalMovements: movements.length,
      totalQuantityChanged,
      uniqueUsers: new Set(movements.map(m => m.userName)).size,
      uniqueProducts: new Set(movements.map(m => m.entityId)).size,
      movementsByType,
      movementsByUser: Object.entries(movementsByUser).map(([userName, data]) => ({
        userName,
        ...data
      }))
    };

    return {
      summary,
      details: movements
    };
  }

  /**
   * Create enhanced stock movement with audit trail
   */
  async createStockMovementWithAudit(data: {
    productId: string;
    quantity: number;
    movementType: string;
    source: string;
    userId: string;
    orderRefId?: string;
    notes?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Create the stock movement
      await db.insert(stockMovements).values({
        productId: data.productId,
        quantity: data.quantity,
        movementType: data.movementType as any,
        source: data.source === "inventory" ? "online" : data.source as "store" | "online", // Ensure valid source
        orderRefId: data.orderRefId || "", // Required field - use empty string if not provided
        notes: data.notes || "",
        createdAt: new Date()
      });

      // Create audit log
      await this.createAuditLog({
        userId: data.userId,
        action: data.movementType,
        entityType: 'stock_movement',
        entityId: data.productId,
        newValues: {
          quantity: data.quantity,
          source: data.source,
          orderRefId: data.orderRefId
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        notes: data.notes
      });

    } catch (error) {
      console.error('Error creating stock movement with audit:', error);
      throw error;
    }
  }
}

export const stockAuditService = new StockAuditService();
