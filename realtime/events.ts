import { io } from "./socket"

interface User {
  id: string
  [key: string]: any
}

export const emitUserUpdated = (user: User): void => {
  // specific user
  io.to(`user:${user.id}`).emit(
    "user.updated",
    user
  )

  // all admins
  io.to("role:admin").emit(
    "user.updated", 
    user
  )
}
