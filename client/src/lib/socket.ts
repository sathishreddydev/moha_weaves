import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;

  connect(token?: string): Socket {

    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io("/", {

      auth: token ? { token } : undefined,

      autoConnect: true,

      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,

      transports: ["websocket"],

      withCredentials: true,
    });

    this.socket.on("connect", () => {
      console.log("✅ Socket admin connected:", this.socket?.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Socket admin disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("🚨 Socket admin connection error:", error.message);
    });

    return this.socket;
  }

  disconnect(): void {

    if (this.socket) {

      this.socket.removeAllListeners();

      this.socket.disconnect();

      this.socket = null;

      console.log("🔌 Socket disconnected manually");
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  emit(event: string, data?: any): void {

    if (!this.socket?.connected) {
      console.warn(`⚠️ Cannot emit "${event}" — socket not connected`);
      return;
    }

    this.socket.emit(event, data);
  }

  on(event: string, callback: (data: any) => void): void {

    if (!this.socket) {
      console.warn(`⚠️ Cannot listen "${event}" — socket not initialized`);
      return;
    }

    this.socket.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void): void {

    if (!this.socket) return;

    this.socket.off(event, callback);
  }

  removeAllListeners(): void {

    if (!this.socket) return;

    this.socket.removeAllListeners();
  }
}

const socketService = new SocketService();

export default socketService;