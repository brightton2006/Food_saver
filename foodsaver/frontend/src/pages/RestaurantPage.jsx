import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { api } from "../lib/api.js";
import { useCart } from "../lib/cart.jsx";
import { useSession } from "../lib/session.jsx";
import { useToasts } from "../lib/useToasts.js";
import FloatingCartBar from "../components/FloatingCartBar.jsx";
import { openDirections, getCurrentLocation } from "../services/locationService.js";

const CATEGORIES = [
  "All",
  "Recommended",
  "Meals",
  "Biryani",
  "Vegetarian",
  "Non-Vegetarian",
  "Bakery",
  "Sweets",
  "Beverages",
];

// Leaflet DivIcon for Restaurant Pin
function getPinIcon(isPartner) {
  return L.divIcon({
    className: "custom-hotel-pin",
    html: `
      <div style="
        background: ${isPartner ? "#145C52" : "#475569"};
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      ">
        ${isPartner ? "🍱" : "🍽️"}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });
}

export default function RestaurantPage() {
  const { hotelId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useCart();
  const { pushToast } = useToasts();

  const [hotel, setHotel] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimRegNumber, setClaimRegNumber] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);

  useEffect(() => {
    // Detect user coordinates for live distance computation
    getCurrentLocation({ enableHighAccuracy: false, timeout: 5000 })
      .then((pos) => setUserLocation(pos))
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function loadHotelAndFood() {
      try {
        setLoading(true);
        const uLat = userLocation?.latitude || null;
        const uLng = userLocation?.longitude || null;

        // Fetch hotel details and surplus food concurrently
        const [hotelRes, foodRes] = await Promise.all([
          api.getHotel(hotelId, uLat, uLng).catch(() => null),
          api.getHotelFood(hotelId).catch(() => ({ listings: [] })),
        ]);

        if (hotelRes?.hotel) {
          setHotel(hotelRes.hotel);
        } else {
          // Fallback to legacy getHotelDetails
          const legacy = await api.getHotelDetails(hotelId).catch(() => null);
          if (legacy?.hotel) setHotel(legacy.hotel);
        }

        const items = foodRes?.listings || foodRes?.items || [];
        setFoodItems(items);
      } catch (err) {
        console.error("Failed to load restaurant details:", err);
      } finally {
        setLoading(false);
      }
    }

    if (hotelId) {
      loadHotelAndFood();
    }
  }, [hotelId, userLocation?.latitude, userLocation?.longitude]);

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!claimRegNumber.trim()) {
      pushToast("Please enter your business registration or FSSAI number.", "error");
      return;
    }

    try {
      setClaimSubmitting(true);
      await api.claimHotelDirectoryListing(hotelId, {
        businessRegistrationNumber: claimRegNumber.trim(),
        notes: claimNotes.trim(),
      });
      setClaimSubmitted(true);
      pushToast("Ownership claim submitted for administrator verification.", "success");
    } catch (err) {
      pushToast(err.message || "Failed to submit ownership claim.", "error");
    } finally {
      setClaimSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
        <div style={{ textAlign: "center" }}>
          <div
            className="spinner"
            style={{
              width: 44,
              height: 44,
              border: "4px solid rgba(245, 158, 11, 0.2)",
              borderTopColor: "#145C52",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Loading Business & Live Location...</h3>
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div style={{ minHeight: "60vh", padding: 32, textAlign: "center", color: "#ffffff" }}>
        <h2>Establishment Not Found</h2>
        <p style={{ color: "#8A9490" }}>The requested hotel or food business could not be located.</p>
        <button type="button" className="btn btn-amber" onClick={() => navigate("/customer/nearby-food")} style={{ marginTop: 16 }}>
          ← Back to Map & Restaurants
        </button>
      </div>
    );
  }

  const isPartner = Boolean(hotel.isFoodSaverPartner);
  const lat = hotel.latitude !== null ? parseFloat(hotel.latitude) : null;
  const lng = hotel.longitude !== null ? parseFloat(hotel.longitude) : null;

  // Filter food items
  const filteredItems = foodItems.filter((item) => {
    const name = item.foodName || item.itemName || item.name || "";
    const desc = item.description || "";
    const matchesSearch =
      !searchQuery ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" ||
      (selectedCategory === "Recommended" && (item.rating >= 4.5 || item.category === "Biryani")) ||
      (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="restaurant-page-container" style={{ minHeight: "100vh", background: "#0b0f19", color: "#ffffff", paddingBottom: 110 }}>
      {/* RESTAURANT HEADER BANNER */}
      <div style={{ position: "relative", width: "100%", height: 300, background: "#1c2623", overflow: "hidden" }}>
        <img
          src={
            hotel.coverImageUrl ||
            hotel.coverImage ||
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"
          }
          alt={hotel.hotelName || hotel.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(11,15,25,0.96) 100%)" }} />

        {/* TOP NAV CONTROLS */}
        <div style={{ position: "absolute", top: 20, left: 20, right: 20, display: "flex", justifyContent: "space-between", zIndex: 10 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
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
            }}
          >
            ← Back
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate("/customer/nearby-food")}
              style={{
                background: "rgba(20, 92, 82, 0.85)",
                color: "#ffffff",
                border: "1px solid #16796B",
                borderRadius: 12,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🗺️</span> View on Map
            </button>

            {lat && lng && (
              <button
                type="button"
                onClick={() =>
                  openDirections(
                    userLocation?.latitude || 9.1724,
                    userLocation?.longitude || 77.8694,
                    lat,
                    lng,
                    { travelMode: "driving", destinationName: hotel.hotelName || hotel.name }
                  )
                }
                style={{
                  background: "#2563EB",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🧭</span> Get Directions
              </button>
            )}
          </div>
        </div>

        {/* RESTAURANT PROFILE METADATA */}
        <div
          className="container"
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            display: "flex",
            alignItems: "flex-end",
            gap: 20,
            padding: "0 20px",
          }}
        >
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 20,
              border: "3px solid #0b0f19",
              overflow: "hidden",
              background: "#ffffff",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              flexShrink: 0,
            }}
          >
            <img
              src={
                hotel.logoUrl ||
                hotel.logo ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80"
              }
              alt={hotel.hotelName || hotel.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>
                {hotel.hotelName || hotel.name}
              </h1>

              {/* PARTNER / DIRECTORY STATUS BADGE */}
              {isPartner ? (
                <span
                  style={{
                    background: "#145C52",
                    color: "#ffffff",
                    padding: "4px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 900,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ✓ Approved FoodSaver Partner
                </span>
              ) : (
                <span
                  style={{
                    background: "#475569",
                    color: "#cbd5e1",
                    padding: "4px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  📍 Listed Directory Business
                </span>
              )}

              {/* RATING */}
              <span
                style={{
                  background: "#FF9F43",
                  color: "#5C2600",
                  padding: "4px 10px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                ★ {hotel.rating || 4.5}
              </span>
            </div>

            {/* LOCATION, CUISINE, AND DISTANCE METADATA */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: "#cbd5e1", marginTop: 6, flexWrap: "wrap", fontWeight: 600 }}>
              <span>📍 {hotel.address || "Kovilpatti, Tamil Nadu"}</span>
              <span>•</span>
              <span style={{ color: "#FF9F68", fontWeight: 700 }}>{hotel.cuisine || hotel.category || "Restaurant"}</span>
              {hotel.distanceText && (
                <>
                  <span>•</span>
                  <span style={{ color: "#22D3EE", fontWeight: 800 }}>⚡ {hotel.distanceText} away</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 1100, margin: "24px auto 0", padding: "0 20px" }}>
        {/* MINI MAP & LOCATION VERIFICATION CARD */}
        <div
          style={{
            background: "#16201e",
            border: "1px solid #233531",
            borderRadius: 20,
            padding: 20,
            marginBottom: 28,
            display: "grid",
            gridTemplateColumns: lat && lng ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🗺️</span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#ffffff" }}>
                Location & Establishment Verification
              </h3>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
              {hotel.address}
              {hotel.district ? `, ${hotel.district}` : ""}
              {hotel.pincode ? ` - ${hotel.pincode}` : ""}
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: hotel.locationStatus === "verified" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: hotel.locationStatus === "verified" ? "#10B981" : "#F59E0B",
                  border: `1px solid ${hotel.locationStatus === "verified" ? "#10B981" : "#F59E0B"}`,
                }}
              >
                {hotel.locationStatus === "verified" ? "✓ Verified Coordinates" : "⚠️ Exact Map Pin Pending"}
              </span>

              {hotel.contactNumber && (
                <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>
                  📞 {hotel.contactNumber}
                </span>
              )}
            </div>

            {/* CLAIM LISTING CALLOUT IF UNCLAIMED & USER IS MERCHANT */}
            {!isPartner && hotel.claimStatus !== "approved" && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #2d4540" }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  Are you the owner of this food business?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!session) {
                      navigate("/merchant/login");
                    } else {
                      setShowClaimModal(true);
                    }
                  }}
                  style={{
                    marginLeft: 10,
                    background: "none",
                    border: "none",
                    color: "#FF9F68",
                    fontSize: 12.5,
                    fontWeight: 800,
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Claim & Verify on FoodSaver ➔
                </button>
              </div>
            )}
          </div>

          {/* REAL LEAFLET MINI-MAP */}
          {lat && lng && (
            <div style={{ height: 160, borderRadius: 16, overflow: "hidden", border: "1px solid #2d4540" }}>
              <MapContainer
                center={[lat, lng]}
                zoom={15}
                scrollWheelZoom={false}
                style={{ width: "100%", height: "100%" }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]} icon={getPinIcon(isPartner)}>
                  <Popup>
                    <strong>{hotel.hotelName || hotel.name}</strong>
                    <br />
                    {hotel.address}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          )}
        </div>

        {/* SEARCH & CATEGORY FILTER */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <input
              type="text"
              placeholder={`Search surplus items in ${hotel.hotelName || hotel.name}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "13px 44px 13px 46px",
                borderRadius: 14,
                background: "#1c2623",
                border: "1px solid #2d4540",
                color: "#ffffff",
                fontSize: 14.5,
                outline: "none",
              }}
            />
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#8A9490" }}>
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#8A9490", cursor: "pointer", fontSize: 15 }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 18,
                    fontSize: 13,
                    fontWeight: active ? 800 : 600,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    border: active ? "1.5px solid #145C52" : "1px solid #2d4540",
                    background: active ? "#145C52" : "#1c2623",
                    color: active ? "#ffffff" : "#cbd5e1",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* SURPLUS FOOD OFFERS HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#ffffff" }}>
            Available Surplus Food Offers ({filteredItems.length})
          </h2>
          <span style={{ fontSize: 12.5, color: "#8A9490" }}>
            {isPartner ? "✓ Genuine merchant surplus bundles" : "Listed business directory"}
          </span>
        </div>

        {/* FOOD CARDS OR AUTHENTIC EMPTY STATE */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: "54px 24px",
              textAlign: "center",
              background: "#16201e",
              borderRadius: 20,
              border: "1.5px dashed #2d4540",
            }}
          >
            <span style={{ fontSize: 44, display: "block", marginBottom: 12 }}>🍽️</span>
            <h3 style={{ margin: "0 0 8px", fontSize: 19, color: "#ffffff", fontWeight: 800 }}>
              No food available right now.
            </h3>
            <p style={{ margin: "0 auto", maxWidth: 460, color: "#8A9490", fontSize: 13.5, lineHeight: 1.5 }}>
              {isPartner
                ? "This FoodSaver partner has currently concluded their daily surplus collection window. Please check back later today."
                : "This establishment has not yet published active surplus food bundles on FoodSaver. Are you the owner? Claim this business to post surplus food."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 20 }}>
            {filteredItems.map((item) => {
              const inCartItem = cartItems.find((c) => c.listing.id === item.id);
              const qty = inCartItem ? inCartItem.quantity : 0;
              const isVeg = item.dietaryType?.toLowerCase().includes("veg") && !item.dietaryType?.toLowerCase().includes("non");
              const discount = item.discountPercent || Math.round(((item.originalPrice - item.discountedPrice) / item.originalPrice) * 100);

              return (
                <div
                  key={item.id}
                  style={{
                    background: "#16201e",
                    borderRadius: 18,
                    overflow: "hidden",
                    border: "1px solid #2d4540",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                  }}
                >
                  <div style={{ position: "relative", height: 170, overflow: "hidden", background: "#1c2623" }}>
                    <img
                      src={
                        item.imageUrl ||
                        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={item.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 100%)" }} />

                    {/* VEG BADGE */}
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        background: "rgba(0,0,0,0.75)",
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: `1px solid ${isVeg ? "#10B981" : "#EF4444"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isVeg ? "#10B981" : "#EF4444" }} />
                      <span style={{ fontSize: 10, fontWeight: 900, color: isVeg ? "#10B981" : "#EF4444" }}>
                        {isVeg ? "VEG" : "NON-VEG"}
                      </span>
                    </div>

                    {/* DISCOUNT BADGE */}
                    {discount > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 10,
                          right: 10,
                          background: "#FF9F43",
                          color: "#5C2600",
                          padding: "3px 8px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        🔥 {discount}% OFF
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                          {item.name}
                        </h3>
                        <span style={{ fontSize: 18, color: "#ffffff", fontWeight: 900 }}>
                          ₹{item.discountedPrice || item.discountPrice}
                        </span>
                      </div>

                      {item.description && (
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#8A9490", lineHeight: 1.4 }}>
                          {item.description}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        <span>📦 Left: <strong>{item.quantityAvailable}</strong></span>
                        {item.pickupStartTime && (
                          <span>⏱️ Window: {item.pickupStartTime}–{item.pickupEndTime}</span>
                        )}
                      </div>
                    </div>

                    {/* CART / CLAIM ACTION */}
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            addToCart(
                              {
                                id: item.id || item.listingId,
                                itemName: item.name,
                                discountPrice: item.discountedPrice || item.discountPrice,
                                originalPrice: item.originalPrice,
                                hotelId: hotel.hotelId || hotel.id,
                                hotelName: hotel.hotelName || hotel.name,
                                address: hotel.address,
                                isVeg,
                              },
                              1
                            );
                            pushToast(`✓ ${item.name} added to bag`, "success");
                          }}
                          style={{
                            background: "#145C52",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 10,
                            padding: "8px 18px",
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          + Claim Food
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1c2623", padding: "4px 8px", borderRadius: 10, border: "1px solid #145C52" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (qty === 1) removeFromCart(item.id || item.listingId);
                              else updateQuantity(item.id || item.listingId, qty - 1);
                            }}
                            style={{ background: "none", border: "none", color: "#ffffff", fontWeight: 900, cursor: "pointer", padding: "0 6px" }}
                          >
                            −
                          </button>
                          <span style={{ fontWeight: 800, fontSize: 13 }}>{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id || item.listingId, qty + 1)}
                            style={{ background: "none", border: "none", color: "#10B981", fontWeight: 900, cursor: "pointer", padding: "0 6px" }}
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

      {/* OWNERSHIP CLAIM MODAL */}
      {showClaimModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#16201e",
              border: "1.5px solid #2d4540",
              borderRadius: 20,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#ffffff" }}>
                Claim Business: {hotel.hotelName || hotel.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowClaimModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {claimSubmitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: 40 }}>✅</span>
                <h4 style={{ margin: "10px 0 4px", fontSize: 16, color: "#10B981" }}>Claim Submitted!</h4>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Our platform administrators have been notified and will verify your ownership documents.
                </p>
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  style={{
                    marginTop: 18,
                    background: "#145C52",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 20px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit}>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#94a3b8", lineHeight: 1.4 }}>
                  To establish ownership of this listing and start publishing surplus food offers, please provide your registration or license details for admin review.
                </p>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    FSSAI License / GST / Business Registration # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FSSAI 12421021000123"
                    value={claimRegNumber}
                    onChange={(e) => setClaimRegNumber(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#1c2623",
                      border: "1px solid #2d4540",
                      color: "#ffffff",
                      fontSize: 13.5,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                    Notes or Contact Details for Verification
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide any additional contact info or verification notes..."
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#1c2623",
                      border: "1px solid #2d4540",
                      color: "#ffffff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    style={{
                      background: "none",
                      border: "1px solid #2d4540",
                      color: "#cbd5e1",
                      borderRadius: 10,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={claimSubmitting}
                    style={{
                      background: "#145C52",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 10,
                      padding: "8px 20px",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {claimSubmitting ? "Submitting..." : "Submit Claim"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <FloatingCartBar />
    </div>
  );
}
