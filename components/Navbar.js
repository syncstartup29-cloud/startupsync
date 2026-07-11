"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { Bell, MessageSquare, Users, Inbox, User, LogOut, Shield, Sparkles, X, Check } from "lucide-react";

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Load notifications and chat unread counts
  useEffect(() => {
    if (!token) return;

    // Fetch notifications
    fetch("/api/notifications/list", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotifications(data.notifications);
          setUnreadNotifications(data.notifications.filter(n => !n.seen).length);
        }
      })
      .catch(() => {});

    // Fetch unread chats count
    fetch("/api/chat/unread-counts", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const totalUnread = Object.values(data.counts).reduce((a, b) => a + b, 0);
          setUnreadChats(totalUnread);
        }
      })
      .catch(() => {});

  }, [token]);

  // Socket listeners for real-time notifications/messages
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadNotifications(prev => prev + 1);
    };

    const handleNewMessage = () => {
      // Increment unread count or query api
      setUnreadChats(prev => prev + 1);
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("chat:newMessage", handleNewMessage);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("chat:newMessage", handleNewMessage);
    };
  }, [socket]);

  // Click outside handlers to close menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllNotificationsAsSeen = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications/mark-seen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
        setUnreadNotifications(0);
      }
    } catch {}
  };

  const navItems = [
    { name: "Discover", path: "/connections", icon: Users },
    { name: "Inbox", path: "/inbox", icon: Inbox },
    { name: "Chat", path: "/chat", icon: MessageSquare, badge: unreadChats },
  ];

  if (!user) return null;

  const initials = user.fullName ? user.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "U";
  const userPhoto = user.role === "Founder" ? (user.founderProfile?.photo || "") : (user.investorProfile?.photo || "");

  return (
    <nav className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-extrabold text-white text-md">
            S
          </div>
          <span className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-300 hidden sm:inline">
            StartupSync
          </span>
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-1 sm:gap-4 flex-1 justify-center max-w-lg">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.path)}
                className={`relative px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  active
                    ? "bg-indigo-600 text-white font-bold border border-indigo-500 shadow-md shadow-indigo-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-900/80 font-bold"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.name}</span>
                {!!item.badge && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 ring-2 ring-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications & Profile Menus */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadNotifications > 0) {
                  markAllNotificationsAsSeen();
                }
              }}
              className="p-2 rounded-xl hover:bg-slate-900/80 border border-transparent hover:border-slate-700 text-slate-200 hover:text-white transition relative"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full shadow-md shadow-indigo-500/50"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                  <span className="text-xs font-black text-white">Notifications</span>
                  {unreadNotifications > 0 && (
                    <button
                      onClick={markAllNotificationsAsSeen}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Mark all seen
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-semibold">No notifications yet</div>
                  ) : (
                    notifications.map((n, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 p-2.5 rounded-xl transition ${
                          n.seen ? "bg-transparent" : "bg-slate-950/60 border border-slate-700/60"
                        }`}
                      >
                        {n.senderPhoto ? (
                          <img
                            src={n.senderPhoto}
                            alt="Sender"
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-[10px] flex-shrink-0">
                            SS
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 leading-normal font-medium">{n.message}</p>
                          <span className="text-[10px] text-slate-400 font-medium block mt-1">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 focus:outline-none"
            >
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt="Profile"
                  className="w-8 h-8 rounded-xl object-cover border border-slate-850 hover:scale-105 transition"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-700 hover:scale-105 transition flex items-center justify-center font-bold text-slate-200 text-xs">
                  {initials}
                </div>
              )}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-700 mb-2">
                  <p className="text-xs font-black text-white truncate">{user.fullName}</p>
                  <p className="text-[10px] text-indigo-400 font-bold tracking-wide uppercase mt-0.5">{user.role}</p>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    router.push(user.role === "Founder" ? "/founder-dashboard" : "/investor-dashboard");
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 transition"
                >
                  <User className="w-4 h-4 text-slate-300" /> Update Profile
                </button>

                {user.email === "admin@startupsync.in" && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push("/admin");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80 flex items-center gap-2 transition"
                  >
                    <Shield className="w-4 h-4 text-slate-300" /> Admin Panel
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 flex items-center gap-2 transition mt-1"
                >
                  <LogOut className="w-4 h-4 text-rose-400" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
