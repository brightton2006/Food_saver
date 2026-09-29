import React from "react";
import { openDirections } from "../services/locationService.js";

/**
 * RoutePanel
 * Google Maps-style navigation card & bottom sheet.
 * Displays route details from Customer Location -> Merchant Location,
 * real road distance (km), duration (min), and interactive live navigation controls.
 *
 * @param {Object} props
 * @param {Object} props.merchant Selected merchant
 * @param {Object} props.userLocation Current GPS coordinates and address
 * @param {number|string} props.distance Road distance in km
 * @param {number|string} props.duration Estimated travel time in min
 * @param {boolean} props.isLoadingRoute Whether route is currently calculating
 * @param {boolean} props.isNavigating Whether live navigation mode is active
 * @param {boolean} props.isRecalculating Whether off-route recalculation is underway
 * @param {boolean} props.hasArrived Whether user is within arrival threshold
 * @param {Function} props.onStartNavigation Toggle navigation
 * @param {Function} props.onStopNavigation Stop navigation
 * @param {Function} props.onClose Close route panel
 * @param {Function} props.onViewFood View food deals for this merchant
 */
export default function RoutePanel({
  merchant,
  userLocation,
  distance,
  duration,
  isLoadingRoute = false,
  isNavigating = false,
  isRecalculating = false,
  hasArrived = false,
  onStartNavigation,
  onStopNavigation,
  onClose,
  onViewFood = null,
}) {
  if (!merchant) return null;

  const mLat = Number(merchant.latitude || merchant.lat);
  const mLng = Number(merchant.longitude || merchant.lng);
  const businessName = merchant.businessName || merchant.hotelName || "Selected Merchant";
  const dealsCount = merchant.availableFoodCount || 0;

  // Format display distance
  const distDisplay = distance !== null && distance !== undefined
    ? Number(distance) < 1
      ? `${Math.round(Number(distance) * 1000)} m`
      : `${Number(distance).toFixed(1)} km`
    : merchant.distanceText || "Calculating...";

  const timeDisplay = duration ? `${duration} min` : "Calculating...";

  return (
    <div
      className="route-panel-container"
      style={{
        position: "absolute",
        bottom: "16px",
        left: "16px",
        right: "16px",
        maxWidth: "460px",
        zIndex: 1100,
        margin: "0 auto",
        background: "#FFFFFF",
        borderRadius: "20px",
        border: "1px solid #DCE6E3",
        boxShadow: "0 12px 36px rgba(20, 92, 82, 0.14)",
        padding: "16px",
        color: "#102A2A",
        fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Header & Close button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🧭</span>
          <span style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: isNavigating ? "#16796B" : "#145C52" }}>
            {isNavigating ? "Live Navigation" : "Road Directions"}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "#F3F9F7",
            border: "1px solid #DCE6E3",
            borderRadius: "50%",
            width: "28px",
            height: "28px",
            color: "#687674",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            cursor: "pointer",
          }}
          title="Exit directions"
        >
          ✕
        </button>
      </div>

      {/* Recalculating / Arrived Banners */}
      {isRecalculating && (
        <div
          style={{
            background: "rgba(255, 159, 67, 0.12)",
            border: "1px solid #FF9F43",
            color: "#FF9F43",
            padding: "8px 12px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: 700,
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span className="animate-spin">🔄</span>
          <span>Recalculating road route from current GPS position...</span>
        </div>
      )}

      {hasArrived && (
        <div
          style={{
            background: "rgba(76, 175, 115, 0.12)",
            border: "1px solid #4CAF73",
            color: "#4CAF73",
            padding: "8px 12px",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 800,
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>🎉</span>
          <span>You have arrived at {businessName}!</span>
        </div>
      )}

      {/* FROM / TO Route Step Nodes */}
      <div style={{ background: "#F7F9F8", border: "1px solid #DCE6E3", borderRadius: "16px", padding: "12px 14px", marginBottom: "12px" }}>
        {/* From Origin */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "2px" }}>
            <span style={{ fontSize: "14px" }}>📍</span>
            <div style={{ width: "2px", height: "20px", background: "#16796B", margin: "2px 0" }}></div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 800, color: "#16796B" }}>
              FROM
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#102A2A" }}>
              Current Location
            </div>
            <div style={{ fontSize: "11px", color: "#687674", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userLocation?.address || "Real Device GPS"}
            </div>
          </div>
        </div>

        {/* To Destination */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "4px" }}>
          <div style={{ marginTop: "2px" }}>
            <span style={{ fontSize: "14px" }}>🍱</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 800, color: "#FF9F43" }}>
              TO
            </div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#102A2A" }}>
              {businessName}
            </div>
            <div style={{ fontSize: "11px", color: "#687674", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {merchant.address || "Kovilpatti"}
            </div>
          </div>
        </div>
      </div>

      {/* Distance + Estimated Time Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#E8F4F1",
          borderRadius: "14px",
          padding: "8px 14px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "20px", fontWeight: 900, color: "#145C52" }}>
            {isLoadingRoute ? "..." : distDisplay}
          </span>
          <span style={{ color: "#687674" }}>•</span>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#102A2A" }}>
            {isLoadingRoute ? "..." : timeDisplay}
          </span>
        </div>

        {dealsCount > 0 && (
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#FF9F43", background: "rgba(255, 159, 67, 0.15)", padding: "3px 8px", borderRadius: "8px" }}>
            🔥 {dealsCount} Surplus Deals
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        {!isNavigating ? (
          <button
            type="button"
            onClick={() => {
              onStartNavigation();
              openDirections(mLat, mLng, userLocation?.latitude, userLocation?.longitude);
            }}
            style={{
              flex: 1.2,
              background: "#145C52",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "11px 14px",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(20, 92, 82, 0.25)",
            }}
          >
            <span>🧭</span>
            <span>Start Navigation</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopNavigation}
            style={{
              flex: 1.2,
              background: "#D9534F",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "11px 14px",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(217, 83, 79, 0.25)",
            }}
          >
            <span>🛑</span>
            <span>Stop Navigation</span>
          </button>
        )}

        {onViewFood && dealsCount > 0 && (
          <button
            type="button"
            onClick={() => onViewFood(merchant)}
            style={{
              flex: 1,
              background: "#E8F4F1",
              color: "#145C52",
              border: "1.5px solid #16796B",
              borderRadius: "12px",
              padding: "10px 12px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
            }}
          >
            <span>🍱</span>
            <span>View Food</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => openDirections(mLat, mLng)}
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCE6E3",
            color: "#145C52",
            borderRadius: "12px",
            padding: "10px 12px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Open in Google Maps App"
        >
          🗺️
        </button>
      </div>
    </div>
  );
}
