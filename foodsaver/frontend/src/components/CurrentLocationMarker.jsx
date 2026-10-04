import React from "react";
import { Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

/**
 * CurrentLocationMarker
 * Renders the customer's real device GPS position on the Leaflet map.
 * Features an animated blue pulsing beacon and "You are here" status.
 *
 * @param {Object} props
 * @param {{ latitude: number, longitude: number, accuracy?: number, address?: string }} props.location
 * @param {boolean} [props.showAccuracyCircle=true]
 */
export default function CurrentLocationMarker({ location, showAccuracyCircle = true }) {
  if (!location || !location.latitude || !location.longitude) {
    return null;
  }

  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  const accuracy = Number(location.accuracy) || 15;

  if (isNaN(lat) || isNaN(lng)) return null;

  // Custom Distinctive Blue Location Marker DivIcon (Requirement 1)
  const userIcon = L.divIcon({
    className: "current-location-marker-container",
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing blue radar ring -->
        <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background: rgba(37, 99, 235, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <!-- Direction blue ring -->
        <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(219, 234, 254, 0.6); border: 2px solid #2563EB;"></div>
        <!-- Distinctive Blue Dot -->
        <div style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #2563EB; border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.6); display: flex; align-items: center; justify-content: center;">
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });

  return (
    <>
      {showAccuracyCircle && accuracy > 0 && accuracy < 1000 && (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{
            color: "#2563EB",
            weight: 1.5,
            fillColor: "#3B82F6",
            fillOpacity: 0.12,
          }}
        />
      )}

      <Marker position={[lat, lng]} icon={userIcon}>
        <Popup className="current-location-popup">
          <div style={{ textAlign: "center", padding: "6px 8px", minWidth: "160px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", background: "#E8F4F1", color: "#145C52", fontSize: "14px", marginBottom: "6px" }}>
              📍
            </div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#102A2A" }}>
              You are here
            </div>
            <div style={{ fontSize: "11px", color: "#687674", margin: "4px 0 2px", lineHeight: "1.4" }}>
              {location.address || "Current Device GPS"}
            </div>
            {accuracy > 0 && (
              <div style={{ fontSize: "10px", color: "#16796B", fontWeight: 700 }}>
                GPS Accuracy: ±{Math.round(accuracy)}m
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
}
