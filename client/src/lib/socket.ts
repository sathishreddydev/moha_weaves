// src/client/realtime/socket.ts

import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;

  private socketUrl: string;

  constructor() {
    this.socketUrl =
      import.meta.env.NEXTAUTH_URL ||
      "http://localhost:3000"
  }

  // CONNECT SOCKET
  connect(token?: string): Socket {

    // prevent duplicate connections
    if (this.socket?.connected) {
      return this.socket;
    }
    console.log("this.socketUrl", this.socketUrl)
    this.socket = io(this.socketUrl, {

      // JWT AUTH (only if token provided)
      auth: token ? { token } : undefined,

      // CONNECTION SETTINGS
      autoConnect: true,

      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,

      // WEBSOCKET ONLY
      transports: ["websocket"],

      // REQUIRED IF USING COOKIES/CREDENTIALS
      withCredentials: true,
    });

    // CONNECTED
    this.socket.on("connect", () => {
      console.log(
        "✅ Socket connected:",
        this.socket?.id
      );
    });

    // DISCONNECTED
    this.socket.on("disconnect", (reason) => {
      console.log(
        "❌ Socket disconnected:",
        reason
      );
    });

    // CONNECTION ERROR
    this.socket.on("connect_error", (error) => {
      console.error(
        "🚨 Socket connection error:",
        error.message
      );
    });

    // RECONNECT ATTEMPT
    this.socket.io.on(
      "reconnect_attempt",
      (attempt) => {
        console.log(
          `🔄 Reconnect attempt: ${attempt}`
        );
      }
    );

    // RECONNECTED
    this.socket.io.on(
      "reconnect",
      (attempt) => {
        console.log(
          `✅ Reconnected after ${attempt} attempts`
        );
      }
    );

    return this.socket;
  }

  // DISCONNECT SOCKET
  disconnect(): void {

    if (this.socket) {

      this.socket.removeAllListeners();

      this.socket.disconnect();

      this.socket = null;

      console.log("🔌 Socket disconnected manually");
    }
  }

  // GET SOCKET INSTANCE
  getSocket(): Socket | null {
    return this.socket;
  }

  // CHECK CONNECTION
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // EMIT EVENT
  emit(event: string, data?: any): void {

    if (!this.socket?.connected) {

      console.warn(
        `⚠️ Cannot emit "${event}" — socket not connected`
      );

      return;
    }

    this.socket.emit(event, data);
  }

  // LISTEN EVENT
  on(
    event: string,
    callback: (data: any) => void
  ): void {

    if (!this.socket) {

      console.warn(
        `⚠️ Cannot listen "${event}" — socket not initialized`
      );

      return;
    }

    this.socket.on(event, callback);
  }

  // REMOVE EVENT LISTENER
  off(
    event: string,
    callback?: (data: any) => void
  ): void {

    if (!this.socket) return;

    this.socket.off(event, callback);
  }

  // REMOVE ALL LISTENERS
  removeAllListeners(): void {

    if (!this.socket) return;

    this.socket.removeAllListeners();
  }
}

// SINGLETON INSTANCE
const socketService = new SocketService();

export default socketService;