import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "../lib/session.jsx";
import { useRealtimeListings } from "../lib/useRealtimeListings.js";
import ListingCard from "../components/ListingCard.jsx";
import HotelCard from "../components/HotelCard.jsx";
import PaymentModal from "../components/PaymentModal.jsx";
import FoodSaverIntro from "../components/FoodSaverIntro.jsx";
import NearbyMarker from "../components/animations/NearbyMarker.jsx";
import FoodNotification from "../components/animations/FoodNotification.jsx";
import FoodCardAnimation from "../components/animations/FoodCardAnimation.jsx";
import LoadingSkeleton from "../components/animations/LoadingSkeleton.jsx";
import PageTransition from "../components/animations/PageTransition.jsx";
import { api } from "../lib/api.js";
import { addMyClaim } from "../lib/myClaims.js";

const PRE_LOGIN_CATEGORIES = [
  { id: "All", label: "All", emoji: "🍽️" },
  { id: "Pizza", label: "Pizza", emoji: "🍕" },
  { id: "Biryani", label: "Biryani", emoji: "🍛" },
  { id: "Burgers", label: "Burgers", emoji: "🍔" },
  { id: "South Indian", label: "South Indian", emoji: "🥘" },
  { id: "Chinese", label: "Chinese", emoji: "🍜" },
  { id: "Cakes", label: "Cakes", emoji: "🎂" },
  { id: "Desserts", label: "Desserts", emoji: "🍰" },
  { id: "Healthy", label: "Healthy", emoji: "🥗" },
  { id: "Cafe", label: "Cafe", emoji: "☕" },
  { id: "Fast Food", label: "Fast Food", emoji: "🍟" },
];

const PRE_LOGIN_FILTERS = [
  { id: "all", label: "Filters" },
  { id: "offers", label: "Offers" },
  { id: "rating", label: "Rating 4.5+" },
  { id: "veg", label: "Pure Veg" },
  { id: "open", label: "Open Now" },
  { id: "fast", label: "Fast Delivery" },
];

