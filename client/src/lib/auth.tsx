import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@shared/schema";
import { apiRequest } from "./queryClient";

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
  const isRefreshing = useRef(false);
  const refreshPromise = useRef<Promise<boolean> | null>(null);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshing.current && refreshPromise.current) {
      return refreshPromise.current;
    }

    isRefreshing.current = true;
    refreshPromise.current = (async () => {
      try {
        const data = await apiRequest("POST", "/api/auth/refresh");
        setUser(data.user);
        return true;
      } catch (err) {
        setUser(null);
        return false;
      } finally {
        isRefreshing.current = false;
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, []);


  const checkAuth = useCallback(async () => {
    try {
      const data = await apiRequest("GET", "/api/auth/me");
      setUser(data.user);
      return;
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
      const data = await apiRequest("POST", `/api/auth/${role}/login`, { email, password });

      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  };


  const register = async (data: any) => {
    try {
      const result = await apiRequest("POST", "/api/auth/user/register", data);

      setUser(result.user);
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } finally {
      setUser(null);
    }
  };


  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });

      return { success: true };
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};