import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useRealtimeListings } from "../lib/useRealtimeListings.js";
import ListingCard from "../components/ListingCard.jsx";
import HotelCard from "../components/HotelCard.jsx";
import HotelDetailsModal from "../components/HotelDetailsModal.jsx";
import PaymentModal from "../components/PaymentModal.jsx";
import RecentlyAccessed from "../components/RecentlyAccessed.jsx";
import { api } from "../lib/api.js";
import { addMyClaim } from "../lib/myClaims.js";
import PageTransition from "../components/animations/PageTransition.jsx";
import LoadingSkeleton from "../components/animations/LoadingSkeleton.jsx";
import NightSaleSection from "../components/NightSaleSection.jsx";

const CATEGORIES = [
  "All",
  "Bakery",
  "Meals",
  "Snacks",
  "Desserts",
  "Beverages",
  "Fast Food",
  "Healthy",
  "Homemade",
];

const FILTER_CHIPS = [
  { id: "filters", label: "Filters" },
  { id: "offers", label: "Offers" },
  { id: "rating", label: "Rating: 4.5+" },
  { id: "pet", label: "Pet friendly" },
  { id: "outdoor", label: "Outdoor seating" },
  { id: "open", label: "Open Now" },
];

const POPULAR_CATEGORIES = [
  { id: "All", label: "All", emoji: "🍽️" },
  { id: "Bakery", label: "Pizza & Bakery", emoji: "🍕" },
  { id: "Meals", label: "Biryani & Meals", emoji: "🍛" },
  { id: "Snacks", label: "Burgers & Snacks", emoji: "🍔" },
  { id: "Healthy", label: "Healthy & Salads", emoji: "🥗" },
  { id: "Beverages", label: "Coffee & Tea", emoji: "☕" },
  { id: "Desserts", label: "Desserts", emoji: "🍰" },
];

