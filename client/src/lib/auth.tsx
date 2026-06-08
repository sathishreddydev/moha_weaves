import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@shared/schema";
import { apiRequest } from "./queryClient";
import socketService from "./socket";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string) => Promise<any>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshing = useRef(false);
  const refreshPromise = useRef<Promise<boolean> | null>(null);

  // Reconnect socket whenever auth state changes so it joins the correct rooms
  const reconnectSocket = useCallback(() => {
    socketService.disconnect();
    // Small delay to let the cookie be set before the new handshake
    setTimeout(() => socketService.connect(), 100);
  }, []);

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

  // Reconnect socket whenever user changes (login / logout)
  useEffect(() => {
    if (!isLoading) {
      reconnectSocket();
    }
  }, [user?.id, isLoading]);

  const login = async (email: string, password: string, role: string) => {
    try {
      const data = await apiRequest("POST", `/api/auth/${role}/login`, { email, password });

      setUser(data.user);
      return { success: true };
    } catch (error: any) {
      const message = error?.message || "Something went wrong. Please try again.";
      return { success: false, error: message };
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};