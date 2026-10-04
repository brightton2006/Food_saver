import React, { useState, useEffect, useRef } from "react";
import { searchLocationsBackend } from "../services/locationService.js";

const CATEGORY_TAGS = [
  { id: "All", label: "All Restaurants" },
  { id: "Vegetarian", label: "Vegetarian" },
  { id: "Non-Vegetarian", label: "Non-Vegetarian" },
  { id: "Biryani", label: "Biryani" },
  { id: "Bakery", label: "Bakery" },
  { id: "Cafe", label: "Cafe" },
  { id: "Meals", label: "Meals" },
];

const RADIUS_OPTIONS = [
  { value: 1.0, label: "1 km" },
  { value: 2.0, label: "2 km" },
  { value: 5.0, label: "5 km" },
  { value: 10.0, label: "10 km" },
  { value: 25.0, label: "25 km" },
];

/**
 * NearbySearch
 * Real-world location, hotel, and restaurant search bar.
 * Autocompletes places in Tamil Nadu, PIN codes, streets, and approved FoodSaver partners.
 */
export default function NearbySearch({
  searchQuery = "",
  onSearchChange,
  radiusKm = 2.0,
  onRadiusChange,
  selectedCategory = "All",
  onCategoryChange = null,
  merchants = [],
  foodItems = [],
  onSelectMerchant = null,
  onSelectLocation = null,
  onClearToCurrentLocation = null,
  onDirections = null,
  userLocation = null,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [backendResults, setBackendResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef(null);

  // Debounced backend search for places, towns, streets, districts, and merchants
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setBackendResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const uLat = userLocation?.latitude || null;
        const uLng = userLocation?.longitude || null;
        const results = await searchLocationsBackend(q, uLat, uLng, radiusKm);
        setBackendResults(results);
      } catch (err) {
        console.warn("Backend search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, userLocation?.latitude, userLocation?.longitude, radiusKm]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTagClick = (tagId) => {
    if (onCategoryChange) {
      onCategoryChange(tagId);
    }
    if (tagId === "All") {
      onSearchChange("");
    } else {
      onSearchChange(tagId);
    }
  };

  const handleClear = () => {
    onSearchChange("");
    if (onCategoryChange) onCategoryChange("All");
    if (onClearToCurrentLocation) onClearToCurrentLocation();
  };

  // Combine matching local merchants with backend results
  const combinedResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    // Local matching merchants
    const localMatches = merchants
      .filter((m) => {
        const name = (m.businessName || m.hotelName || "").toLowerCase();
        const cuisine = (m.cuisine || m.category || "").toLowerCase();
        const addr = (m.address || "").toLowerCase();
        return name.includes(q) || cuisine.includes(q) || addr.includes(q);
      })
      .map((m) => ({
        type: "merchant",
        id: m.id || m.hotelId,
        title: m.businessName || m.hotelName,
        subtitle: `${m.cuisine || "Restaurant"} • ${m.address || "Kovilpatti"}`,
        distanceText: m.distanceText || (m.distance ? `${m.distance} km` : "Nearby"),
        lat: Number(m.latitude || m.lat),
        lng: Number(m.longitude || m.lng),
        raw: m,
      }));

    // Deduplicate backend results against local merchants
    const localIds = new Set(localMatches.map((m) => String(m.id)));
    const filteredBackend = backendResults.filter(
      (b) => !localIds.has(String(b.id))
    );

    return [...localMatches, ...filteredBackend].slice(0, 10);
  }, [searchQuery, merchants, backendResults]);

  return (
    <div
      ref={containerRef}
      className="nearby-search-component"
      style={{
        position: "relative",
        zIndex: 1100,
        width: "100%",
        fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Search Input Bar */}
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
        {/* Row 1: Search Input + Radius Selectors */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px", color: "#16796B" }}>🔍</span>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search hotel name, street, area, city, or PIN code..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#102A2A",
              fontSize: "13px",
              fontWeight: 600,
            }}
          />

          {isSearching && (
            <span style={{ fontSize: "11px", color: "#16796B", fontWeight: 700 }}>
              Searching...
            </span>
          )}

          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
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
              title="Clear search and return to current location"
            >
              ✕
            </button>
          )}

          {/* Radius Selector Pills (1, 2, 5, 10, 25 km) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              paddingLeft: "6px",
              borderLeft: "1px solid #DCE6E3",
            }}
          >
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
                  title={`Set discovery radius to ${opt.label}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Category Chips (Vegetarian, Non-Vegetarian, Biryani, Bakery, Cafe, Meals, All) */}
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
          {CATEGORY_TAGS.map((tag) => {
            const active =
              selectedCategory.toLowerCase() === tag.id.toLowerCase() ||
              searchQuery.toLowerCase() === tag.label.toLowerCase();
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleTagClick(tag.id)}
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
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isFocused && searchQuery.trim().length >= 2 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #DCE6E3",
            boxShadow: "0 16px 36px rgba(20, 92, 82, 0.15)",
            overflow: "hidden",
            maxHeight: "340px",
            overflowY: "auto",
            zIndex: 1200,
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              borderBottom: "1px solid #DCE6E3",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F7F9F8",
            }}
          >
            <span style={{ fontSize: "11px", color: "#145C52", fontWeight: 800 }}>
              SEARCH SUGGESTIONS ({combinedResults.length})
            </span>
            <button
              type="button"
              onClick={() => setIsFocused(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#687674",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Close ✕
            </button>
          </div>

          {combinedResults.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#687674", fontSize: "12px" }}>
              <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>🔍</span>
              No places or restaurants found for "{searchQuery}". Try a nearby town or area.
            </div>
          ) : (
            combinedResults.map((item) => {
              const isLocation = item.type === "location";
              const isMerchant = item.type === "merchant";
              const icon = isLocation ? "📍" : item.raw?.isFoodSaverPartner !== false ? "🍱" : "🍽️";

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    if (isLocation && onSelectLocation) {
                      onSelectLocation({
                        latitude: item.lat,
                        longitude: item.lng,
                        address: item.subtitle || item.title,
                        displayName: item.title,
                      });
                      onSearchChange(item.title);
                    } else if (isMerchant && onSelectMerchant) {
                      onSelectMerchant(item.raw);
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
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "16px" }}>{icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#102A2A",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#687674",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "10px" }}>
                    {item.distanceText && (
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#145C52", whiteSpace: "nowrap" }}>
                        {item.distanceText}
                      </span>
                    )}

                    {isLocation ? (
                      <span
                        style={{
                          background: "#E8F4F1",
                          color: "#145C52",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Move Map
                      </span>
                    ) : (
                      onDirections && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDirections && item.raw) onDirections(item.raw);
                            setIsFocused(false);
                          }}
                          style={{
                            background: "#E8F4F1",
                            border: "1px solid #16796B",
                            color: "#145C52",
                            borderRadius: "8px",
                            padding: "4px 8px",
                            fontSize: "10px",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Get Directions
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