export default function CustomerFeed({ searchQuery = "", city = "Kovilpatti" }) {
  const navigate = useNavigate();
  const { session } = useSession();
  const { listings, loading } = useRealtimeListings();
  const [claiming, setClaiming] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [mainTab, setMainTab] = useState("delivery"); // "dining" | "delivery"
  const [activeFilters, setActiveFilters] = useState([]);
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("relevance");

  function toggleFilter(id) {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const filteredListings = useMemo(() => {
    let result = listings.filter((listing) => {
      if (listing.status !== "active") return false;

      const matchesCategory =
        category === "All" || listing.category === category;

      const effectiveQuery = searchQuery.trim().toLowerCase();
      const matchesQuery = effectiveQuery
        ? `${listing.itemName} ${listing.merchantName} ${listing.hotelName || ""} ${listing.category} ${listing.address}`
            .toLowerCase()
            .includes(effectiveQuery)
        : true;

      const matchesOffers = activeFilters.includes("offers")
        ? listing.discountPrice < listing.originalPrice
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
  }, [listings, category, searchQuery, activeFilters, sortBy]);

  const [approvedHotels, setApprovedHotels] = useState([]);

  React.useEffect(() => {
    loadApprovedHotels();
  }, [listings]);

  async function loadApprovedHotels() {
    try {
      const res = await api.getHotels();
      if (res && res.hotels) {
        setApprovedHotels(res.hotels);
      }
    } catch (e) {
      console.error("Failed loading approved hotels", e);
    }
  }

  // Group filtered active listings by Hotel/Restaurant, prioritized by approved backend hotels
  const hotels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const map = new Map();

    // First populate from approvedHotels
    for (const h of approvedHotels) {
      // Find matching items for this hotel from filteredListings or h.items
      const hotelItems = (h.items || []).filter((item) => {
        if (item.status && item.status !== "active") return false;
        const matchesCategory = category === "All" || item.category === category || item.category?.toLowerCase().includes(category.toLowerCase());
        const matchesQuery = q
          ? `${item.itemName} ${item.description || ""} ${item.category}`.toLowerCase().includes(q)
          : true;
        const matchesOffers = activeFilters.includes("offers")
          ? item.discountPrice < item.originalPrice
          : true;
        return matchesCategory && matchesQuery && matchesOffers;
      });

      const matchesHotelMeta = q
        ? h.hotelName.toLowerCase().includes(q) || h.cuisine?.toLowerCase().includes(q) || h.address?.toLowerCase().includes(q)
        : true;
      const matchesCategoryMeta = category === "All" || h.cuisine?.toLowerCase().includes(category.toLowerCase()) || hotelItems.length > 0;

      if (matchesHotelMeta && matchesCategoryMeta) {
        map.set(h.id, {
          ...h,
          items: hotelItems.length > 0 ? hotelItems : (h.items || []),
        });
      }
    }

    // Add any remaining items from filteredListings whose merchant/hotel isn't in approvedHotels map yet
    for (const item of filteredListings) {
      const key = item.hotelId || item.merchantId || item.merchantUsername || item.merchantName || item.hotelName || "hotel";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          merchantId: key,
          hotelName: item.hotelName || item.merchantName || "Local Partner Hotel",
          logo: item.imageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80",
          coverImage: item.imageUrl || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
          rating: 4.5,
          cuisine: item.category ? `${item.category} • Deals` : "South Indian • Bakery",
          address: item.address || city,
          openingHours: `${item.pickupWindowStart || "18:00"} - ${item.pickupWindowEnd || "22:00"}`,
          items: [],
        });
      }
      const hotelObj = map.get(key);
      if (!hotelObj.items.some((existing) => existing.id === item.id)) {
        hotelObj.items.push(item);
      }
    }

    let result = Array.from(map.values());
    if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
    }
    return result;
  }, [approvedHotels, filteredListings, category, searchQuery, activeFilters, sortBy, city]);

  return (
    <PageTransition className="app-main discover-page marketplace-discovery-layout">
      {/* BREADCRUMB */}
      <nav className="subtle-breadcrumb" aria-label="Breadcrumb">
        <span>Home</span>
        <span className="crumb-slash">/</span>
        <span>India</span>
        <span className="crumb-slash">/</span>
        <strong className="crumb-current">{city} Restaurants & Deals</strong>
      </nav>

      {/* RECENTLY ACCESSED ITEMS */}
      <RecentlyAccessed />

      {/* NEARBY 2KM FOOD RADAR QUICK BANNER */}
      <div
        onClick={() => navigate("/customer/nearby-food")}
        style={{
          margin: "12px 0 20px",
          padding: "14px 18px",
          background: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(13,148,136,0.2) 100%)",
          borderRadius: "18px",
          border: "1px solid rgba(16, 185, 129, 0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(16, 185, 129, 0.12)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        className="hover:scale-[1.01] hover:shadow-emerald-500/20"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              background: "rgba(16, 185, 129, 0.25)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 900, color: "#ffffff" }}>
                Location-Aware Food Radar (Within 2 km)
              </h3>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  background: "#69C7A8",
                  color: "#022c22",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  textTransform: "uppercase",
                }}
              >
                Live Radar
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#cbd5e1" }}>
              Find discounted surplus meals, bakery items & snacks closest to you right now.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/customer/nearby-food");
          }}
          style={{
            background: "linear-gradient(135deg, #69C7A8, #0d9488)",
            color: "#022c22",
            fontWeight: 900,
            fontSize: "12px",
            padding: "8px 16px",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          Explore 2 km Deals →
        </button>
      </div>

      {/* DEDICATED NIGHT-TIME SURPLUS FOOD FLASH SALE SECTION */}
      <NightSaleSection searchQuery={searchQuery} city={city} />

      {/* MAIN CATEGORY NAVIGATION */}
      <div className="primary-category-nav">
        <button
          type="button"
          className={`primary-tab ${mainTab === "dining" ? "active" : ""}`}
          onClick={() => setMainTab("dining")}
        >
          <div className="tab-icon-circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
          </div>
          <span className="tab-title">Dining</span>
        </button>

        <button
          type="button"
          className={`primary-tab ${mainTab === "delivery" ? "active" : ""}`}
          onClick={() => setMainTab("delivery")}
        >
          <div className="tab-icon-circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <span className="tab-title">Delivery & Pickup</span>
        </button>
      </div>

      {/* FILTER BAR CHIPS */}
      <div className="filter-chips-scroll">
        {FILTER_CHIPS.map((chip) => {
          const active = activeFilters.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              className={`filter-chip-btn ${active ? "active" : ""}`}
              onClick={() => toggleFilter(chip.id)}
            >
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* PROMOTIONAL HERO BANNER */}
      <div className="promo-hero-card">
        <div className="promo-left-copy">
          <span className="promo-eyebrow">FOOD SAVER MARKETPLACE</span>
          <h1 className="promo-headline">Great Food. Better Prices. Less Waste.</h1>
          <div className="promo-discount-badge">Up to 50% OFF & More</div>
          <p className="promo-subtext">
            Discover fresh surplus food from top verified hotels and restaurants in {city}.
          </p>
          <button
            type="button"
            className="btn btn-amber promo-cta-btn"
            onClick={() => {
              document
                .getElementById("surplus-deals-section")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Explore Live Food Deals →
          </button>
        </div>

        <div className="promo-right-visual" style={{ background: "linear-gradient(135deg, #2D3B37 0%, #24332F 100%)", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(245,158,11,0.3)", padding: 24, textAlign: "center" }}>
          <span style={{ fontSize: 48, marginBottom: 8, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>
            🍱
          </span>
          <strong style={{ fontSize: 18, color: "#ffffff", fontWeight: 800 }}>
            Live Surplus Food Deals
          </strong>
          <span style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>
            Direct Kitchen Surplus
          </span>
        </div>
      </div>

      {/* POPULAR CATEGORIES SECTION */}
      <div className="popular-categories-section">
        <div className="categories-header-title">Popular near you</div>
        <div className="category-pill-row">
          {POPULAR_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`category-pill ${category === c.id ? "active" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1. LIVE SURPLUS FOOD DEALS SECTION */}
      <div id="surplus-deals-section" style={{ marginTop: 32, marginBottom: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>
              ⚡ Live Surplus Food Deals ({filteredListings.length})
            </h2>
            <p className="subtext-muted" style={{ margin: 0 }}>
              {category === "All" ? "Fresh daily surplus deals available for instant pickup & delivery" : `${category} surplus deals near you`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="restaurant-grid-3cols">
            <LoadingSkeleton type="card" count={3} />
          </div>
        ) : filteredListings.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {filteredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onClaim={(item) => setClaiming(item)}
              />
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: "32px 20px", textAlign: "center", border: "1.5px dashed rgba(245, 158, 11, 0.4)", borderRadius: 16, background: "rgba(36, 51, 47, 0.6)" }}>
            <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>🍛</span>
            <h4 style={{ color: "#ffffff", margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>
              No surplus food deals match "{category}"
            </h4>
            <p style={{ margin: "0 0 14px", color: "#cbd5e1", fontSize: 13.5 }}>
              Try selecting "All" or exploring partner hotels below!
            </p>
            <button type="button" className="btn btn-amber" onClick={() => setCategory("All")} style={{ fontSize: 13, padding: "8px 16px" }}>
              View All Food Deals
            </button>
          </div>
        )}
      </div>

      {/* 2. RESTAURANT LISTINGS FEED HEADER & SORT */}
      <div
        id="restaurants-feed-grid"
        className="section-head-with-sort"
        style={{ marginTop: 24 }}
      >
        <div>
          <h2>Verified Hotels & Restaurants ({hotels.length})</h2>
          <p className="subtext-muted">
            Explore verified partner hotels with live surplus deals in {city}
          </p>
        </div>

        <div className="sort-dropdown-wrap">
          <label htmlFor="sortSelect" className="sort-label">Sort by:</label>
          <select
            id="sortSelect"
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

      {loading && (
        <div className="restaurant-grid-3cols">
          <LoadingSkeleton type="card" count={3} />
        </div>
      )}

      {!loading && hotels.length === 0 && (
        <div className="empty-state card" style={{ padding: "42px 24px", textAlign: "center", border: "1.5px dashed rgba(245, 158, 11, 0.4)", borderRadius: 16 }}>
          <span style={{ fontSize: 44, display: "block", marginBottom: 10 }}>🍱</span>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", margin: "0 0 8px" }}>
            No Food Available
          </h3>
          <p style={{ fontSize: 14, color: "#cbd5e1", maxWidth: 480, margin: "0 auto 18px", lineHeight: 1.6 }}>
            Check back later for fresh surplus food offers from verified hotels and restaurants. Merchants post their end-of-day food deals during closing hours.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-amber"
              onClick={() => {
                setCategory("All");
                setActiveFilters([]);
                window.location.reload();
              }}
            >
              🔄 Refresh Available Food
            </button>
          </div>
        </div>
      )}

      {/* ZOMATO / SWIGGY STYLE HOTEL CARDS GRID */}
      {hotels.length > 0 && (
        <div className="restaurant-grid-3cols">
          {hotels.map((hotel) => (
            <HotelCard
              key={hotel.id}
              hotel={hotel}
              onSelectHotel={(h) => navigate(`/restaurant/${h.id}`)}
            />
          ))}
        </div>
      )}

      {/* HOTEL DETAILS MODAL */}
      {selectedHotel && (
        <HotelDetailsModal
          hotel={selectedHotel}
          onClose={() => setSelectedHotel(null)}
          onClaimListing={(listingObj) => {
            setSelectedHotel(null);
            setClaiming(listingObj);
          }}
        />
      )}

      {/* PAYMENT & CLAIM MODAL */}
      {claiming && (
        <PaymentModal
          open={!!claiming}
          listing={claiming}
          onClose={() => setClaiming(null)}
          onComplete={async (listingObj, quantity, order) => {
            try {
              const custId = session?.userId || session?.id || session?.username || session?.email || "guest";
              const res = await api.claimListing(listingObj.id, {
                customerId: custId,
                customerName: session?.name || "Resident Customer",
                customerUsername: session?.username || "resident_customer",
                quantity,
              });
              if (res && res.claim) {
                addMyClaim(res.claim, custId);
                return res;
              }
            } catch (e) {
              console.error("Claim failed:", e);
            }
          }}
        />
      )}
    </PageTransition>
  );
}

