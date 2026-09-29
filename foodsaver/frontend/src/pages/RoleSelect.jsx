import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import landing1 from "../assets/landing-1.svg";
import landing2 from "../assets/landing-2.svg";
import landing3 from "../assets/landing-3.svg";
import landing4 from "../assets/landing-4.svg";

const ROLES = [
  {
    id: "customer",
    title: "Food Lover",
    body: "Browse local surplus offers, reserve fresh meals, and help reduce food waste one pickup at a time.",
    to: "/customer",
    cta: "Explore deals",
  },
  {
    id: "merchant",
    title: "Food Partner",
    body: "Turn unsold food into revenue, manage listings simply, and keep your kitchen waste-free.",
    to: "/merchant",
    cta: "Publish surplus",
  },
  {
    id: "ngo",
    title: "Rescue Partner",
    body: "Discover donation-ready offers and coordinate fast, trusted pickups for your community.",
    to: "/ngo",
    cta: "Find rescues",
  },
];

const QUICK_CATEGORIES = [
  { name: "Bakery", emoji: "🥐" },
  { name: "Meals", emoji: "🍛" },
  { name: "Snacks", emoji: "🥪" },
  { name: "Desserts", emoji: "🍰" },
  { name: "Beverages", emoji: "☕" },
  { name: "Fast Food", emoji: "🍔" },
  { name: "Healthy", emoji: "🥗" },
  { name: "Homemade", emoji: "🏡" },
];

const PREVIEW_IMAGES = [
  { id: "local-1", title: "Community meals", src: landing1 },
  { id: "local-2", title: "Fast pickups", src: landing2 },
  { id: "local-3", title: "Real-time alerts", src: landing3 },
  { id: "local-4", title: "Partner network", src: landing4 },
];

const HERO_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80";

export default function RoleSelect() {
  const { setSession } = useSession();
  const [pendingRole, setPendingRole] = useState(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Bakery");
  const navigate = useNavigate();

  function confirm(role) {
    if (!name.trim()) return;
    const defaultUsername = name.trim().toLowerCase().replace(/\s+/g, "_");
    setSession({
      role: role.id,
      name: name.trim(),
      hotelName: role.id === "merchant" ? name.trim() : name.trim(),
      username: username.trim() || defaultUsername,
    });
    navigate(role.to);
  }

  return (
    <div className="app-main landing-page">
      <section className="hero hero-food-saver">
        <div className="hero-copy">
          <span className="eyebrow-stylish">Good Food. Great Deals. Zero Waste.</span>
          <h1 className="font-elegant">Fresh surplus from local sellers, reserved in minutes.</h1>
          <p className="font-stylish">
            Food Saver connects you with nearby restaurants, bakeries, cafes, and home cooks offering quality food at lower prices before it goes to waste.
          </p>
          <div className="hero-cta-group">
            <button className="btn btn-primary" onClick={() => setPendingRole(ROLES[0])}>
              Explore Today's Deals
            </button>
            <button className="btn btn-ghost" onClick={() => setPendingRole(ROLES[1])}>
              List Your Food
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <strong>24</strong>
              <span>meals saved today</span>
            </div>
            <div>
              <strong>18</strong>
              <span>local sellers live</span>
            </div>
            <div>
              <strong>82%</strong>
              <span>surplus food recovered</span>
            </div>
          </div>
        </div>

        <div className="hero-visual" style={{ background: "linear-gradient(135deg, #2D3B37 0%, #24332F 100%)", border: "1.5px solid rgba(245, 158, 11, 0.4)", borderRadius: 20 }}>
          <div className="hero-visual-overlay" />
          <div className="hero-visual-copy">
            <span className="eyebrow" style={{ color: "#FF9F68" }}>Featured Live Platform</span>
            <h2>Direct Connect • Instant Food Surplus Rescue</h2>
            <p>Warm, buttery rolls with a discount that makes every bite feel like a rescue win.</p>
          </div>
        </div>
      </section>

      <section className="quick-categories">
        <div className="section-head">
          <h2>Quick categories</h2>
          <span className="count">Tap to explore</span>
        </div>
        <div className="category-grid">
          {QUICK_CATEGORIES.map((category) => (
            <button
              key={category.name}
              type="button"
              className={`category-card ${selectedCategory === category.name ? "active" : ""}`}
              onClick={() => setSelectedCategory(category.name)}
            >
              <span className="category-icon">{category.emoji}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="role-panel">
        <h2>Choose your experience</h2>
        <div className="role-grid">
          {ROLES.map((role) => (
            <div className="role-card" key={role.id}>
              <span className="eyebrow">{role.title}</span>
              <p>{role.body}</p>
              {pendingRole?.id === role.id ? (
                <div className="role-form">
                  <input
                    autoFocus
                    placeholder={
                      role.id === "merchant"
                        ? "Hotel / Restaurant Name"
                        : role.id === "ngo"
                          ? "Organization name"
                          : "Your name"
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirm(role)}
                  />
                  <button className="btn btn-primary" onClick={() => confirm(role)} disabled={!name.trim()}>
                    Continue
                  </button>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={() => { setPendingRole(role); setName(""); }}>
                  {role.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="image-section">
        <div className="section-head">
          <h2>Local food stories</h2>
          <span className="count">A glimpse of nearby offerings</span>
        </div>
        <div className="landing-grid">
          {PREVIEW_IMAGES.map((image) => (
            <article className="image-card" key={image.id}>
              <img src={image.src} alt={image.title} loading="lazy" />
              <div className="image-meta">
                <h3>{image.title}</h3>
                <p>Fresh local food visuals to bring the experience to life.</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
