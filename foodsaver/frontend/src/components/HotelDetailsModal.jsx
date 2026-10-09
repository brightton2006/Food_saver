import React from "react";
import ListingCard from "./ListingCard.jsx";

export default function HotelDetailsModal({ hotel, onClose, onClaimListing }) {
  if (!hotel) return null;

  const items = hotel.items || [];
  const activeItems = items.filter((i) => i.status === "active");
  const menuList = hotel.menu || [];

  const isDirectory = Boolean(hotel.isDirectoryListing || hotel.partnerStatus === "unverified");
  const isVerified = hotel.partnerStatus === "verified" || hotel.verificationStatus === "approved";
  const partnerBadgeLabel = isVerified
    ? "✓ VERIFIED PARTNER"
    : hotel.partnerStatus === "pending_approval"
    ? "⏳ REGISTERED (Pending)"
    : "🏷️ NOT REGISTERED";

  const partnerBadgeColor = isVerified
    ? "#22c55e"
    : hotel.partnerStatus === "pending_approval"
    ? "#f59e0b"
    : "#94a3b8";

  function handleDirections() {
    if (hotel.lat && hotel.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${hotel.lat},${hotel.lng}`, "_blank");
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.hotelName + " " + hotel.address)}`, "_blank");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        background: "rgba(16, 42, 42, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
        fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        className="card hotel-details-modal-card"
        style={{
          width: "100%",
          maxWidth: 900,
          background: "#FFFFFF",
          borderRadius: 20,
          border: "1px solid #DCE6E3",
          overflow: "hidden",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          color: "#102A2A",
          boxShadow: "0 25px 60px rgba(20, 92, 82, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Cover Banner */}
        <div style={{ position: "relative", height: 220, background: "#E8F4F1" }}>
          <img
            src={hotel.coverImage || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"}
            alt={hotel.hotelName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80";
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,76,69,0.2) 0%, rgba(15,76,69,0.92) 100%)" }} />

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(0,0,0,0.5)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "50%",
              width: 36,
              height: 36,
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            ✕
          </button>

          {/* Hotel Info Banner Copy */}
          <div style={{ position: "absolute", bottom: 16, left: 20, right: 20, display: "flex", alignItems: "flex-end", gap: 16 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                border: "3px solid #FFFFFF",
                overflow: "hidden",
                background: "#ffffff",
                boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
                flexShrink: 0,
              }}
            >
              <img
                src={hotel.logo || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80"}
                alt={hotel.hotelName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80";
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#ffffff" }}>
                  {hotel.hotelName}
                </h2>
                <span style={{ background: partnerBadgeColor, color: "#ffffff", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
                  {partnerBadgeLabel}
                </span>
                <span style={{ background: "#145C52", color: "#F5C451", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                  ★ {hotel.rating || 4.5}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#F5C451", fontWeight: 700 }}>
                {hotel.cuisine || "South Indian • Bakery & Meals"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#E8F4F1" }}>
                📍 {hotel.address || "Kovilpatti"} • 🕒 Hours: {hotel.openingHours || "07:00 - 22:30"}
              </p>
            </div>

            {/* Directions Action */}
            <button
              type="button"
              onClick={handleDirections}
              style={{
                background: "linear-gradient(135deg, #145C52 0%, #0F4C45 100%)",
                color: "#ffffff",
                border: "1.5px solid #69C7A8",
                borderRadius: 12,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                flexShrink: 0,
              }}
            >
              🧭 Get Directions
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1, background: "#F7F9F8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #DCE6E3", paddingBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "#145C52", fontWeight: 800 }}>
                Live Surplus Deals
              </h3>
              <span style={{ fontSize: 12.5, color: "#687674" }}>
                {isDirectory
                  ? "Real Kovilpatti Business — Merchant status: NOT REGISTERED"
                  : `Active surplus deals direct from ${hotel.hotelName}`}
              </span>
            </div>
            <span
              className="badge"
              style={{
                fontSize: 12,
                padding: "4px 12px",
                background: activeItems.length > 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
                color: activeItems.length > 0 ? "#16a34a" : "#64748b",
                border: `1px solid ${activeItems.length > 0 ? "#86efac" : "#cbd5e1"}`,
              }}
            >
              {activeItems.length} Active {activeItems.length === 1 ? "Offer" : "Offers"}
            </span>
          </div>

          {activeItems.length === 0 ? (
            <div>
              <div
                style={{
                  padding: "32px 20px",
                  textAlign: "center",
                  background: "#FFFFFF",
                  borderRadius: 18,
                  border: "1.5px dashed #DCE6E3",
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 40, display: "block", marginBottom: 6 }}>🍲</span>
                <h4 style={{ margin: "0 0 6px", fontSize: 17, color: "#102A2A", fontWeight: 800 }}>
                  Currently Unavailable
                </h4>
                <p style={{ margin: "0 auto", fontSize: 13, color: "#687674", maxWidth: 440, lineHeight: 1.5 }}>
                  {isDirectory
                    ? `${hotel.hotelName} is a discovered Kovilpatti business. Once the merchant registers on FoodSaver, active surplus deals will appear here.`
                    : `No active FoodSaver surplus listings posted by ${hotel.hotelName} right now.`}
                </p>
              </div>

              {/* Verified Reference Menu */}
              {menuList.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#145C52", fontWeight: 800 }}>
                    📋 Verified Establishment Menu (Reference)
                  </h4>
                  <div className="grid-row cols-2" style={{ gap: 12 }}>
                    {menuList.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#ffffff",
                          padding: 14,
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                            {m.isVeg ? "🟢" : "🔴"} {m.itemName || m.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {m.description || m.desc || "Fresh dish"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#0f766e" }}>
                            ₹{m.originalPrice || m.price}
                          </span>
                          <span style={{ fontSize: 10, display: "block", color: "#94a3b8" }}>Regular</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid-row cols-2" style={{ gap: 16 }}>
              {activeItems.map((item) => (
                <ListingCard key={item.id} listing={item} onClaim={() => onClaimListing(item)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
