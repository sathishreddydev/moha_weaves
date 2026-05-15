import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { Server as HttpServer } from "http";

export let io: Server;

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io has not been initialized. Call initSocket first.");
  }
  return io;
};

interface UserPayload {
  userId: string;
  role: string;
  [key: string]: any;
}

interface AuthenticatedSocket extends Socket {
  user?: UserPayload | null;
}

export const initSocket = (
  server: HttpServer
): Server => {

  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://103.127.146.58:3000",
      ],
      credentials: true,
    },
  });

  // AUTH MIDDLEWARE
  io.use((
    socket: Socket,
    next: (err?: Error) => void
  ) => {

    try {

      // Accept token from handshake auth (Next.js app) OR from cookie (React app)
      let token = socket.handshake.auth?.token;

      if (!token) {
        // Parse accessToken from the cookie header sent with the handshake
        const cookieHeader = socket.handshake.headers?.cookie || "";
        const match = cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      // ✅ GUEST USER
      if (!token) {

        console.log(
          "Guest socket connected"
        );

        (
          socket as AuthenticatedSocket
        ).user = null;

        return next();
      }

      // ✅ AUTH USER — both apps now sign with JWT_SECRET
      let decoded: UserPayload | null = null;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
      } catch {
        console.error("Socket auth error: invalid token");
        return next(new Error("Unauthorized"));
      }

      // Normalise: Next.js auth-service uses `id`, React app uses `userId`
      if (!decoded.userId && (decoded as any).id) {
        decoded.userId = (decoded as any).id;
      }

      (socket as AuthenticatedSocket).user = decoded;
      next();

    } catch (err) {

      console.error(
        "Socket auth error:",
        err
      );

      next(
        new Error("Unauthorized")
      );
    }
  });

  // CONNECTION
  io.on("connection", (
    socket: Socket
  ) => {

    const authenticatedSocket =
      socket as AuthenticatedSocket;

    console.log(
      "Socket connected:",
      socket.id
    );

    // ✅ ONLY AUTH USERS JOIN ROOMS
    if (authenticatedSocket.user) {

      const {
        userId,
        role,
      } = authenticatedSocket.user;

      authenticatedSocket.join(
        `user:${userId}`
      );

      authenticatedSocket.join(
        `role:${role}`
      );

      console.log(
        `Joined user:${userId}`
      );

      console.log(
        `Joined role:${role}`
      );
    }

    // ✅ GUEST USER
    else {

      console.log(
        "Guest user connected"
      );
    }

    // ✅ JOIN PRODUCT ROOM (any client can join to receive stock updates)
    socket.on("join_product_room", (productId: string) => {
      if (productId) {
        socket.join(`product:${productId}`);
      }
    });

    socket.on("leave_product_room", (productId: string) => {
      if (productId) {
        socket.leave(`product:${productId}`);
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {

      console.log(
        "Socket disconnected"
      );
    });
  });

  return io;
};