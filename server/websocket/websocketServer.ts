import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from 'redis';
import type { Request } from 'express';

// Redis client for pub/sub
let redisClient: ReturnType<typeof createClient>;

// Real-time event types
export interface RealtimeEvent {
  type: 'product' | 'category' | 'order' | 'inventory' | 'user' | 'store';
  action: 'create' | 'update' | 'delete' | 'stock_change';
  data: any;
  timestamp: number;
  userId?: string;
}

export class WebSocketService {
  private io: SocketIOServer;
  private redisPublisher: ReturnType<typeof createClient>;
  private redisSubscriber: ReturnType<typeof createClient>;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ['http://103.127.146.58:3000', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.redisPublisher = createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379'
    });

    this.redisSubscriber = createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379'
    });

    this.initialize();
  }

  private async initialize() {
    try {
      // Connect Redis clients
      await this.redisPublisher.connect();
      await this.redisSubscriber.connect();

      // Set up Redis pub/sub
      await this.redisSubscriber.subscribe('realtime_updates', (message: string) => {
        const event: RealtimeEvent = JSON.parse(message);
        this.broadcastEvent(event);
      });

      // Set up Socket.IO connections
      this.setupSocketHandlers();

      console.log('🚀 WebSocket server initialized with Redis pub/sub');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket service:', error);
    }
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔗 Client connected: ${socket.id}`);

      // Join rooms based on user role/permissions
      socket.on('join_room', (room: string) => {
        socket.join(room);
        console.log(`📱 Client ${socket.id} joined room: ${room}`);
      });

      // Leave rooms
      socket.on('leave_room', (room: string) => {
        socket.leave(room);
        console.log(`📱 Client ${socket.id} left room: ${room}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  // Publish event to Redis
  async publishEvent(event: RealtimeEvent) {
    try {
      await this.redisPublisher.publish('realtime_updates', JSON.stringify(event));
    } catch (error) {
      console.error('❌ Failed to publish event:', error);
    }
  }

  // Broadcast event to connected clients
  private broadcastEvent(event: RealtimeEvent) {
    const room = this.getRoomForEvent(event);
    this.io.to(room).emit('data_update', event);
    
    // Also broadcast to general room for all clients
    this.io.emit('data_update', event);
  }

  private getRoomForEvent(event: RealtimeEvent): string {
    switch (event.type) {
      case 'product':
        return 'products';
      case 'category':
        return 'categories';
      case 'order':
        return 'orders';
      case 'inventory':
        return 'inventory';
      case 'user':
        return 'users';
      case 'store':
        return 'stores';
      default:
        return 'general';
    }
  }

  // Get active connections count
  getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }

  // Graceful shutdown
  async shutdown() {
    await this.redisPublisher.quit();
    await this.redisSubscriber.quit();
    this.io.close();
  }
}

// Singleton instance
let websocketService: WebSocketService;

export function initializeWebSocket(httpServer: HTTPServer) {
  if (!websocketService) {
    websocketService = new WebSocketService(httpServer);
  }
  return websocketService;
}

export function getWebSocketService(): WebSocketService {
  if (!websocketService) {
    throw new Error('WebSocket service not initialized');
  }
  return websocketService;
}

// Helper function to publish events from API endpoints
export function publishRealtimeEvent(
  type: RealtimeEvent['type'],
  action: RealtimeEvent['action'],
  data: any,
  userId?: string
) {
  const event: RealtimeEvent = {
    type,
    action,
    data,
    timestamp: Date.now(),
    userId
  };

  try {
    const wsService = getWebSocketService();
    wsService.publishEvent(event);
  } catch (error) {
    console.error('❌ Failed to publish realtime event:', error);
  }
}
