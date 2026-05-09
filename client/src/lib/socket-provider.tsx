'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { Socket } from 'socket.io-client';

import socketService from './socket';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;

  connect: () => void;

  disconnect: () => void;

  emit: (
    event: string,
    data?: any
  ) => void;

  on: (
    event: string,
    callback: (data: any) => void
  ) => void;

  off: (
    event: string,
    callback?: (data: any) => void
  ) => void;
}

const SocketContext =
  createContext<SocketContextType | undefined>(
    undefined
  );

export function useSocket() {

  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      'useSocket must be used within SocketProvider'
    );
  }

  return context;
}

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({
  children,
}: SocketProviderProps) {

  const [socket, setSocket] =
    useState<Socket | null>(null);

  const [isConnected, setIsConnected] =
    useState(false);

  // INITIALIZE SOCKET
  useEffect(() => {

    const socketInstance = socketService.connect();
    setSocket(socketInstance);

    // CONNECT
    const handleConnect = () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
    };

    // DISCONNECT
    const handleDisconnect = () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    };

    // REGISTER LISTENERS
    if (socketInstance) {
      socketInstance.on('connect', handleConnect);
      socketInstance.on('disconnect', handleDisconnect);
      setIsConnected(socketInstance.connected);
    }

    // CLEANUP
    return () => {
      if (socketInstance) {
        socketInstance.off('connect', handleConnect);
        socketInstance.off('disconnect', handleDisconnect);
      }
    };

  }, []);

  // MANUAL CONNECT
  const connect = () => {

    // Connect socket using cookie-based authentication
    const socketInstance = socketService.connect();
    setSocket(socketInstance);
  };

  // MANUAL DISCONNECT
  const disconnect = () => {

    socketService.disconnect();

    setSocket(null);

    setIsConnected(false);
  };

  // EMIT EVENT
  const emit = (
    event: string,
    data?: any
  ) => {

    socketService.emit(event, data);
  };

  // REGISTER LISTENER
  const on = (
    event: string,
    callback: (data: any) => void
  ) => {

    socketService.on(event, callback);
  };

  // REMOVE LISTENER
  const off = (
    event: string,
    callback?: (data: any) => void
  ) => {

    socketService.off(event, callback);
  };

  const value: SocketContextType = {
    socket,
    isConnected,

    connect,
    disconnect,

    emit,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}