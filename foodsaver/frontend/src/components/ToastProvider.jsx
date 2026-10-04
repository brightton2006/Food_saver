import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, Flame, ShoppingBag, X, Tag } from "lucide-react";
import { socket } from "../lib/socket";
import { useSession } from "../lib/session.jsx";

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    barColor: "bg-emerald-500",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    role: "status",
  },
  ready: {
    icon: ShoppingBag,
    barColor: "bg-emerald-500",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    role: "status",
  },
  deal: {
    icon: Flame,
    barColor: "bg-amber-500",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    role: "status",
  },
  error: {
    icon: AlertTriangle,
    barColor: "bg-rose-500",
    iconColor: "text-rose-400",
    borderColor: "border-rose-500/30",
    role: "alert",
  },
  info: {
    icon: Info,
    barColor: "bg-sky-500",
    iconColor: "text-sky-400",
    borderColor: "border-sky-500/30",
    role: "status",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { session } = useSession();

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, message, type = "info", duration = 4000 }) => {
      const id = "t_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
      const newToast = { id, title, message, type, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep maximum 5 active toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  // Helper shortcuts: toast.success(), toast.error(), etc.
  const toast = useCallback(
    (opts) => {
      if (typeof opts === "string") {
        return addToast({ title: opts, message: "", type: "info" });
      }
      return addToast(opts);
    },
    [addToast]
  );

  toast.success = (title, message = "", duration = 4000) =>
    addToast({ title, message, type: "success", duration });
  toast.ready = (title, message = "", duration = 4000) =>
    addToast({ title, message, type: "ready", duration });
  toast.deal = (title, message = "", duration = 4000) =>
    addToast({ title, message, type: "deal", duration });
  toast.error = (title, message = "", duration = 5000) =>
    addToast({ title, message, type: "error", duration });
  toast.info = (title, message = "", duration = 4000) =>
    addToast({ title, message, type: "info", duration });

  // Socket.IO Live Realtime Toast Notifications
  useEffect(() => {
    if (!socket) return;

    const userRole = (session?.role || "guest").toLowerCase();

    // 1. Order Ready event (Customer)
    const handleOrderReady = (data) => {
      if (userRole === "customer" || userRole === "guest") {
        const hotel = data?.hotelName || data?.merchantName || "Partner Hotel";
        toast.ready("Your Order is Ready! 📦", `Your parcel at ${hotel} is ready for pickup.`);
      }
    };

    // 2. New Surplus Deal event (Customer)
    const handleListingCreated = (data) => {
      if (userRole === "customer" || userRole === "guest") {
        const item = data?.itemName || "Surplus Dish";
        const hotel = data?.hotelName || "Local Hotel";
        const disc = data?.discountPercentage || Math.round((1 - (data?.discountPrice / data?.originalPrice || 0.5)) * 100);
        toast.deal("New Surplus Deal! 🔥", `${item} at ${hotel} (${disc}% OFF)`);
      }
    };

    // 3. New Order Received event (Merchant)
    const handleOrderCreated = (data) => {
      if (userRole === "merchant" || userRole === "admin") {
        const item = data?.itemName || "Food Item";
        const qty = data?.quantity || 1;
        toast.info("New Order Received! 🔔", `Customer placed order for ${qty}x ${item}.`);
      }
    };

    // 4. Food Expiring Soon event (NGO)
    const handleNgoNotification = (data) => {
      if (userRole === "ngo" || userRole === "admin") {
        const item = data?.itemName || data?.listing?.itemName || "Surplus Food";
        toast.deal("Food Expiring Soon ⏳", `${item} nearing expiry. Tap to claim free donation!`);
      }
    };

    socket.on("order:ready", handleOrderReady);
    socket.on("order:updated", (data) => {
      if ((data?.status || "").toUpperCase() === "READY_FOR_PICKUP" || (data?.status || "").toUpperCase() === "READY") {
        handleOrderReady(data);
      }
    });
    socket.on("listing:created", handleListingCreated);
    socket.on("night_sale:created", handleListingCreated);
    socket.on("order:created", handleOrderCreated);
    socket.on("claim:created", handleOrderCreated);
    socket.on("ngo:notification", handleNgoNotification);
    socket.on("listing:expiring", handleNgoNotification);

    return () => {
      socket.off("order:ready", handleOrderReady);
      socket.off("order:updated");
      socket.off("listing:created", handleListingCreated);
      socket.off("night_sale:created", handleListingCreated);
      socket.off("order:created", handleOrderCreated);
      socket.off("claim:created", handleOrderCreated);
      socket.off("ngo:notification", handleNgoNotification);
      socket.off("listing:expiring", handleNgoNotification);
    };
  }, [session, toast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Floating Container */}
      <div className="fixed top-3 left-3 right-3 sm:top-5 sm:right-5 sm:left-auto sm:w-88 z-[9999] pointer-events-none flex flex-col gap-2.5">
        {toasts.map((t) => {
          const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.info;
          const IconComp = cfg.icon;

          return (
            <div
              key={t.id}
              role={cfg.role}
              className={`pointer-events-auto relative flex items-start gap-3 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border ${cfg.borderColor} shadow-2xl text-white transition-all duration-300 animate-toast-slide overflow-hidden`}
            >
              {/* Colored Side Bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${cfg.barColor}`} />

              {/* Toast Icon */}
              <div className={`p-1.5 rounded-xl bg-slate-800/80 ${cfg.iconColor} shrink-0 mt-0.5`}>
                <IconComp className="w-5 h-5" />
              </div>

              {/* Toast Content */}
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="text-sm font-semibold text-white leading-snug">{t.title}</h4>
                {t.message ? (
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">{t.message}</p>
                ) : null}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
