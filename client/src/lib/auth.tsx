import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string) => Promise<any>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<any>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  const refreshAccessToken = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) return null;

      const data = await res.json();
      setUser(data.user);

      return data.user;
    } catch (err) {
      return null;
    }
  }, []);


  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return;
      }

      // If access token expired → refresh once
      const refreshedUser = await refreshAccessToken();
      if (refreshedUser) return;

      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccessToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string, role: string) => {
    try {
      const res = await fetch(`/api/auth/${role}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };


  const register = async (data: any) => {
    try {
      const res = await fetch("/api/auth/user/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setUser(result.user);
        return { success: true };
      }

      return { success: false, error: result.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  };


  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        return { success: true };
      }

      return { success: false, error: data.message };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
