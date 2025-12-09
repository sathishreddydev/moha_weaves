
import 'dotenv/config';
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { userService } from './auth/authStorage';


declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: string;
      tokenVersion: number;
      isActive: boolean;
    };
  }
}
const JWT_SECRET = process.env.SESSION_SECRET;

interface AccessTokenPayload extends jwt.JwtPayload {
  userId: string;
  role: string;
  tokenVersion: number;
}

export function createAuthMiddleware(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!JWT_SECRET) {
        throw new Error("JWT_SECRET not configured");
      }

      const decoded = jwt.verify(token, JWT_SECRET);

      if (!decoded || typeof decoded !== "object") {
        return res.status(401).json({ message: "Invalid token payload" });
      }

      const payload = decoded as AccessTokenPayload;

      const user = await userService.getUser(payload.userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (payload.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: "Token invalidated" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account disabled" });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }
  };
}

