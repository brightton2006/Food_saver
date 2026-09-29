import React, { useState, useMemo } from "react";

const FOOD_TAGS = [
  "All",
  "Biryani",
  "Dosa",
  "Meals",
  "Chicken",
  "Bakery",
  "Pizza",
  "Snacks",
  "Vegetarian",
  "Non-Vegetarian",
];

const RADIUS_OPTIONS = [
  { value: 1.0, label: "1 KM" },
  { value: 2.0, label: "2 KM", isDefault: true },
  { value: 5.0, label: "5 KM" },
  { value: 10.0, label: "10 KM" },
];

/**
 * NearbySearch
 * Google Maps-style top search bar for FoodSaver.
 * Combines food type, dish name, merchant name, and live proximity calculations.
 *
 * @param {Object} props
 * @param {string} props.searchQuery
 * @param {Function} props.onSearchChange
 * @param {number} props.radiusKm
 * @param {Function} props.onRadiusChange
 * @param {Array<Object>} props.merchants
 * @param {Array<Object>} props.foodItems
 * @param {Function} props.onSelectMerchant
 * @param {Function} props.onDirections
 */
export default function NearbySearch({
  searchQuery = "",
  onSearchChange,
  radiusKm = 2.0,
  onRadiusChange,
  merchants = [],
  foodItems = [],
  onSelectMerchant = null,
  onDirections = null,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [activeTag, setActiveTag] = useState("All");

  // Filtered autocomplete matching results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && activeTag === "All") return [];

    const effectiveQuery = q || (activeTag !== "All" ? activeTag.toLowerCase() : "");

    // 1. Matching merchants
    const matchingMerchants = merchants
      .filter((m) => {
        const name = (m.businessName || m.hotelName || "").toLowerCase();
        const cuisine = (m.cuisine || "").toLowerCase();
        const address = (m.address || "").toLowerCase();
        return name.includes(effectiveQuery) || cuisine.includes(effectiveQuery) || address.includes(effectiveQuery);
      })
      .map((m) => ({
        type: "merchant",
        id: m.id || m.hotelId,
        title: m.businessName || m.hotelName,
        subtitle: `${m.cuisine || "Restaurant"} • ${m.address || "Kovilpatti"}`,
        distanceText: m.distanceText || (m.distance ? `${m.distance} km` : "Nearby"),
        estimatedMinutes: m.estimatedMinutes || (m.distance ? Math.max(2, Math.round(m.distance * 2.5)) : 5),
        availableFoodCount: m.availableFoodCount || 0,
        raw: m,
      }));

    // 2. Matching food items
    const matchingFoods = foodItems
      .filter((f) => {
        const fName = (f.itemName || f.foodName || "").toLowerCase();
        const desc = (f.description || "").toLowerCase();
        const cat = (f.category || "").toLowerCase();
        const mName = (f.hotelName || f.merchantName || "").toLowerCase();
        return (
          fName.includes(effectiveQuery) ||
          desc.includes(effectiveQuery) ||
          cat.includes(effectiveQuery) ||
          mName.includes(effectiveQuery)
        );
      })
      .slice(0, 6)
      .map((f) => ({
        type: "food",
        id: f.id,
        title: f.itemName || f.foodName,
        subtitle: `${f.hotelName || f.merchantName} • ₹${f.price || f.discountPrice}`,
        distanceText: f.distanceText || (f.distance ? `${f.distance} km` : "Nearby"),
        estimatedMinutes: f.estimatedMinutes || (f.distance ? Math.max(2, Math.round(f.distance * 2.5)) : 5),
        raw: f,
      }));

    return [...matchingMerchants, ...matchingFoods].slice(0, 8);
  }, [searchQuery, activeTag, merchants, foodItems]);

  const handleTagClick = (tag) => {
    setActiveTag(tag);
    if (tag === "All") {
      onSearchChange("");
    } else {
      onSearchChange(tag);
    }
  };

  const clearSearch = () => {
    onSearchChange("");
    setActiveTag("All");
  };

  return (
    <div className="nearby-search-component" style={{ position: "relative", zIndex: 1100, width: "100%", fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Top Search Bar & Radius Controls */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "10px 14px",
          border: "1px solid #DCE6E3",
          boxShadow: "0 8px 25px rgba(20, 92, 82, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Input Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "#16796B" }}>🔍</span>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (activeTag !== "All") setActiveTag("All");
            }}
            onFocus={() => setIsFocused(true)}
            placeholder="Search restaurants, food or places..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#102A2A",
              fontSize: "14px",
              fontWeight: 600,
            }}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                background: "#F3F9F7",
                border: "1px solid #DCE6E3",
                borderRadius: "50%",
                width: "22px",
                height: "22px",
                color: "#687674",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                cursor: "pointer",
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}

          {/* Radius Selector Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", paddingLeft: "6px", borderLeft: "1px solid #DCE6E3" }}>
            {RADIUS_OPTIONS.map((opt) => {
              const active = Number(radiusKm) === Number(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onRadiusChange(opt.value)}
                  style={{
                    background: active ? "#145C52" : "#F3F9F7",
                    color: active ? "#ffffff" : "#687674",
                    border: active ? "none" : "1px solid #DCE6E3",
                    borderRadius: "10px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Food Tag Chips Scrollable Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingTop: "2px",
          }}
        >
          {FOOD_TAGS.map((tag) => {
            const active = activeTag.toLowerCase() === tag.toLowerCase() || searchQuery.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                style={{
                  background: active ? "#E8F4F1" : "#FFFFFF",
                  color: active ? "#145C52" : "#687674",
                  border: active ? "1.5px solid #16796B" : "1px solid #DCE6E3",
                  borderRadius: "12px",
                  padding: "3px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Autocomplete Dropdown Panel (when input is focused and has matching results) */}
      {isFocused && searchResults.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #DCE6E3",
            boxShadow: "0 16px 36px rgba(20, 92, 82, 0.12)",
            overflow: "hidden",
            maxHeight: "320px",
            overflowY: "auto",
            zIndex: 1200,
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #DCE6E3", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F7F9F8" }}>
            <span style={{ fontSize: "11px", color: "#145C52", fontWeight: 800 }}>
              NEARBY SEARCH RESULTS ({searchResults.length})
            </span>
            <button
              type="button"
              onClick={() => setIsFocused(false)}
              style={{ background: "transparent", border: "none", color: "#687674", fontSize: "11px", cursor: "pointer", fontWeight: 700 }}
            >
              Close ✕
            </button>
          </div>

          {searchResults.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => {
                if (item.type === "merchant" && onSelectMerchant) {
                  onSelectMerchant(item.raw);
                } else if (item.type === "food" && onSelectMerchant) {
                  const merch = merchants.find((m) => String(m.id || m.hotelId) === String(item.raw.hotelId || item.raw.merchantId));
                  if (merch) onSelectMerchant(merch);
                }
                setIsFocused(false);
              }}
              style={{
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #F3F9F7",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#E8F4F1")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{item.type === "merchant" ? "🏪" : "🍱"}</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#102A2A" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "#687674" }}>
                    {item.subtitle}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", textAlign: "right" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#145C52" }}>
                    {item.distanceText}
                  </div>
                  <div style={{ fontSize: "10px", color: "#687674" }}>
                    ~{item.estimatedMinutes} min
                  </div>
                </div>

                {onDirections && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const target = item.type === "merchant" ? item.raw : merchants.find((m) => String(m.id || m.hotelId) === String(item.raw.hotelId || item.raw.merchantId));
                      if (target && onDirections) onDirections(target);
                      setIsFocused(false);
                    }}
                    style={{
                      background: "#E8F4F1",
                      border: "1px solid #16796B",
                      color: "#145C52",
                      borderRadius: "8px",
                      padding: "5px 10px",
                      fontSize: "11px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Route
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
