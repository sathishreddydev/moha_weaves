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

      const token =
        socket.handshake.auth?.token;

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

      // ✅ AUTH USER
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as UserPayload;

      (
        socket as AuthenticatedSocket
      ).user = decoded;

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

    // DISCONNECT
    socket.on("disconnect", () => {

      console.log(
        "Socket disconnected"
      );
    });
  });

  return io;
};