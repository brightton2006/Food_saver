import React from "react";
import FoodMap from "./FoodMap.jsx";

/**
 * RealMap Component
 * High-performance, backward-compatible wrapper that renders the FoodMap Google Maps-style
 * navigation, nearby search, and real road routing system.
 */
export default function RealMap({
  userLocation = { latitude: 9.1724, longitude: 77.8694 },
  merchants = [],
  foodItems = [],
  radiusKm = 2.0,
  onRadiusChange,
  onSelectMerchant = null,
  onViewFood = null,
  style = { height: "540px", width: "100%" },
  className = "rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800",
  onRecenter = null,
  onUserLocationChange = null,
}) {
  return (
    <FoodMap
      merchants={merchants}
      foodItems={foodItems}
      radiusKm={radiusKm}
      onRadiusChange={onRadiusChange}
      onSelectMerchantProp={onSelectMerchant}
      onViewFood={onViewFood}
      style={style}
      className={className}
      initialUserLocation={userLocation}
      onUserLocationChange={onUserLocationChange}
    />
  );
}
