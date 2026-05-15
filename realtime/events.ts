import { io } from "./socket";
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
  await pub.publish("realtime", JSON.stringify(event));
};
