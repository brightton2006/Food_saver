import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import CurrentLocationMarker from "./CurrentLocationMarker.jsx";
import MerchantMarker from "./MerchantMarker.jsx";
import NearbySearch from "./NearbySearch.jsx";
import RoutePanel from "./RoutePanel.jsx";
import {
  getCurrentLocation,
  watchUserLocation,
  clearWatch,
  fetchRoute,
  calculateDistance,
  calculateDistanceToRoute,
  reverseGeocode,
  DEFAULT_COORDINATES,
} from "../services/locationService.js";

// Fix Leaflet default icon asset paths for Vite/Webpack bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/**
 * Helper to smoothly pan and zoom the Leaflet map when center coordinates change
 */
function MapViewUpdater({ center, zoom = 14, bounds = null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        return;
      } catch (e) {
        // Fallback to flyTo center
      }
    }

    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, bounds, map]);

  return null;
}

/**
 * FoodMap
 * Google Maps-style navigation and nearby food discovery system for FoodSaver.
 *
 * @param {Object} props
 * @param {Array<Object>} props.merchants Real SQL merchant records
 * @param {Array<Object>} [props.foodItems=[]] Active food listings
 * @param {number} [props.radiusKm=2.0]
 * @param {Function} [props.onRadiusChange]
 * @param {Function} [props.onViewFood]
 * @param {Object} [props.style={ height: "550px", width: "100%" }]
 * @param {string} [props.className]
 * @param {Object} [props.initialUserLocation]
 * @param {Function} [props.onUserLocationChange]
 */
