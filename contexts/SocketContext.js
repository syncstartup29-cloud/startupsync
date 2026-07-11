"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "http://localhost:3000";
    const socketInstance = io(socketUrl, {
      auth: {
        userId: user._id,
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      // Fetch online users list
      socketInstance.emit("presence:whoIsOnline", (res) => {
        if (res && res.onlineUserIds) {
          setOnlineUsers(new Set(res.onlineUserIds));
        }
      });
    });

    socketInstance.on("presence:update", ({ userId, online }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    socketInstance.on("auth:forceLogout", (payload) => {
      // Check if this device is the one to be kicked
      let currentToken = null;
      try {
        currentToken = sessionStorage.getItem("token") || localStorage.getItem("token");
      } catch {}

      if (payload && payload.newToken && currentToken === payload.newToken) {
        return; // we are the new device!
      }
      logout();
    });

    socketInstance.on("user:suspended", () => {
      logout(true); // logs out and redirects to /suspended
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