export default function PreLoginHome({ onOpenAuth, searchQuery = "", city = "Kovilpatti" }) {
  const { session } = useSession();
  const navigate = useNavigate();
  const { listings, loading } = useRealtimeListings();
  const [hotels, setHotels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [claimingListing, setClaimingListing] = useState(null);
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem("foodsaver_intro_seen");
  });

  React.useEffect(() => {
    async function loadHotels() {
      try {
        const res = await api.getHotels();
        setHotels(res.hotels || []);
      } catch (e) {
        console.error("Failed to load hotels:", e);
      }
    }
    loadHotels();
  }, []);

  function toggleFilter(id) {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  const filteredListings = useMemo(() => {
    let result = listings.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" ||
        item.category === selectedCategory ||
        item.itemName.toLowerCase().includes(selectedCategory.toLowerCase());

      const effectiveQuery = searchQuery.trim().toLowerCase();
      const matchesQuery = effectiveQuery
        ? `${item.itemName} ${item.merchantName} ${item.category} ${item.address}`
            .toLowerCase()
            .includes(effectiveQuery)
        : true;

      const matchesOffers = activeFilters.includes("offers")
        ? item.discountPrice < item.originalPrice
        : true;

      return matchesCategory && matchesQuery && matchesOffers;
    });

    if (sortBy === "rating") {
      result = [...result].sort((a, b) => b.originalPrice - a.originalPrice);
    } else if (sortBy === "price_asc") {
      result = [...result].sort((a, b) => a.discountPrice - b.discountPrice);
    } else if (sortBy === "price_desc") {
      result = [...result].sort((a, b) => b.discountPrice - a.discountPrice);
    }

    return result;
  }, [listings, selectedCategory, searchQuery, activeFilters, sortBy]);

  // Top Picks using filtered listings
  const topPicks = useMemo(() => {
    return filteredListings.slice(0, 8);
  }, [filteredListings]);

  // Filtered Hotels
  const displayedHotels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const cat = selectedCategory.trim().toLowerCase();

    return hotels.filter((h) => {
      const matchesCategory =
        cat === "all" ||
        h.cuisine?.toLowerCase().includes(cat) ||
        h.items?.some((i) => i.category?.toLowerCase().includes(cat) || i.itemName?.toLowerCase().includes(cat));

      const matchesQuery = !q || (
        h.hotelName.toLowerCase().includes(q) ||
        h.cuisine?.toLowerCase().includes(q) ||
        h.address?.toLowerCase().includes(q) ||
        h.items?.some((i) => i.itemName.toLowerCase().includes(q))
      );

      return matchesCategory && matchesQuery;
    });
  }, [hotels, selectedCategory, searchQuery]);

  function handleClaimClick(listing) {
    if (!session) {
      if (onOpenAuth) onOpenAuth("login");
      return;
    }
    setClaimingListing(listing);
  }

  return (
    <PageTransition className="prelogin-homepage">
      {/* 1. CINEMATIC 5-SCENE INTRO OPENING */}
      {showIntro && (
        <FoodSaverIntro
          enabled={true}
          onComplete={() => {
            setShowIntro(false);
            sessionStorage.setItem("foodsaver_intro_seen", "true");
          }}
        />
      )}

      {/* 2. REVAMPED HERO / MAP DISCOVERY SECTION */}
      <section
        className="prelogin-hero-section relative overflow-hidden"
        style={{
          minHeight: "560px",
          background: "linear-gradient(145deg, rgba(15, 76, 69, 0.92) 0%, rgba(20, 92, 82, 0.90) 50%, rgba(30, 128, 111, 0.88) 100%), url('/foodsaver_login_hero.png') center/cover no-repeat",
          color: "#ffffff",
          padding: "64px 20px 72px",
        }}
      >
        
        {/* Subtle Live-Location / Map-inspired Background Grid & Radar Pulse */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          {/* Grid lines */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(rgba(232, 244, 241, 0.25) 1px, transparent 1px), radial-gradient(rgba(245, 196, 81, 0.2) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              backgroundPosition: "0 0, 20px 20px",
            }}
          />

          {/* Central Animated Radar Ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-[#16796B]/30 radar-ping-wave" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-[#F5C451]/25" />

          {/* Glowing Mock Location Nodes */}
          <div className="absolute top-[28%] left-[22%] flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F4C45]/90 border border-[#16796B]/50 text-[11px] font-bold text-[#E8F4F1] shadow-lg animate-pulse">
            <span>📍</span>
            <span>Aarthi Hotel • 850m</span>
          </div>
          <div className="absolute bottom-[24%] right-[20%] flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F4C45]/90 border border-[#FF9F43]/50 text-[11px] font-bold text-[#FF9F43] shadow-lg animate-pulse" style={{ animationDelay: "1s" }}>
            <span>🍱</span>
            <span>Hari Food • 1.2km</span>
          </div>
          <div className="absolute top-[35%] right-[16%] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F4C45]/90 border border-[#1E806F]/40 text-[10px] font-semibold text-[#E8F4F1] shadow-md">
            <span>🏪</span>
            <span>ABC Bakery</span>
          </div>
        </div>

        <div className="hero-content-wrap relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          
          {/* Eyebrow & Replay Intro Action */}
          <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 border border-white/25 text-[#E8F4F1] backdrop-blur-md shadow-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4CAF73] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4CAF73]" />
              </span>
              Food-Surplus Rescue Platform
            </span>

            <button
              type="button"
              onClick={() => setShowIntro(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#F5C451] hover:text-white bg-white/10 hover:bg-white/20 border border-[#F5C451]/30 backdrop-blur-md transition cursor-pointer"
              title="Watch the cinematic FoodSaver opening animation again"
            >
              <span>✨</span>
              <span>Watch Intro</span>
            </button>
          </div>

          {/* Main User-Requested Headline with subtle upward reveal */}
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight mb-4 leading-tight"
          >
            Save Great Food. <br className="hidden sm:inline" />
            <span className="text-[#F5C451]">
              Waste Less.
            </span>
          </motion.h1>

          {/* User-Requested Supporting Text */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="text-base sm:text-lg text-[#E8F4F1] max-w-2xl mx-auto mb-8 font-normal leading-relaxed"
          >
            Saving meals, empowering communities. Discover quality surplus food from nearby food partners at special prices before it goes to waste.
          </motion.p>

          {/* Two Actions matching button guidelines */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-8 w-full sm:w-auto">
            <button
              type="button"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide bg-[#FF9F43] hover:bg-[#E88A35] text-white shadow-[0_8px_25px_rgba(255,159,67,0.35)] transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-[#F08C2D]"
              onClick={() => navigate("/customer")}
            >
              <span>📍</span>
              <span>Explore Nearby Food</span>
              <span className="text-white text-xs">→</span>
            </button>

            <button
              type="button"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm tracking-wide bg-white hover:bg-[#E8F4F1] text-[#145C52] border border-white shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => navigate("/merchant/onboarding")}
            >
              <span>🏪</span>
              <span>Become a FoodSaver Partner</span>
            </button>
          </div>

          {/* DISCOVERY SEARCH CARD */}
          <div className="hero-discovery-card w-full max-w-2xl bg-white rounded-2xl shadow-xl p-2.5 flex flex-col sm:flex-row items-center gap-2 border border-[#DCE6E3] mb-8">
            <div className="discovery-location-selector flex items-center gap-1.5 px-3 py-2 text-[#102A2A] font-bold text-sm">
              <span className="pin-icon text-[#16796B]">📍</span>
              <strong>{city}</strong>
              <span className="arrow text-xs text-[#8A9693]">▾</span>
            </div>

            <div className="discovery-divider hidden sm:block w-px h-6 bg-[#DCE6E3]" />

            <div className="discovery-search-input-wrap flex-1 flex items-center gap-2 px-3 w-full">
              <span className="search-icon text-[#8A9693]">🔍</span>
              <input
                type="text"
                placeholder="Search food, cafés or nearby partners…"
                value={searchQuery}
                readOnly
                className="w-full bg-transparent text-[#102A2A] placeholder-[#8A9693] text-sm focus:outline-none cursor-pointer"
                onClick={() => {
                  document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            </div>

            <button
              type="button"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#145C52] hover:bg-[#16796B] text-white transition shadow-md cursor-pointer"
              onClick={() => {
                document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Search
            </button>
          </div>

          {/* 3. LIVE NEARBY FOOD DISCOVERY ANIMATION */}
          <div
            className="w-full max-w-3xl rounded-2xl p-4 sm:p-6"
            style={{
              background: "rgba(18, 30, 26, 0.8)",
              border: "1.5px solid rgba(105, 199, 168, 0.3)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2 text-left">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <strong className="text-sm sm:text-base text-white">Live Nearby Food Radar</strong>
                <span className="text-xs text-emerald-300 font-mono">({city})</span>
              </div>
              <span className="text-xs text-emerald-200/80 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Pulsing = Fresh Surplus Available
              </span>
            </div>

            {/* LIVE RADAR MAP CANVAS */}
            <div
              className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden flex items-center justify-center"
              style={{
                background: "radial-gradient(circle at center, #0f231e 0%, #081310 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Radar Circles */}
              <div className="absolute w-48 h-48 rounded-full border border-emerald-500/15 pointer-events-none" />
              <div className="absolute w-80 h-80 rounded-full border border-emerald-500/10 pointer-events-none" />
              <div className="absolute w-full h-px bg-emerald-500/10 pointer-events-none" />
              <div className="absolute h-full w-px bg-emerald-500/10 pointer-events-none" />

              {/* User Center Location */}
              <div className="relative z-10">
                <NearbyMarker isUser={true} name="You are here" distance="Current GPS" />
              </div>

              {/* Merchant Marker 1 — Top Left */}
              <div className="absolute top-8 left-8 sm:left-16 z-20">
                <NearbyMarker
                  name="Aarthi Hotel"
                  distance="850m"
                  category="Meals"
                  hasSurplus={true}
                  onClick={() => navigate("/customer")}
                />
              </div>

              {/* Merchant Marker 2 — Bottom Right */}
              <div className="absolute bottom-8 right-8 sm:right-20 z-20">
                <NearbyMarker
                  name="Hari Food Court"
                  distance="1.2 km"
                  category="Snacks"
                  hasSurplus={true}
                  onClick={() => navigate("/customer")}
                />
              </div>

              {/* Merchant Marker 3 — Top Right */}
              <div className="absolute top-10 right-12 sm:right-28 z-20">
                <NearbyMarker
                  name="Royal Bakery"
                  distance="1.6 km"
                  category="Bakery"
                  hasSurplus={true}
                  onClick={() => navigate("/customer")}
                />
              </div>

              {/* Floating Real-Time Surplus Alert Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="absolute bottom-3 left-3 sm:left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-amber-400/50 shadow-xl backdrop-blur-md cursor-pointer hover:border-amber-300"
                onClick={() => navigate("/customer")}
              >
                <span className="text-base">🍛</span>
                <div className="text-left leading-tight">
                  <strong className="text-xs text-white block">Fresh Meals Available</strong>
                  <span className="text-[10px] text-amber-300 font-bold">1.2 km away • Limited quantity</span>
                </div>
                <span className="text-emerald-300 text-xs ml-1">View →</span>
              </motion.div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. FOOD CATEGORIES ("What's on your mind?") */}
      <section className="categories-mind-section">
        <div className="section-title-wrap">
          <h2>What's on your mind?</h2>
          <span className="subtext-muted">Explore popular cuisines and local favorites</span>
        </div>

        <div className="categories-scroll-row">
          {PRE_LOGIN_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-item-circle ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <div className="circle-avatar">
                <span className="cat-emoji">{cat.emoji}</span>
              </div>
              <span className="cat-label">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 4. RESTAURANT DISCOVERY ("Restaurants near you") */}
      <section id="restaurants-grid-section" className="restaurants-discovery-section">
        <div className="section-head-with-sort">
          <div>
            <h2>Restaurants near you</h2>
            <p className="subtext-muted">Discover popular restaurants and local favorites.</p>
          </div>

          <div className="sort-dropdown-wrap">
            <label htmlFor="prelogin-sort" className="sort-label">Sort by:</label>
            <select
              id="prelogin-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select-input"
            >
              <option value="relevance">Relevance ▾</option>
              <option value="rating">Rating ▾</option>
              <option value="price_asc">Price: Low to High ▾</option>
              <option value="price_desc">Price: High to Low ▾</option>
            </select>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="filter-chips-scroll" style={{ marginTop: 14 }}>
          {PRE_LOGIN_FILTERS.map((f) => {
            const active = activeFilters.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={`filter-chip-btn ${active ? "active" : ""}`}
                onClick={() => toggleFilter(f.id)}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* RESTAURANT DISCOVERY CARDS (4 COLUMNS DESKTOP) */}
        {loading ? (
          <div className="restaurant-grid-4cols" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            <LoadingSkeleton type="card" count={4} height={170} />
          </div>
        ) : displayedHotels.length === 0 ? (
          <div className="empty-state card" style={{ padding: "36px 24px", textAlign: "center", border: "1.5px dashed rgba(245, 158, 11, 0.4)", borderRadius: 16 }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 8 }}>🍱</span>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: "0 0 6px" }}>No Restaurants Available for "{selectedCategory}"</h3>
            <p style={{ fontSize: 13.5, color: "#cbd5e1", maxWidth: 440, margin: "0 auto 14px", lineHeight: 1.5 }}>
              Check back later for fresh surplus food offers or choose another category filter.
            </p>
          </div>
        ) : (
          <div className="restaurant-grid-4cols" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, marginBottom: 36 }}>
            {displayedHotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                onSelectHotel={(h) => navigate(`/restaurant/${h.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. FEATURED RESTAURANTS ("Top picks for you") */}
      <section className="featured-top-picks-section">
        <div className="section-title-wrap">
          <h2>Top picks for you</h2>
          <span className="subtext-muted">Selected highly-rated restaurants and customer favorites</span>
        </div>

        <div className="restaurant-grid-4cols">
          {topPicks.map((listing) => (
            <ListingCard
              key={`top-${listing.id}`}
              listing={listing}
              onClaim={() => handleClaimClick(listing)}
            />
          ))}
        </div>
      </section>

      {/* 6. EXPLORE SECTION ("Explore restaurants around you") */}
      <section className="explore-around-section">
        <div className="section-title-wrap">
          <h2>Explore restaurants around you</h2>
          <span className="subtext-muted">Find the perfect place for every craving.</span>
        </div>

        <div className="explore-cards-grid">
          <button
            type="button"
            className="explore-action-card"
            onClick={() => {
              setSelectedCategory("All");
              document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="explore-card-icon">📍</span>
            <div className="explore-card-info">
              <strong>Explore restaurants near me</strong>
              <span>Browse top food spots in {city}</span>
            </div>
          </button>

          <button
            type="button"
            className="explore-action-card"
            onClick={() => {
              setSortBy("rating");
              document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="explore-card-icon">⭐</span>
            <div className="explore-card-info">
              <strong>Explore top-rated restaurants</strong>
              <span>Discover 4.5+ rated dining favorites</span>
            </div>
          </button>

          <button
            type="button"
            className="explore-action-card"
            onClick={() => {
              setSelectedCategory("South Indian");
              document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="explore-card-icon">🍕</span>
            <div className="explore-card-info">
              <strong>Explore by cuisine</strong>
              <span>Filter by Pizza, Biryani, Bakery & more</span>
            </div>
          </button>

          <button
            type="button"
            className="explore-action-card"
            onClick={() => {
              setActiveFilters(["offers"]);
              document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="explore-card-icon">🏷️</span>
            <div className="explore-card-info">
              <strong>Restaurants with offers</strong>
              <span>Save up to 50% on surplus meal deals</span>
            </div>
          </button>
        </div>
      </section>

      {/* 7. WHY USE OUR APP */}
      <section className="why-choose-us-section">
        <div className="section-title-wrap text-center">
          <h2>Everything you need for a better food experience</h2>
          <span className="subtext-muted">Why thousands of food lovers choose Food Saver</span>
        </div>

        <div className="why-features-grid">
          <div className="why-feature-card">
            <span className="feature-icon">🍽️</span>
            <h3>Thousands of food choices</h3>
            <p>Discover top local restaurants, bakeries, cafes, and cuisines around you.</p>
          </div>

          <div className="why-feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Fast & convenient</h3>
            <p>Find delicious food quickly, order easily, and track pickup in real time.</p>
          </div>

          <div className="why-feature-card">
            <span className="feature-icon">🎁</span>
            <h3>Great offers</h3>
            <p>Save more with daily restaurant deals and surplus food discounts.</p>
          </div>

          <div className="why-feature-card">
            <span className="feature-icon">🌿</span>
            <h3>Fresh local choices</h3>
            <p>Support local restaurants while reducing food waste one meal at a time.</p>
          </div>
        </div>
      </section>

      {/* 8. APP PROMOTION */}
      <section className="app-promotion-banner">
        <div className="promo-banner-inner">
          <div className="promo-text-col">
            <span className="eyebrow-coral">GET THE FOOD SAVER APP</span>
            <h2>Enjoy a better experience with our app</h2>
            <p>Order faster, track your delivery live, and discover new restaurants near you.</p>

            <div className="app-store-btns-row">
              <button
                type="button"
                className="btn btn-outline app-download-btn"
                onClick={() => alert("Google Play app link coming soon!")}
              >
                <span className="btn-icon">▶</span> Google Play
              </button>

              <button
                type="button"
                className="btn btn-outline app-download-btn"
                onClick={() => alert("Apple App Store link coming soon!")}
              >
                <span className="btn-icon">🍏</span> App Store
              </button>
            </div>
          </div>

          <div className="promo-visual-col">
            <div className="promo-mockup-frame" style={{ background: "linear-gradient(135deg, #2D3B37 0%, #24332F 100%)", borderRadius: 20, border: "2px solid rgba(245, 158, 11, 0.4)", padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
              <span style={{ fontSize: 48, marginBottom: 8, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>📱</span>
              <span style={{ fontSize: 13, color: "#FF9F68", fontWeight: 700, marginTop: 4 }}>Nearby Restaurants & Road Directions</span>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="marketplace-footer">
        <div className="footer-columns-grid">
          <div className="footer-brand-col">
            <div className="brand footer-monochrome-brand" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.png" alt="FoodSaver" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10 }} />
              <div className="brand-copy">
                <strong style={{ color: "#24332F", fontSize: 17 }}>FoodSaver</strong>
                <span style={{ color: "#66736F", fontSize: 11 }}>Good Food • Less Waste • A Greener Tomorrow</span>
              </div>
            </div>
            <p className="footer-desc">Your trusted food marketplace for fresh meals and deals.</p>
            <span className="footer-copyright">© 2026 Food Saver, Inc. All rights reserved.</span>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); alert("About Us page"); }}>About Us</a></li>
              <li><a href="#careers" onClick={(e) => { e.preventDefault(); alert("Careers page"); }}>Careers</a></li>
              <li><a href="#contact" onClick={(e) => { e.preventDefault(); alert("Contact page"); }}>Contact</a></li>
              <li><a href="#partner" onClick={(e) => { e.preventDefault(); navigate("/merchant/onboarding"); }}>Partner With Us</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>For Customers</h4>
            <ul>
              <li><a href="#help" onClick={(e) => { e.preventDefault(); alert("Help & Support"); }}>Help & Support</a></li>
              <li><a href="#privacy" onClick={(e) => { e.preventDefault(); alert("Privacy Policy"); }}>Privacy Policy</a></li>
              <li><a href="#terms" onClick={(e) => { e.preventDefault(); alert("Terms & Conditions"); }}>Terms & Conditions</a></li>
              <li><a href="#refund" onClick={(e) => { e.preventDefault(); alert("Refund Policy"); }}>Refund Policy</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>For Partners</h4>
            <ul>
              <li><a href="#register" onClick={(e) => { e.preventDefault(); navigate("/merchant/onboarding"); }}>Register Your Restaurant</a></li>
              <li><a href="#merchant-login" onClick={(e) => { e.preventDefault(); navigate("/login/merchant"); }}>Merchant Login</a></li>
              <li><a href="#ngo-partner" onClick={(e) => { e.preventDefault(); navigate("/ngo/onboarding"); }}>NGO Partner Registration</a></li>
              <li><a href="#support" onClick={(e) => { e.preventDefault(); alert("Partner Support"); }}>Partner Support</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><a href="#restaurants" onClick={(e) => { e.preventDefault(); document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" }); }}>Restaurants</a></li>
              <li><a href="#delivery" onClick={(e) => { e.preventDefault(); navigate("/customer"); }}>Food Delivery</a></li>
              <li><a href="#offers" onClick={(e) => { e.preventDefault(); document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" }); }}>Offers</a></li>
              <li><a href="#cuisines" onClick={(e) => { e.preventDefault(); document.getElementById("restaurants-grid-section")?.scrollIntoView({ behavior: "smooth" }); }}>Popular Cuisines</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-row">
          <div className="social-links-group">
            <span className="social-icon" title="Instagram">📷</span>
            <span className="social-icon" title="Facebook">📘</span>
            <span className="social-icon" title="LinkedIn">💼</span>
            <span className="social-icon" title="X">🐦</span>
          </div>
        </div>
      </footer>

      {/* CLAIM / PAYMENT MODAL */}
      {claimingListing && (
        <PaymentModal
          open={!!claimingListing}
          listing={claimingListing}
          onClose={() => setClaimingListing(null)}
          onComplete={async (listingObj, quantity, order) => {
            try {
              const custId = session?.userId || session?.id || session?.username || session?.email || "guest";
              const res = await api.claimListing(listingObj.id, {
                customerId: custId,
                customerName: session?.name || "Resident Customer",
                customerUsername: session?.username || "resident_customer",
                quantity: quantity || 1,
              });
              if (res && res.claim) {
                addMyClaim(res.claim, custId);
                return res;
              }
            } catch (e) {
              console.error("Claim error in PreLoginHome:", e);
            } finally {
              setClaimingListing(null);
              navigate("/customer/pickups");
            }
          }}
        />
      )}
    </PageTransition>
  );
}
