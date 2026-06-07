import { getIO } from "./socket";
import { pub } from "./redis";

interface User {
  id: string;
  [key: string]: any;
}

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

export const emitUserUpdated = (user: User): void => {
  const io = getIO();
  // specific user
  io.to(`user:${user.id}`).emit("user_event", { type: "user_event" });
  // all admins
  io.to("role:admin").emit("user_event", { type: "user_event" });
};

export const publishRealtimeEvent = async (
  eventType: string,
  data?: any,
): Promise<void> => {
  const event: RealtimeEvent = {
    type: eventType,
    ...(data && { data }),
  };
  try {
    await pub.publish("realtime", JSON.stringify(event));
  } catch (err) {
    console.error(`[publishRealtimeEvent] Failed to publish event "${eventType}":`, err);
    // Do not rethrow — a Redis failure must not crash the HTTP request handler
  }
};
