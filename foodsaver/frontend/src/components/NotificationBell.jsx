import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { useSession } from "../lib/session.jsx";
import { useTranslation } from "../lib/i18n.jsx";
import { Bell, CheckCheck, Trash2, X, ExternalLink } from "lucide-react";

export default function NotificationBell() {
  const { session } = useSession();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // "all", "orders", "system"

  const userId = session?.user?.userId || session?.userId || "guest";
  const userRole = (session?.role || "customer").toLowerCase();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    loadNotifications();

    const socket = getSocket();
    if (userId && userId !== "guest") {
      socket.emit("join:user", userId);
    }
    socket.emit("join:role", userRole);

    function handleNewNotif(notif) {
      setNotifications((prev) => [notif, ...prev]);
    }

    function handleProximityAlert(data) {
      const alertNotif = {
        id: `alert_${Date.now()}`,
        title: "🍱 Fresh Food Near You!",
        message: data.message || "New surplus food listing posted within 2 km of your location.",
        type: "FOOD_NEARBY",
        link: `/restaurant/${data.listing?.hotelId || data.listing?.hotel_id || ""}`,
        isRead: false,
        createdAt: Date.now(),
      };
      setNotifications((prev) => [alertNotif, ...prev]);
    }

    function handleRoleNotif(notif) {
      setNotifications((prev) => [notif, ...prev]);
    }

    socket.on("notification:new", handleNewNotif);
    socket.on("notification:role", handleRoleNotif);
    socket.on("food:nearby_alert", handleProximityAlert);

    return () => {
      socket.off("notification:new", handleNewNotif);
      socket.off("notification:role", handleRoleNotif);
      socket.off("food:nearby_alert", handleProximityAlert);
    };
  }, [session, userId, userRole]);

  async function loadNotifications() {
    try {
      const res = await api.getNotifications(userId);
      if (res && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      // quiet fallback
    }
  }

  async function handleMarkRead(id) {
    try {
      await api.markNotificationRead(id, userId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {}
  }

  async function handleMarkAllRead() {
    try {
      await api.markAllNotificationsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {}
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    try {
      await api.deleteNotification(id, userId);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {}
  }

  function handleNotificationClick(notif) {
    handleMarkRead(notif.id);
    setIsOpen(false);

    if (notif.link) {
      navigate(notif.link);
      return;
    }

    const typeUpper = (notif.type || "").toUpperCase();
    if (typeUpper.includes("ORDER") || typeUpper.includes("DELIVER")) {
      if (userRole === "merchant") {
        navigate("/merchant/counter");
      } else {
        navigate("/customer/pickups");
      }
    } else if (typeUpper.includes("DONATION") || typeUpper.includes("NGO")) {
      navigate(userRole === "merchant" ? "/merchant/donations" : "/ngo/donations");
    } else if (typeUpper.includes("VERIFICATION") || typeUpper.includes("PARTNER")) {
      navigate(userRole === "admin" ? "/admin" : "/profile");
    } else if (typeUpper.includes("FOOD")) {
      navigate("/customer/nearby-food");
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "orders") {
      const t = (n.type || "").toUpperCase();
      return t.includes("ORDER") || t.includes("DELIVER") || t.includes("CLAIM");
    }
    if (activeTab === "system") {
      const t = (n.type || "").toUpperCase();
      return t.includes("SECURITY") || t.includes("ACCOUNT") || t.includes("VERIFICATION");
    }
    return true;
  });

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: "50%",
          backgroundColor: "var(--color-primary-light, #E8F4F1)",
          color: "var(--color-primary, #145C52)",
          border: "1px solid var(--fs-border, #DCE6E3)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        title={t("notifications.title")}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              backgroundColor: "#EF4444",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 12,
              border: "2px solid #FFFFFF",
              boxShadow: "0 2px 6px rgba(239, 68, 68, 0.4)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: 46,
            right: 0,
            width: 340,
            maxWidth: "90vw",
            backgroundColor: "#FFFFFF",
            border: "1px solid var(--fs-border, #DCE6E3)",
            borderRadius: 16,
            boxShadow: "0 18px 45px rgba(20, 92, 82, 0.16)",
            zIndex: 1000,
            overflow: "hidden",
            animation: "fade-in 0.2s ease backwards",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              backgroundColor: "var(--fs-teal-very-light, #F3F9F7)",
              borderBottom: "1px solid var(--fs-border, #DCE6E3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--color-primary, #145C52)" }}>
                🔔 {t("notifications.title")}
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "var(--color-primary-light, #E8F4F1)",
                    color: "var(--color-primary, #145C52)",
                    padding: "2px 8px",
                    borderRadius: 12,
                  }}
                >
                  {unreadCount} {t("notifications.unread")}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-primary, #145C52)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                  title={t("notifications.markAllRead")}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{t("notifications.markAllRead")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#687674",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--fs-border, #DCE6E3)",
              backgroundColor: "#FFFFFF",
              padding: "4px 8px",
            }}
          >
            {[
              { id: "all", label: t("notifications.all") },
              { id: "orders", label: t("notifications.orders") },
              { id: "system", label: t("notifications.system") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  fontSize: 11.5,
                  fontWeight: activeTab === tab.id ? 800 : 500,
                  color: activeTab === tab.id ? "var(--color-primary, #145C52)" : "#687674",
                  borderBottom: activeTab === tab.id ? "2px solid var(--color-primary, #145C52)" : "2px solid transparent",
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {filteredNotifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#8A9693", fontSize: 13 }}>
                {t("notifications.empty")}
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #F1F5F4",
                    backgroundColor: n.isRead ? "#FFFFFF" : "var(--fs-teal-very-light, #F3F9F7)",
                    borderLeft: n.isRead ? "3px solid transparent" : "3px solid var(--color-primary, #145C52)",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-primary-light, #E8F4F1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = n.isRead ? "#FFFFFF" : "var(--fs-teal-very-light, #F3F9F7)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <strong style={{ fontSize: 12.5, color: "#102A2A", lineHeight: 1.3 }}>
                      {n.title || "Notification"}
                    </strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#8A9693", whiteSpace: "nowrap" }}>
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, n.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#CBD5E1",
                          cursor: "pointer",
                          padding: 2,
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#4A5568", lineHeight: 1.4 }}>
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
