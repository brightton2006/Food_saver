import React from "react";
import ListingCard from "./ListingCard.jsx";

export default function HotelDetailsModal({ hotel, onClose, onClaimListing }) {
  if (!hotel) return null;

  const items = hotel.items || [];
  const activeItems = items.filter((i) => i.status === "active");

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
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#ffffff" }}>
                  {hotel.hotelName}
                </h2>
                <span style={{ background: "#145C52", color: "#F5C451", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                  ★ {hotel.rating || 4.5}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#F5C451", fontWeight: 700 }}>
                {hotel.cuisine || "South Indian • Bakery & Meals"}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#E8F4F1" }}>
                📍 {hotel.address || "Kovilpatti"} • 🕒 Pickup: {hotel.openingHours || "18:00 - 22:00"}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Main Content */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1, background: "#F7F9F8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #DCE6E3", paddingBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "#145C52", fontWeight: 800 }}>
                Surplus Food Menu
              </h3>
              <span style={{ fontSize: 12.5, color: "#687674" }}>
                Fresh daily surplus items direct from {hotel.hotelName}
              </span>
            </div>
            <span className="badge badge-amber" style={{ fontSize: 12, padding: "4px 12px", background: "rgba(255, 159, 67, 0.15)", color: "#FF9F43", border: "1px solid rgba(255, 159, 67, 0.4)" }}>
              {activeItems.length} Available {activeItems.length === 1 ? "Offer" : "Offers"}
            </span>
          </div>

          {activeItems.length === 0 ? (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                background: "#FFFFFF",
                borderRadius: 18,
                border: "1.5px dashed #DCE6E3",
              }}
            >
              <span style={{ fontSize: 42, display: "block", marginBottom: 8 }}>🍲</span>
              <h4 style={{ margin: "0 0 6px", fontSize: 18, color: "#102A2A", fontWeight: 800 }}>
                No Food Available Right Now
              </h4>
              <p style={{ margin: "0 auto", fontSize: 13.5, color: "#687674", maxWidth: 420, lineHeight: 1.5 }}>
                Check back later for fresh surplus food offers from {hotel.hotelName}. Merchants update their end-of-day deals during closing hours.
              </p>
            </div>
          ) : (
            <div className="grid-row cols-2" style={{ gap: 16 }}>
              {activeItems.map((item) => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  onClaim={() => onClaimListing(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
