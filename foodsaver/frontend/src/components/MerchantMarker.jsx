import React from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

/**
 * MerchantMarker
 * Renders a verified SQL merchant on the Leaflet map.
 * Distinguishes active surplus food merchants, normal merchants, and selected states.
 *
 * @param {Object} props
 * @param {Object} props.merchant
 * @param {boolean} [props.isSelected=false]
 * @param {Function} [props.onSelect]
 * @param {Function} [props.onDirections]
 * @param {Function} [props.onViewFood]
 */
export default function MerchantMarker({
  merchant,
  isSelected = false,
  onSelect = null,
  onDirections = null,
  onViewFood = null,
}) {
  if (!merchant) return null;

  const lat = Number(merchant.latitude || merchant.lat);
  const lng = Number(merchant.longitude || merchant.lng);

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }

  const dealsCount = Number(merchant.availableFoodCount || merchant.dealsCount || 0);
  const hasFood = dealsCount > 0;
  const businessName = merchant.businessName || merchant.hotelName || "FoodSaver Partner";
  const distText = merchant.distanceText || (merchant.distance ? `${merchant.distance} km away` : "Nearby");
  const estMins = merchant.estimatedMinutes || (merchant.distance ? Math.max(2, Math.round(Number(merchant.distance) * 2.5)) : 5);

  // Dynamic styling based on food availability & selection state
  // Selected: Orange (#FF9F43), Nearby Food: Teal (#145C52 / #16796B), Partner: Deep Teal (#0F4C45)
  const bgColor = isSelected
    ? "#FF9F43"
    : hasFood
    ? "#145C52"
    : "#0F4C45";

  const borderColor = isSelected ? "#FFFFFF" : hasFood ? "#E8F4F1" : "rgba(255,255,255,0.7)";
  const arrowColor = isSelected ? "#FF9F43" : hasFood ? "#145C52" : "#0F4C45";
  const scale = isSelected ? 1.08 : 1.0;
  const shadow = isSelected ? "0 8px 24px rgba(255, 159, 67, 0.45)" : "0 6px 18px rgba(20, 92, 82, 0.25)";

  const merchantIcon = L.divIcon({
    className: `custom-merchant-pin-container ${isSelected ? "selected-pin" : ""}`,
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: scale(${scale}); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
        <div style="
          padding: 5px 10px;
          border-radius: 12px;
          background: ${bgColor};
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          box-shadow: ${shadow};
          border: 2px solid ${borderColor};
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          font-family: 'Poppins', 'Inter', system-ui, -apple-system, sans-serif;
        ">
          <span style="font-size: 13px;">${hasFood ? "🍱" : "🏪"}</span>
          <span style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.2px;">
            ${businessName}
          </span>
          ${
            hasFood
              ? `<span style="background: #ffffff; color: #145C52; font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 900; box-shadow: 0 1px 4px rgba(20,92,82,0.2);">${dealsCount}</span>`
              : ""
          }
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${arrowColor};"></div>
      </div>
    `,
    iconSize: [140, 44],
    iconAnchor: [70, 44],
    popupAnchor: [0, -44],
  });

  return (
    <Marker
      position={[lat, lng]}
      icon={merchantIcon}
      eventHandlers={{
        click: () => {
          if (onSelect) onSelect(merchant);
        },
      }}
    >
      <Popup className="merchant-marker-popup">
        <div style={{ minWidth: "220px", padding: "6px 4px", fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "20px" }}>🍱</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#102A2A", lineHeight: 1.2 }}>
                {businessName}
              </h3>
              <div style={{ fontSize: "11px", color: "#687674", marginTop: "2px" }}>
                {merchant.cuisine || "Restaurant"} • <span style={{ color: "#F5C451" }}>⭐</span> {merchant.rating || 4.5}
              </div>
            </div>
          </div>

          <p style={{ margin: "4px 0 8px", fontSize: "11px", color: "#687674", lineHeight: "1.4" }}>
            {merchant.address || "Kovilpatti"}
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 8px", background: "#F3F9F7", padding: "5px 10px", borderRadius: "10px", border: "1px solid #DCE6E3" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#145C52" }}>
              📍 {distText}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#687674" }}>
              ⏱️ ~{estMins} min
            </span>
          </div>

          {hasFood && (
            <div style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "#FF9F43", background: "rgba(255, 159, 67, 0.12)", border: "1px solid rgba(255, 159, 67, 0.3)", padding: "5px 10px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🔥</span>
              <span>{dealsCount} Surplus Deals Available</span>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => {
                if (onViewFood) onViewFood(merchant);
              }}
              style={{
                flex: 1,
                background: "#E8F4F1",
                color: "#145C52",
                border: "1px solid #16796B",
                padding: "8px 10px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              View Food
            </button>

            <button
              type="button"
              onClick={() => {
                if (onDirections) onDirections(merchant);
              }}
              style={{
                flex: 1,
                background: "#145C52",
                color: "#ffffff",
                border: "none",
                padding: "8px 10px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                boxShadow: "0 3px 8px rgba(20, 92, 82, 0.25)",
                transition: "all 0.15s ease",
              }}
            >
              <span>🧭</span>
              <span>Directions</span>
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
