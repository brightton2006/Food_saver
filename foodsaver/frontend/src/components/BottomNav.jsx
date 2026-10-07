import React from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useTranslation } from "../lib/i18n.jsx";

const LINKS = {
  customer: [
    { to: "/customer", labelKey: "nav.explore", defaultLabel: "Feed", end: true, icon: "🍽️" },
    { to: "/customer/nearby-food", labelKey: "nav.nearbyFood", defaultLabel: "Nearby Map", icon: "📍" },
    { to: "/customer/pickups", labelKey: "nav.myPickups", defaultLabel: "My Pickups", icon: "📦" },
  ],
  merchant: [
    { to: "/merchant", labelKey: "nav.dashboard", defaultLabel: "Dashboard", end: true, icon: "💼" },
    { to: "/merchant/post", labelKey: "nav.postFood", defaultLabel: "Post Food", icon: "➕" },
    { to: "/merchant/counter", labelKey: "nav.counter", defaultLabel: "Counter", icon: "🧾" },
    { to: "/merchant/donations", labelKey: "nav.donations", defaultLabel: "Donations", icon: "🎁" },
  ],
  ngo: [
    { to: "/ngo", labelKey: "ngo.dashboard", defaultLabel: "Rescue Feed", end: true, icon: "🤝" },
    { to: "/ngo/donations", labelKey: "nav.donations", defaultLabel: "Donations", icon: "🎁" },
  ],
  admin: [{ to: "/admin", labelKey: "nav.admin", defaultLabel: "Admin Console", end: true, icon: "🛡️" }],
};

export default function BottomNav() {
  const { session } = useSession();
  const { t } = useTranslation();
  if (!session) return null;
  const roleKey = (session.role || "").toLowerCase();
  const links = LINKS[roleKey] || [];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-inner">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
            aria-current={({ isActive }) => (isActive ? "page" : undefined)}
          >
            <span className="icon" aria-hidden>
              {link.icon}
            </span>
            <span className="label">{t(link.labelKey) || link.defaultLabel}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
