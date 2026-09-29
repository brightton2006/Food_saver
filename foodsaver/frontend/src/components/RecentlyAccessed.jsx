import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, ExternalLink, X, Utensils, Store, Package, Heart, Shield } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useTranslation } from "../lib/i18n";

export default function RecentlyAccessed({ compact = false }) {
  const { session } = useSession();
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    loadRecent();
  }, [session?.userId]);

  async function loadRecent() {
    try {
      setLoading(true);
      const res = await api.getRecentlyAccessed(8);
      if (res && res.items) {
        setItems(res.items);
      }
    } catch (err) {
      // Graceful silence on network error
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(id, e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.deleteRecentlyAccessed(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {}
  }

  if (items.length === 0) return null;

  const getIcon = (type) => {
    switch (type) {
      case "food":
        return <Utensils className="w-3.5 h-3.5 text-emerald-500" />;
      case "merchant":
        return <Store className="w-3.5 h-3.5 text-amber-500" />;
      case "order":
        return <Package className="w-3.5 h-3.5 text-blue-500" />;
      case "donation":
        return <Heart className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm my-4 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t("nav.recentlyAccessed")}
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">{items.length} {items.length === 1 ? "item" : "items"}</span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.url}
            className="group relative flex-shrink-0 flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700/60 hover:border-emerald-300 dark:hover:border-emerald-600 rounded-xl px-3 py-2 transition-all duration-200"
            style={{ maxWidth: "220px" }}
          >
            <div className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-2xs">
              {getIcon(item.entityType)}
            </div>
            <div className="min-w-0 pr-4">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="text-[10px] text-slate-400 truncate">{item.subtitle}</p>
              )}
            </div>
            <button
              onClick={(e) => handleRemove(item.id, e)}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-opacity"
              title="Remove from recent"
            >
              <X className="w-3 h-3" />
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
