import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createAuthMiddleware } from "./authMiddleware";

// Security: Require SESSION_SECRET environment variable
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required for security. Please set it in your environment.",
  );
}

// Token expiration settings
const ACCESS_TOKEN_EXPIRY = "15m"; // Short-lived access tokens
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // Refresh token valid for 7 days

// Cookie security settings based on environment
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/",
};

// Generate a secure random refresh token
function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

// Hash refresh token using SHA-256 for secure storage
function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const authAny = createAuthMiddleware(["user", "admin", "inventory", "store"]);

export const authRoutes = (app: Express) => {
  // Helper function to issue tokens
  const issueTokens = async (
    user: { id: string; role: string; tokenVersion: number },
    res: Response,
  ) => {
    // Create short-lived access token with tokenVersion for invalidation
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    // Create refresh token
    const refreshToken = generateRefreshToken();
    const hashedToken = hashRefreshToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    // Store HASHED refresh token in database for security
    await storage.createRefreshToken({
      userId: user.id,
      token: hashedToken, // Store hash, not plaintext
      expiresAt,
      isRevoked: false,
    });

    // Set cookies with proper security (client gets plaintext token)
    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
  };

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.cookies?.accessToken;
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        tokenVersion: number;
      };
      const user = await storage.getUser(decoded.userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check token version for session invalidation
      if (decoded.tokenVersion !== user.tokenVersion) {
        return res
          .status(401)
          .json({ message: "Session invalidated. Please login again." });
      }

      const { password, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res
          .status(401)
          .json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      res.status(401).json({ message: "Invalid token" });
    }
  });

  // Refresh token endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token provided" });
      }

      // Hash the incoming token to look it up in database
      const hashedToken = hashRefreshToken(refreshToken);

      // Validate refresh token from database (lookup by hash)
      const storedToken = await storage.getRefreshToken(hashedToken);
      if (!storedToken || storedToken.isRevoked) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      if (new Date() > storedToken.expiresAt) {
        await storage.revokeRefreshToken(hashedToken);
        return res.status(401).json({ message: "Refresh token expired" });
      }

      const user = await storage.getUser(storedToken.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "User not found or disabled" });
      }

      // Revoke old refresh token (rotation)
      await storage.revokeRefreshToken(hashedToken);

      // Issue new tokens
      await issueTokens(user, res);

      const { password, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({ message: "Token refresh failed" });
    }
  });

  // User register
  app.post("/api/auth/user/register", async (req, res) => {
    try {
      const { email, password, name, phone } = req.body;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        phone,
        role: "user",
      });

      await issueTokens(user, res);

      const { password: _, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Generic login handler
  const handleLogin = async (
    req: Request,
    res: Response,
    expectedRole: string,
  ) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== expectedRole) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled" });
      }

      await issueTokens(user, res);

      const { password: _, tokenVersion, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  };

  app.post("/api/auth/user/login", (req, res) => handleLogin(req, res, "user"));
  app.post("/api/auth/admin/login", (req, res) =>
    handleLogin(req, res, "admin"),
  );
  app.post("/api/auth/inventory/login", (req, res) =>
    handleLogin(req, res, "inventory"),
  );
  app.post("/api/auth/store/login", (req, res) =>
    handleLogin(req, res, "store"),
  );

  // Logout - revoke current refresh token
  app.post("/api/auth/logout", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        // Hash the token before revoking to match stored hash
        const hashedToken = hashRefreshToken(refreshToken);
        await storage.revokeRefreshToken(hashedToken);
      }
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      res.json({ success: true });
    } catch (error) {
      // Still clear cookies even if revoke fails
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      res.json({ success: true });
    }
  });

  // Logout from all devices - invalidates all sessions by incrementing tokenVersion
  app.post("/api/auth/logout-all", authAny, async (req, res) => {
    try {
      const user = (req as any).user;

      // Increment tokenVersion to invalidate all existing tokens
      await storage.incrementUserTokenVersion(user.id);

      // Revoke all refresh tokens for this user
      await storage.revokeAllUserRefreshTokens(user.id);

      // Clear current session cookies
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);

      res.json({ success: true, message: "Logged out from all devices" });
    } catch (error) {
      console.error("Logout all error:", error);
      res.status(500).json({ message: "Failed to logout from all devices" });
    }
  });

  // Change password - invalidates all sessions
  app.post("/api/auth/change-password", authAny, async (req, res) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      // Validate current password
      const validPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!validPassword) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and increment tokenVersion to invalidate all tokens
      await storage.updateUserPassword(user.id, hashedPassword);

      // Revoke all refresh tokens
      await storage.revokeAllUserRefreshTokens(user.id);

      // Issue new tokens
      const updatedUser = await storage.getUser(user.id);
      if (updatedUser) {
        await issueTokens(updatedUser, res);
      }

      res.json({
        success: true,
        message:
          "Password changed successfully. You have been logged out from other devices.",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
};
