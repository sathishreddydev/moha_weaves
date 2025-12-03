import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { email: string; password: string; name: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  checkAuth: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Attempt to refresh the access token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Setup automatic token refresh (every 14 minutes for 15-minute access tokens)
  const setupRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    // Refresh 1 minute before expiry (14 minutes)
    refreshTimerRef.current = setInterval(async () => {
      const success = await refreshToken();
      if (!success) {
        setUser(null);
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      }
    }, 14 * 60 * 1000);
  }, [refreshToken]);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setupRefreshTimer();
      } else {
        // Try to refresh if access token expired
        const data = await res.json().catch(() => ({}));
        if (data.code === "TOKEN_EXPIRED") {
          const refreshed = await refreshToken();
          if (refreshed) {
            setupRefreshTimer();
            return;
          }
        }
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken, setupRefreshTimer]);

  useEffect(() => {
    checkAuth();
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [checkAuth]);

  const login = async (email: string, password: string, role: string) => {
    try {
      const res = await fetch(`/api/auth/${role}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setUser(data.user);
        setupRefreshTimer();
        return { success: true };
      }
      
      return { success: false, error: data.message || "Login failed" };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const register = async (data: { email: string; password: string; name: string; phone?: string }) => {
    try {
      const res = await fetch("/api/auth/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setUser(result.user);
        setupRefreshTimer();
        return { success: true };
      }
      
      return { success: false, error: result.message || "Registration failed" };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { 
        method: "POST", 
        credentials: "include" 
      });
    } finally {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await fetch("/api/auth/logout-all", { 
        method: "POST", 
        credentials: "include" 
      });
    } finally {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      setUser(null);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setupRefreshTimer();
        return { success: true };
      }
      
      return { success: false, error: data.message || "Password change failed" };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, logoutAll, checkAuth, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
