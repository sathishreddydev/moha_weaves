import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";

// Create axios instance with default configuration
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function throwIfResNotOk(error: any) {
  if (error instanceof AxiosError) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        `${error.response?.status}: ${error.response?.statusText}`;
    
    const customError = new Error(errorMessage);
    (customError as any).data = error.response?.data || {};
    (customError as any).status = error.response?.status;
    throw customError;
  }
  throw error;
}

export async function apiRequest(
  method: string,
  url: string,
  reqBody?: any,
  options: any = {}
): Promise<any> {
  try {
    const isFormData = reqBody instanceof FormData;
    
    // Configure axios request
    const config: any = {
      method,
      url,
      ...options,
    };

    // Handle data/body
    if (reqBody) {
      if (isFormData) {
        config.data = reqBody;
        config.headers = {
          ...config.headers,
          'Content-Type': 'multipart/form-data',
        };
      } else {
        config.data = reqBody;
      }
    }

    const response = await api.request(config);
    return response.data;
  } catch (error) {
    await throwIfResNotOk(error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const response = await api.get(queryKey.join("/") as string);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && unauthorizedBehavior === "returnNull" && error.response?.status === 401) {
        return null;
      }
      await throwIfResNotOk(error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});