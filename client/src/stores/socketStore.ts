import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import socketService from '../lib/socket';

interface SocketStore {
  socket: Socket | null;
  isConnected: boolean;
  
  // Actions
  initialize: () => void;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  
  // Internal state setters
  _setSocket: (socket: Socket | null) => void;
  _setConnected: (connected: boolean) => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  isConnected: false,

  initialize: () => {
    const socketInstance = socketService.connect();
    
    // Set initial connection state
    set({ 
      socket: socketInstance,
      isConnected: socketInstance.connected
    });

    // Connect handler
    const handleConnect = () => {
      console.log('✅ Socket connected');
      set({ isConnected: true });
    };

    // Disconnect handler
    const handleDisconnect = () => {
      console.log('❌ Socket disconnected');
      set({ isConnected: false });
    };

    // Register listeners
    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    // Cleanup function
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
    };
  },

  connect: () => {
    const socketInstance = socketService.connect();
    set({ 
      socket: socketInstance,
      isConnected: socketInstance.connected
    });
  },

  disconnect: () => {
    socketService.disconnect();
    set({ 
      socket: null,
      isConnected: false
    });
  },

  emit: (event: string, data?: any) => {
    socketService.emit(event, data);
  },

  on: (event: string, callback: (data: any) => void) => {
    socketService.on(event, callback);
  },

  off: (event: string, callback?: (data: any) => void) => {
    socketService.off(event, callback);
  },

  // Internal setters
  _setSocket: (socket: Socket | null) => set({ socket }),
  _setConnected: (connected: boolean) => set({ isConnected: connected }),
}));

// Hook for components that need socket functionality
export const useSocket = () => {
  const store = useSocketStore();
  
  // Initialize socket on first use
  if (!store.socket && typeof window !== 'undefined') {
    store.initialize();
  }
  
  return store;
};
