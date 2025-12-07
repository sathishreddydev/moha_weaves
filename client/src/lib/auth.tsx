import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string) => Promise<any>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<any>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<any>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
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
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (!res.ok) {
          setUser(null);
          return false;
        }

        const data = await res.json();
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


  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const makeRequest = () => fetch(input, {
      ...init,
      credentials: "include",
    });

    const res = await makeRequest();

    if (res.status === 401) {
      const clonedRes = res.clone();
      try {
        const data = await clonedRes.json();
        if (data.code === "TOKEN_EXPIRED" || data.message === "Token expired") {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            return makeRequest();
          }
        }
      } catch {
        // JSON parse failed, return original response
      }
    }

    return res;
  }, [refreshAccessToken]);

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
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        setUser(null);
      }
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, register, changePassword, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};