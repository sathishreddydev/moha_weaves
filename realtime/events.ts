import { io } from "./socket"

interface User {
  id: string
  [key: string]: any
}

export const emitUserUpdated = (user: User): void => {
  // specific user
  io.to(`user:${user.id}`).emit(
    "user_event",
    { type: "user_event" }
  )

  // all admins
  io.to("role:admin").emit(
    "user_event", 
    { type: "user_event" }
  )
}
