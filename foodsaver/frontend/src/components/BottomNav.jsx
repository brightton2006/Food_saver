import React from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../lib/session.jsx";

const LINKS = {
  customer: [
    { to: "/customer", label: "Feed", end: true, icon: "🍽️" },
    { to: "/customer/nearby-food", label: "Nearby Map", icon: "📍" },
    { to: "/customer/pickups", label: "My Pickups", icon: "📦" },
  ],
  merchant: [
    { to: "/merchant", label: "Dashboard", end: true, icon: "💼" },
    { to: "/merchant/post", label: "Post Food", icon: "➕" },
    { to: "/merchant/counter", label: "Counter", icon: "🧾" },
    { to: "/merchant/donations", label: "Donations", icon: "🎁" },
  ],
  ngo: [
    { to: "/ngo", label: "Rescue Feed", end: true, icon: "🤝" },
    { to: "/ngo/donations", label: "Donations", icon: "🎁" },
  ],
  admin: [
    { to: "/admin", label: "Admin Console", end: true, icon: "🛡️" },
  ],
};

export default function BottomNav() {
  const { session } = useSession();
  if (!session) return null;
  const links = LINKS[session.role] || [];

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
            <span className="label">{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