export default function FoodMap({
  merchants = [],
  foodItems = [],
  radiusKm = 2.0,
  onRadiusChange,
  onViewFood = null,
  style = { height: "560px", width: "100%" },
  className = "food-saver-google-map-container rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800",
  initialUserLocation = null,
  onUserLocationChange = null,
}) {
  // 1. User Location & GPS Tracking State
  const [userLocation, setUserLocation] = useState(
    initialUserLocation || DEFAULT_COORDINATES
  );
  const [gpsPermissionState, setGpsPermissionState] = useState("checking"); // "checking" | "granted" | "denied" | "unavailable"
  const [gpsErrorMessage, setGpsErrorMessage] = useState("");
  const watchIdRef = useRef(null);

  // 2. Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");

  // 3. Navigation & Route State
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [route, setRoute] = useState([]); // Array of [lat, lng] road points
  const [distance, setDistance] = useState(null); // Road distance in km
  const [duration, setDuration] = useState(null); // Duration in min
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const lastRecalculateTimeRef = useRef(0);

  // 4. Center Coordinates for Leaflet
  const userLat = Number(userLocation?.latitude) || 9.1724;
  const userLng = Number(userLocation?.longitude) || 77.8694;

  // Compute map bounds when route is active
  const routeBounds = React.useMemo(() => {
    if (!route || route.length < 2) return null;
    return route;
  }, [route]);

  /**
   * Request real browser GPS location and continuously monitor using watchPosition
   */
  const startLocationWatch = useCallback(() => {
    setGpsPermissionState("checking");
    setGpsErrorMessage("");

    if (!navigator.geolocation) {
      setGpsPermissionState("unavailable");
      setGpsErrorMessage("GPS geolocation is not supported by your browser/device.");
      return;
    }

    // 1. First get initial fast position
    getCurrentLocation({ enableHighAccuracy: true, timeout: 10000 })
      .then(async (pos) => {
        const addr = await reverseGeocode(pos.latitude, pos.longitude);
        const loc = {
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy || 15.0,
          timestamp: pos.timestamp || Date.now(),
          address: addr,
        };
        setUserLocation(loc);
        setGpsPermissionState("granted");
        if (onUserLocationChange) onUserLocationChange(loc);
      })
      .catch((err) => {
        console.warn("Initial GPS error:", err.message);
        if (err.code === 1) {
          setGpsPermissionState("denied");
          setGpsErrorMessage("Location permission was denied. Please allow location access in your browser.");
        } else {
          setGpsPermissionState("unavailable");
          setGpsErrorMessage("GPS signal is temporarily unavailable.");
        }
      });

    // 2. Continuously monitor location using watchPosition
    if (watchIdRef.current !== null) {
      clearWatch(watchIdRef.current);
    }

    const id = watchUserLocation(
      async (pos) => {
        setUserLocation((prev) => {
          const updated = {
            ...prev,
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy || prev.accuracy,
            timestamp: pos.timestamp || Date.now(),
          };
          if (onUserLocationChange) onUserLocationChange(updated);
          return updated;
        });
        setGpsPermissionState("granted");
      },
      (err) => {
        console.warn("Watch position notice:", err.message);
        if (err.code === 1) {
          setGpsPermissionState("denied");
        }
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );

    watchIdRef.current = id;
  }, [onUserLocationChange]);

  useEffect(() => {
    startLocationWatch();
    return () => {
      if (watchIdRef.current !== null) {
        clearWatch(watchIdRef.current);
      }
    };
  }, [startLocationWatch]);

  /**
   * Calculate real road route between current user GPS and selected merchant
   */
  const calculateRoadRoute = useCallback(
    async (merchant) => {
      if (!merchant) return;
      const mLat = Number(merchant.latitude || merchant.lat);
      const mLng = Number(merchant.longitude || merchant.lng);

      if (!mLat || !mLng || isNaN(mLat) || isNaN(mLng)) return;

      setIsLoadingRoute(true);
      try {
        const routeData = await fetchRoute(userLat, userLng, mLat, mLng);
        setRoute(routeData.route || []);
        setDistance(routeData.distance);
        setDuration(routeData.duration);
        lastRecalculateTimeRef.current = Date.now();
      } catch (err) {
        console.error("Road route calculation failed:", err);
      } finally {
        setIsLoadingRoute(false);
        setIsRecalculating(false);
      }
    },
    [userLat, userLng]
  );

  /**
   * When a merchant is clicked on the map or selected from search
   */
  const handleSelectMerchant = (merchant) => {
    setSelectedMerchant(merchant);
    setHasArrived(false);
    calculateRoadRoute(merchant);
  };

  /**
   * Monitor user GPS during active navigation for off-route deviation (> 75m) and arrival
   */
  useEffect(() => {
    if (!isNavigating || !selectedMerchant || !route || route.length < 2) {
      return;
    }

    const mLat = Number(selectedMerchant.latitude || selectedMerchant.lat);
    const mLng = Number(selectedMerchant.longitude || selectedMerchant.lng);

    // 1. Check if user arrived at merchant (< 35 meters)
    const distToMerchant = calculateDistance(userLat, userLng, mLat, mLng).distanceMeters;
    if (distToMerchant <= 35) {
      setHasArrived(true);
      return;
    }

    // 2. Check if user moved off-route (> 80 meters from route polyline)
    const offRouteDistance = calculateDistanceToRoute(userLat, userLng, route);
    const now = Date.now();
    const timeSinceLastRecalc = now - lastRecalculateTimeRef.current;

    // Throttle recalculations: only once every 8 seconds
    if (offRouteDistance > 80 && timeSinceLastRecalc > 8000) {
      setIsRecalculating(true);
      calculateRoadRoute(selectedMerchant);
    }
  }, [userLat, userLng, isNavigating, selectedMerchant, route, calculateRoadRoute]);

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setHasArrived(false);
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    setIsRecalculating(false);
  };

  const handleCloseRoute = () => {
    setSelectedMerchant(null);
    setRoute([]);
    setDistance(null);
    setDuration(null);
    setIsNavigating(false);
    setIsRecalculating(false);
    setHasArrived(false);
  };

  const handleRecenter = () => {
    startLocationWatch();
  };

  return (
    <div className={className} style={{ position: "relative" }}>
      {/* Top Google Maps Search Bar & Radius Select */}
      <div style={{ position: "absolute", top: "14px", left: "14px", right: "14px", zIndex: 1000, maxWidth: "580px", margin: "0 auto" }}>
        <NearbySearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          radiusKm={radiusKm}
          onRadiusChange={onRadiusChange || (() => {})}
          merchants={merchants}
          foodItems={foodItems}
          onSelectMerchant={handleSelectMerchant}
          onDirections={handleSelectMerchant}
        />
      </div>

      {/* Location Error Handling (Permission Denied / GPS Unavailable) */}
      {gpsPermissionState === "denied" && (
        <div
          style={{
            position: "absolute",
            top: "116px",
            left: "14px",
            right: "14px",
            zIndex: 1000,
            maxWidth: "460px",
            margin: "0 auto",
            background: "#FFFFFF",
            borderRadius: "18px",
            padding: "16px 20px",
            color: "#102A2A",
            border: "1px solid #DCE6E3",
            boxShadow: "0 12px 32px rgba(20, 92, 82, 0.15)",
            textAlign: "center",
            fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: "15px", fontWeight: 800, color: "#D9534F", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <span>📍</span>
            <span>Location Access Required</span>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#687674", lineHeight: 1.4 }}>
            FoodSaver needs your location to find nearby restaurants and provide directions.
          </p>
          <button
            type="button"
            onClick={startLocationWatch}
            style={{
              background: "#145C52",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "9px 20px",
              fontSize: "12.5px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(20, 92, 82, 0.25)",
            }}
          >
            Allow Location
          </button>
        </div>
      )}

      {gpsPermissionState === "unavailable" && (
        <div
          style={{
            position: "absolute",
            top: "116px",
            left: "14px",
            right: "14px",
            zIndex: 1000,
            maxWidth: "460px",
            margin: "0 auto",
            background: "#FFFFFF",
            borderRadius: "18px",
            padding: "16px 20px",
            color: "#102A2A",
            border: "1px solid #DCE6E3",
            boxShadow: "0 12px 32px rgba(20, 92, 82, 0.15)",
            textAlign: "center",
            fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 800, color: "#FF9F43", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <span>⚠️</span>
            <span>Unable to detect your current location.</span>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#687674", lineHeight: 1.4 }}>
            Please enable location services and try again.
          </p>
          <button
            type="button"
            onClick={startLocationWatch}
            style={{
              background: "#145C52",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "8px 18px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Retry Location
          </button>
        </div>
      )}

      {/* Real Leaflet Map */}
      <MapContainer
        center={[userLat, userLng]}
        zoom={14}
        scrollWheelZoom={true}
        style={style}
        zoomControl={false}
      >
        <MapViewUpdater center={[userLat, userLng]} zoom={14} bounds={routeBounds} />

        {/* Real OpenStreetMap Vector / Raster Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Configurable Proximity Search Radar Circle (1 KM, 2 KM, 5 KM, 10 KM) */}
        {radiusKm && (
          <Circle
            center={[userLat, userLng]}
            radius={Number(radiusKm) * 1000}
            pathOptions={{
              color: "#16796B",
              weight: 1.5,
              dashArray: "6, 6",
              fillColor: "#16796B",
              fillOpacity: 0.08,
            }}
          />
        )}

        {/* 1. Customer "You Are Here" Real GPS Marker */}
        <CurrentLocationMarker
          location={userLocation}
          showAccuracyCircle={!isNavigating}
        />

        {/* 2. Real SQL Merchants */}
        {merchants.map((merchant) => {
          const isSelected = selectedMerchant && String(selectedMerchant.id || selectedMerchant.hotelId) === String(merchant.id || merchant.hotelId);
          return (
            <MerchantMarker
              key={merchant.id || merchant.hotelId}
              merchant={merchant}
              isSelected={isSelected}
              onSelect={handleSelectMerchant}
              onDirections={handleSelectMerchant}
              onViewFood={onViewFood}
            />
          );
        })}

        {/* 3. Real Road Route Polyline (Follows roads in FoodSaver Teal palette) */}
        {route && route.length >= 2 && (
          <>
            {/* Outer polyline shadow for depth */}
            <Polyline
              positions={route}
              pathOptions={{
                color: "#0F4C45",
                weight: 8,
                opacity: 0.40,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {/* Main Road Route Polyline */}
            <Polyline
              positions={route}
              pathOptions={{
                color: isNavigating ? "#145C52" : "#16796B",
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
                dashArray: isRecalculating ? "8, 8" : null,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* Floating Recenter "📍 My Location" Button */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Center map to my current GPS location"
        style={{
          position: "absolute",
          bottom: selectedMerchant ? "200px" : "24px",
          right: "16px",
          zIndex: 1000,
          background: "#145C52",
          border: "1.5px solid #16796B",
          color: "#ffffff",
          padding: "9px 16px",
          borderRadius: "16px",
          fontSize: "12px",
          fontWeight: 800,
          boxShadow: "0 8px 24px rgba(20, 92, 82, 0.35)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "bottom 0.3s ease, background 0.15s ease",
        }}
      >
        <span>📍</span>
        <span>My Location</span>
      </button>

      {/* Google Maps-style Route & Direction Panel */}
      {selectedMerchant && (
        <RoutePanel
          merchant={selectedMerchant}
          userLocation={userLocation}
          distance={distance}
          duration={duration}
          isLoadingRoute={isLoadingRoute}
          isNavigating={isNavigating}
          isRecalculating={isRecalculating}
          hasArrived={hasArrived}
          onStartNavigation={handleStartNavigation}
          onStopNavigation={handleStopNavigation}
          onClose={handleCloseRoute}
          onViewFood={onViewFood}
        />
      )}
    </div>
  );
}
