import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { useSession } from "../lib/session.jsx";

export default function NotificationBell() {
  const { session } = useSession();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    loadNotifications();

    const socket = getSocket();
    if (session?.user?.userId) {
      socket.emit("join:user", session.user.userId);
    }

    function handleNewNotif(notif) {
      setNotifications((prev) => [notif, ...prev]);
    }

    function handleProximityAlert(data) {
      const alertNotif = {
        id: `alert_${Date.now()}`,
        title: "🍱 Fresh Food Near You!",
        message: data.message || "New food listing posted within 2 km of your location.",
        isRead: false,
        createdAt: Date.now(),
      };
      setNotifications((prev) => [alertNotif, ...prev]);
    }

    socket.on("notification:new", handleNewNotif);
    socket.on("food:nearby_alert", handleProximityAlert);

    return () => {
      socket.off("notification:new", handleNewNotif);
      socket.off("food:nearby_alert", handleProximityAlert);
    };
  }, [session]);

  async function loadNotifications() {
    try {
      const userId = session?.user?.userId || "guest";
      const res = await api.getNotifications(userId);
      if (res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      // quiet fallback
    }
  }

  async function handleMarkRead(id) {
    try {
      await api.markNotificationRead(id, session?.user?.userId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {}
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
        title="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse shadow-lg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden text-white animate-fade-in">
          <div className="p-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕ Close
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`p-3.5 hover:bg-slate-800/50 transition-colors cursor-pointer flex flex-col gap-1 ${
                    !n.isRead ? "bg-slate-800/30 border-l-2 border-emerald-500" : "opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                    <span>{n.title || "Notification"}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
