import React from "react";
import RealMap from "./RealMap.jsx";

/**
 * StoreMap wrapper around RealMap for backward compatibility and unified Leaflet rendering.
 */
export default function StoreMap(props) {
  return <RealMap {...props} />;
}
