import React from "react";

export default function HotelCard({ hotel, onSelectHotel }) {
  const activeItemsCount = hotel.items?.length || 0;
  const sampleItems = hotel.items?.slice(0, 3) || [];
  
  // Calculate top discount offer banner for the cover photo overlay
  const topDiscount = hotel.items?.reduce((max, item) => {
    if (!item.originalPrice || !item.discountPrice) return max;
    const pct = Math.round(((item.originalPrice - item.discountPrice) / item.originalPrice) * 100);
    return pct > max ? pct : max;
  }, 0) || 30;

  return (
    <div
      className="card hotel-discovery-card"
      style={{
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #DCE6E3",
        background: "#FFFFFF",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 25px rgba(20, 92, 82, 0.08)",
        fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
      }}
      onClick={() => onSelectHotel(hotel)}
    >
      {/* Cover Image Header with Discount Banner */}
      <div style={{ position: "relative", height: 180, overflow: "hidden", background: "#E8F4F1" }}>
        <img
          src={hotel.coverImage || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80"}
          alt={hotel.hotelName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.target.src = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80";
          }}
        />

        {/* Bottom Dark Gradient Shadow for High Contrast Text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(15,76,69,0.1) 40%, rgba(15,76,69,0.92) 100%)",
          }}
        />

        {/* Top Badges: Free Delivery & Rating */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              background: "#145C52",
              color: "#F5C451",
              padding: "4px 10px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 800,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            ⚡ FREE PICKUP
          </span>

          <span
            style={{
              background: "#145C52",
              color: "#ffffff",
              padding: "4px 9px",
              borderRadius: 10,
              fontSize: 11.5,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              gap: 3,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            ★ {hotel.rating || 4.5}
          </span>
        </div>

        {/* Bottom Image Offer Banner */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 14,
            right: 14,
            color: "#ffffff",
            letterSpacing: "-0.2px",
          }}
        >
          <strong
            style={{
              fontSize: 15,
              fontWeight: 900,
              textTransform: "uppercase",
              display: "block",
              color: "#ffffff",
              textShadow: "0 2px 6px rgba(0,0,0,0.8)",
            }}
          >
            {topDiscount > 0 ? `${topDiscount}% OFF UPTO ₹120` : "DAILY SURPLUS OFFERS"}
          </strong>
        </div>
      </div>

      {/* Hotel Meta & Dish Info Body */}
      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: "#102A2A", letterSpacing: "-0.3px" }}>
          {hotel.hotelName}
        </h3>

        {/* Rating + Delivery ETA line */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#687674", marginBottom: 6 }}>
          <span style={{ color: "#16796B", fontWeight: 800 }}>★ {hotel.rating || 4.2}</span>
          <span>•</span>
          <span>10-15 mins</span>
        </div>

        {/* Cuisine Subtitle */}
        <div style={{ fontSize: 12.5, color: "#16796B", fontWeight: 600, marginBottom: 4, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
          {hotel.cuisine || "South Indian • Meals • Fast Food"}
        </div>

        {/* Location Subtitle */}
        <div style={{ fontSize: 12, color: "#687674", marginBottom: 12 }}>
          {hotel.address || "Kovilpatti Main Road"}
        </div>

        {/* Available Food Deals Preview */}
        <div
          style={{
            marginTop: "auto",
            padding: "10px 12px",
            background: "#F7F9F8",
            borderRadius: 14,
            border: "1px dashed #DCE6E3",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <strong style={{ fontSize: 11, color: "#145C52", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Active Surplus Stock
            </strong>
            <span style={{ fontSize: 11, background: "rgba(255, 159, 67, 0.15)", color: "#FF9F43", fontWeight: 800, padding: "2px 8px", borderRadius: 10, border: "1px solid rgba(255, 159, 67, 0.3)" }}>
              {activeItemsCount} {activeItemsCount === 1 ? "Item" : "Items"}
            </span>
          </div>

          {sampleItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sampleItems.map((item) => {
                const discountPct = Math.round(
                  ((item.originalPrice - item.discountPrice) / item.originalPrice) * 100
                );
                return (
                  <div
                    key={item.id || item.itemName}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                      color: "#102A2A",
                    }}
                  >
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 160, color: "#687674" }}>
                      • {item.itemName}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong style={{ color: "#145C52" }}>₹{item.discountPrice}</strong>
                      {discountPct > 0 && (
                        <span style={{ fontSize: 10, color: "#FF9F43", fontWeight: 700 }}>
                          ({discountPct}% OFF)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#8A9693" }}>No active deals right now</span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 14, fontSize: 13, fontWeight: 800, padding: "10px 14px", borderRadius: 12, background: "#145C52" }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectHotel(hotel);
          }}
        >
          View Hotel Surplus Menu →
        </button>
      </div>
    </div>
  );
}
