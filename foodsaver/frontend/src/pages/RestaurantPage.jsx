import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useCart } from "../lib/cart.jsx";
import { useToasts } from "../lib/useToasts.js";
import FloatingCartBar from "../components/FloatingCartBar.jsx";

const CATEGORIES = [
  "All",
  "Recommended",
  "Starters",
  "Main Course",
  "Biryani",
  "South Indian",
  "Beverages",
  "Desserts",
];

export default function RestaurantPage() {
  const { hotelId } = useParams();
  const navigate = useNavigate();
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useCart();
  const { pushToast } = useToasts();

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    async function loadHotel() {
      try {
        setLoading(true);
        const res = await api.getHotel(hotelId);
        setHotel(res.hotel);
      } catch (err) {
        console.error("Failed to load restaurant:", err);
      } finally {
        setLoading(false);
      }
    }
    if (hotelId) {
      loadHotel();
    }
  }, [hotelId]);

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 44, height: 44, border: "4px solid rgba(245, 158, 11, 0.2)", borderTopColor: "#FF9F68", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Loading Restaurant Menu...</h3>
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div style={{ minHeight: "60vh", padding: 32, textAlign: "center", color: "#ffffff" }}>
        <h2>Restaurant Not Found</h2>
        <p style={{ color: "#8A9490" }}>The restaurant you requested could not be located.</p>
        <button type="button" className="btn btn-amber" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
          ← Back to All Restaurants
        </button>
      </div>
    );
  }

  const items = hotel.items || [];

  // Filter items by category & search query
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "All" ||
      (selectedCategory === "Recommended" && (item.rating >= 4.5 || item.category === "Biryani")) ||
      (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="restaurant-page-container" style={{ minHeight: "100vh", background: "#0b0f19", color: "#ffffff", paddingBottom: 110 }}>
      {/* RESTAURANT HEADER BANNER */}
      <div style={{ position: "relative", width: "100%", height: 260, background: "#2D3B37", overflow: "hidden" }}>
        <img
          src={hotel.coverImage || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"}
          alt={hotel.hotelName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(11,15,25,0.95) 100%)" }} />

        {/* BACK BUTTON */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "rgba(0,0,0,0.65)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            zIndex: 10,
          }}
        >
          ← Back
        </button>

        {/* RESTAURANT PROFILE METADATA */}
        <div className="container" style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", width: "100%", display: "flex", alignItems: "flex-end", gap: 20, padding: "0 20px" }}>
          <div style={{ width: 88, height: 88, borderRadius: 20, border: "3px solid #0b0f19", overflow: "hidden", background: "#ffffff", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", flexShrink: 0 }}>
            <img
              src={hotel.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80"}
              alt={hotel.hotelName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>
                {hotel.hotelName}
              </h1>
              <span style={{ background: "#145C52", color: "#ffffff", padding: "4px 12px", borderRadius: 10, fontSize: 13, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 4 }}>
                ★ {hotel.rating || 4.2}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#cbd5e1", marginTop: 6, flexWrap: "wrap", fontWeight: 600 }}>
              <span>⏱️ {hotel.deliveryTime || "10–15 mins"}</span>
              <span>•</span>
              <span>📍 {hotel.location || hotel.address || "Rajagopalapuram"}</span>
              <span>•</span>
              <span style={{ color: "#FF9F68", fontWeight: 700 }}>{hotel.cuisine || "Indian • South Indian"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 1100, margin: "24px auto 0", padding: "0 20px" }}>
        {/* SEARCH BOX & CATEGORY FILTER SECTION */}
        <div style={{ marginBottom: 28 }}>
          {/* SEARCH BOX */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <input
              type="text"
              placeholder={`Search food items in ${hotel.hotelName}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 44px 14px 48px",
                borderRadius: 14,
                background: "#2D3B37",
                border: "1.5px solid rgba(245, 158, 11, 0.3)",
                color: "#ffffff",
                fontSize: 15,
                outline: "none",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              }}
            />
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#8A9490" }}>
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#8A9490", cursor: "pointer", fontSize: 16 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* CATEGORIES PILLS */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 20,
                    fontSize: 13.5,
                    fontWeight: active ? 800 : 600,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: active ? "1.5px solid #FF9F68" : "1px solid #66736F",
                    background: active ? "rgba(245, 158, 11, 0.2)" : "#2D3B37",
                    color: active ? "#FF9F68" : "#cbd5e1",
                    boxShadow: active ? "0 2px 10px rgba(245,158,11,0.25)" : "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* FOOD ITEMS LISTING HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#ffffff" }}>
            {selectedCategory === "All" ? "Menu Items" : selectedCategory} ({filteredItems.length})
          </h2>
          <span style={{ fontSize: 13, color: "#8A9490" }}>
            Showing items from {hotel.hotelName}
          </span>
        </div>

        {/* FOOD CARDS GRID */}
        {filteredItems.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", background: "#2D3B37", borderRadius: 18, border: "1.5px dashed rgba(245, 158, 11, 0.3)" }}>
            <span style={{ fontSize: 44, display: "block", marginBottom: 12 }}>🍽️</span>
            <h3 style={{ margin: "0 0 6px", fontSize: 20, color: "#ffffff" }}>No matching food items</h3>
            <p style={{ margin: 0, color: "#8A9490", fontSize: 14 }}>Try searching for a different item or select another category filter.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {filteredItems.map((item) => {
              const inCartItem = cartItems.find((c) => c.listing.id === item.id);
              const qty = inCartItem ? inCartItem.quantity : 0;
              const isVeg = item.isVeg !== undefined ? item.isVeg : true;

              return (
                <div
                  key={item.id}
                  style={{
                    background: "#2D3B37",
                    borderRadius: 18,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
                    transition: "transform 0.2s ease, boxShadow 0.2s ease",
                  }}
                >
                  {/* FOOD CARD IMAGE HEADER */}
                  <div style={{ position: "relative", height: 180, overflow: "hidden", background: "#24332F" }}>
                    <img
                      src={item.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80"}
                      alt={item.itemName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 100%)" }} />

                    {/* VEG / NON-VEG BADGE */}
                    <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.75)", padding: "4px 10px", borderRadius: 8, backdropFilter: "blur(4px)", border: `1px solid ${isVeg ? "#69C7A8" : "#C94C4C"}` }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: isVeg ? "#69C7A8" : "#C94C4C", display: "inline-block" }} />
                      <span style={{ fontSize: 11, fontWeight: 900, color: isVeg ? "#69C7A8" : "#C94C4C", textTransform: "uppercase" }}>
                        {isVeg ? "VEG" : "NON-VEG"}
                      </span>
                    </div>

                    {/* RATING BADGE */}
                    <div style={{ position: "absolute", top: 12, right: 12, background: "#145C52", color: "#ffffff", padding: "3px 8px", borderRadius: 8, fontSize: 11.5, fontWeight: 900 }}>
                      ★ {item.rating || 4.5}
                    </div>

                    {/* PRICE OVERLAY */}
                    <div style={{ position: "absolute", bottom: 10, left: 14, display: "flex", alignItems: "baseline", gap: 8 }}>
                      <strong style={{ fontSize: 20, color: "#ffffff", fontWeight: 900, textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}>
                        ₹{item.discountPrice}
                      </strong>
                      {item.originalPrice > item.discountPrice && (
                        <span style={{ fontSize: 13, color: "#cbd5e1", textDecoration: "line-through", textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}>
                          ₹{item.originalPrice}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* FOOD CARD BODY */}
                  <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
                        {item.itemName}
                      </h3>
                      <p style={{ margin: 0, fontSize: 12.5, color: "#8A9490", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.description || `${item.itemName} prepared fresh at ${hotel.hotelName}`}
                      </p>
                    </div>

                    {/* ADD TO CART / STEPPER CONTROL */}
                    <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#FF9F68", fontWeight: 700 }}>
                        {item.category || "Meals"}
                      </span>

                      {qty === 0 ? (
                        <button
                          type="button"
                          className="btn btn-amber"
                          onClick={() => {
                            addToCart(item, 1);
                            pushToast(`✓ ${item.itemName} added to cart`, "success");
                          }}
                          style={{
                            padding: "8px 20px",
                            fontSize: 13.5,
                            fontWeight: 900,
                            borderRadius: 10,
                            boxShadow: "0 3px 12px rgba(245, 158, 11, 0.3)",
                          }}
                        >
                          + ADD
                        </button>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            background: "#24332F",
                            border: "1.5px solid #FF9F68",
                            borderRadius: 10,
                            overflow: "hidden",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (qty === 1) {
                                removeFromCart(item.id);
                              } else {
                                updateQuantity(item.id, qty - 1);
                              }
                            }}
                            style={{
                              background: "rgba(245, 158, 11, 0.25)",
                              border: "none",
                              color: "#FF9F68",
                              fontWeight: 900,
                              fontSize: 16,
                              width: 32,
                              height: 32,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            −
                          </button>
                          <span style={{ padding: "0 12px", color: "#ffffff", fontWeight: 900, fontSize: 14 }}>
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, qty + 1)}
                            style={{
                              background: "rgba(245, 158, 11, 0.25)",
                              border: "none",
                              color: "#FF9F68",
                              fontWeight: 900,
                              fontSize: 16,
                              width: 32,
                              height: 32,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FLOATING BOTTOM CART BAR */}
      <FloatingCartBar hotelName={hotel.hotelName} />
    </div>
  );
}
