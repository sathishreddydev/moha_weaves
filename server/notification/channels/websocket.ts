import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import * as jwt from 'jsonwebtoken';
import { users } from '@shared/schema';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import { 
  WebSocketMessage, 
  NotificationChannel,
  NotificationError,
  ChannelNotAvailableError
} from '../types';
import { Socket } from 'socket.io';

export interface WebSocketConfig {
  enabled: boolean;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  transports: string[];
  pingTimeout: number;
  pingInterval: number;
}

export interface AuthenticatedSocket {
  id: string;
  userId: string;
  userRole: string;
  storeId?: string;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data: any) => void;
  to: (room: string) => any;
  broadcast: {
    emit: (event: string, data: any) => void;
  };
  disconnect: () => void;
  on: (event: string, callback: (data: any) => void) => void;
}

export class WebSocketChannel {
  private io: SocketIOServer | null = null;
  private config: WebSocketConfig;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private userSockets: Map<string, AuthenticatedSocket> = new Map(); // socketId -> socket
  private storeConnections: Map<string, Set<string>> = new Map(); // storeId -> socketIds

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    if (!this.config.enabled) {
      console.log('🔌 WebSocket channel is disabled');
      return;
    }

    try {
      this.io = new SocketIOServer(httpServer, {
        cors: this.config.cors,
        transports: this.config.transports as any,
        pingTimeout: this.config.pingTimeout,
        pingInterval: this.config.pingInterval
      });

      this.setupMiddleware();
      this.setupEventHandlers();
      
      console.log('🔌 WebSocket server initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error);
      throw new ChannelNotAvailableError(NotificationChannel.WEBSOCKET);
    }
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware(): void {
    if (!this.io) return;

    this.io.use(async (socket: any, next: any) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        
        // Get user from database
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, decoded.userId))
          .limit(1);

        if (!user || !user.isActive) {
          return next(new Error('Invalid user or user not active'));
        }

        // Attach user info to socket
        socket.userId = user.id;
        socket.userRole = user.role;
        socket.storeId = user.storeId || undefined;

        console.log(`🔌 User ${user.email} (${user.role}) connected via WebSocket`);
        next();

      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup main event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    // Track user connection
    if (!this.connectedUsers.has(socket.userId)) {
      this.connectedUsers.set(socket.userId, new Set());
    }
    this.connectedUsers.get(socket.userId)!.add(socket.id);
    this.userSockets.set(socket.id, socket);

    // Track store connection if user has store
    if (socket.storeId) {
      if (!this.storeConnections.has(socket.storeId)) {
        this.storeConnections.set(socket.storeId, new Set());
      }
      this.storeConnections.get(socket.storeId)!.add(socket.id);
    }

    // Join user-specific rooms
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
    
    if (socket.storeId) {
      socket.join(`store:${socket.storeId}`);
    }

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to real-time notification system',
      userId: socket.userId,
      timestamp: new Date().toISOString()
    });

    // Setup socket-specific event listeners
    this.setupSocketListeners(socket);

    console.log(`🔌 Socket connected: ${socket.id} for user ${socket.userId}`);
  }

  /**
   * Setup event listeners for individual socket
   */
  private setupSocketListeners(socket: AuthenticatedSocket): void {
    // Handle subscription to specific channels
    socket.on('subscribe', (data: { channels: string[], products?: string[] }) => {
      this.handleSubscription(socket, data);
    });

    // Handle unsubscription
    socket.on('unsubscribe', (data: { channels: string[] }) => {
      this.handleUnsubscription(socket, data);
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { productId: string }) => {
      socket.to(`product:${data.productId}`).emit('user_typing', {
        userId: socket.userId,
        productId: data.productId,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('typing_stop', (data: { productId: string }) => {
      socket.to(`product:${data.productId}`).emit('user_stop_typing', {
        userId: socket.userId,
        productId: data.productId
      });
    });

    // Handle presence updates
    socket.on('presence_update', (data: { status: 'online' | 'away' | 'busy' }) => {
      socket.broadcast.emit('user_presence', {
        userId: socket.userId,
        status: data.status,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  }

  /**
   * Handle channel subscription
   */
  private handleSubscription(socket: AuthenticatedSocket, data: { channels: string[], products?: string[] }): void {
    const { channels, products } = data;

    channels.forEach(channel => {
      // Validate subscription permissions
      if (this.canSubscribeToChannel(socket.userRole, channel)) {
        socket.join(channel);
        
        if (products) {
          products.forEach(productId => {
            socket.join(`${channel}:${productId}`);
          });
        }
      }
    });

    socket.emit('subscribed', { channels, products });
    console.log(`🔌 User ${socket.userId} subscribed to channels: ${channels.join(', ')}`);
  }

  /**
   * Handle channel unsubscription
   */
  private handleUnsubscription(socket: AuthenticatedSocket, data: { channels: string[] }): void {
    data.channels.forEach(channel => {
      socket.leave(channel);
    });

    socket.emit('unsubscribed', { channels: data.channels });
    console.log(`🔌 User ${socket.userId} unsubscribed from channels: ${data.channels.join(', ')}`);
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    // Remove from user connections
    const userSockets = this.connectedUsers.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(socket.userId);
      }
    }

    // Remove from store connections
    if (socket.storeId) {
      const storeSockets = this.storeConnections.get(socket.storeId);
      if (storeSockets) {
        storeSockets.delete(socket.id);
        if (storeSockets.size === 0) {
          this.storeConnections.delete(socket.storeId);
        }
      }
    }

    // Remove from user sockets map
    this.userSockets.delete(socket.id);

    // Broadcast presence update
    socket.broadcast.emit('user_presence', {
      userId: socket.userId,
      status: 'offline',
      timestamp: new Date().toISOString()
    });

    console.log(`🔌 Socket disconnected: ${socket.id} for user ${socket.userId}. Reason: ${reason}`);
  }

  /**
   * Send message through WebSocket
   */
  async send(data: any): Promise<void> {
    if (!this.io) {
      throw new ChannelNotAvailableError(NotificationChannel.WEBSOCKET);
    }

    try {
      const { recipients, message } = data;

      // Send to specific recipients
      for (const recipient of recipients) {
        switch (recipient.type) {
          case 'user':
            this.io.to(`user:${recipient.id}`).emit('notification', message);
            break;
          case 'role':
            this.io.to(`role:${recipient.id}`).emit('notification', message);
            break;
          case 'store':
            this.io.to(`store:${recipient.id}`).emit('notification', message);
            break;
          case 'all':
            this.io.emit('notification', message);
            break;
        }
      }

      console.log(`🔌 WebSocket notification sent to ${recipients.length} recipients`);

    } catch (error) {
      console.error('Error sending WebSocket notification:', error);
      throw error;
    }
  }

  /**
   * Send to specific room
   */
  sendToRoom(room: string, message: any): void {
    if (!this.io) return;
    
    this.io.to(room).emit('notification', message);
  }

  /**
   * Send to specific user
   */
  sendToUser(userId: string, message: any): void {
    if (!this.io) return;
    
    this.io.to(`user:${userId}`).emit('notification', message);
  }

  /**
   * Send to users with specific role
   */
  sendToRole(role: string, message: any): void {
    if (!this.io) return;
    
    this.io.to(`role:${role}`).emit('notification', message);
  }

  /**
   * Send to specific store
   */
  sendToStore(storeId: string, message: any): void {
    if (!this.io) return;
    
    this.io.to(`store:${storeId}`).emit('notification', message);
  }

  /**
   * Broadcast to all connected users
   */
  broadcast(message: any): void {
    if (!this.io) return;
    
    this.io.emit('notification', message);
  }

  /**
   * Check if user can subscribe to channel
   */
  private canSubscribeToChannel(role: string, channel: string): boolean {
    const permissions: Record<string, string[]> = {
      'admin': ['inventory', 'orders', 'stock_requests', 'damages', 'analytics', 'system'],
      'inventory': ['inventory', 'stock_requests', 'damages'],
      'store': ['inventory', 'stock_requests', 'orders'],
      'order': ['orders', 'inventory'],
      'user': ['orders']
    };

    return permissions[role]?.includes(channel) || false;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectedUsers: number;
    storeConnections: number;
    connectionsByRole: Record<string, number>;
  } {
    const connectionsByRole: Record<string, number> = {};
    
    this.userSockets.forEach(socket => {
      connectionsByRole[socket.userRole] = (connectionsByRole[socket.userRole] || 0) + 1;
    });

    return {
      totalConnections: this.userSockets.size,
      connectedUsers: this.connectedUsers.size,
      storeConnections: this.storeConnections.size,
      connectionsByRole
    };
  }

  /**
   * Get online users for specific role
   */
  getOnlineUsers(role?: string): string[] {
    const onlineUsers: string[] = [];
    
    this.userSockets.forEach(socket => {
      if (!role || socket.userRole === role) {
        onlineUsers.push(socket.userId);
      }
    });

    return [...new Set(onlineUsers)]; // Remove duplicates
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get user's active sockets
   */
  getUserSockets(userId: string): string[] {
    const sockets = this.connectedUsers.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    console.log('🔌 Shutting down WebSocket server...');
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}
