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
 * Custom Floating Zoom and Recenter Controls
 */
function LeafletMapControls({ onRecenter, isSelected = false }) {
  const map = useMap();

  return (
    <div
      style={{
        position: "absolute",
        bottom: isSelected ? "210px" : "24px",
        right: "16px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        transition: "bottom 0.3s ease",
      }}
    >
      {/* Zoom In Button */}
      <button
        type="button"
        onClick={() => map.zoomIn()}
        title="Zoom In"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "12px",
          background: "#FFFFFF",
          border: "1px solid #DCE6E3",
          color: "#145C52",
          fontSize: "18px",
          fontWeight: 800,
          boxShadow: "0 4px 14px rgba(20, 92, 82, 0.15)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </button>

      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={() => map.zoomOut()}
        title="Zoom Out"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "12px",
          background: "#FFFFFF",
          border: "1px solid #DCE6E3",
          color: "#145C52",
          fontSize: "18px",
          fontWeight: 800,
          boxShadow: "0 4px 14px rgba(20, 92, 82, 0.15)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        −
      </button>

      {/* Recenter "📍 My Location" Button */}
      <button
        type="button"
        onClick={onRecenter}
        title="Center map to my current GPS location"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "12px",
          background: "#145C52",
          border: "1px solid #16796B",
          color: "#ffffff",
          fontSize: "16px",
          boxShadow: "0 4px 14px rgba(20, 92, 82, 0.35)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        📍
      </button>
    </div>
  );
}

/**
 * FoodMap
 * Google Maps-style navigation, discovery, and smart map system for FoodSaver.
 */
export default function FoodMap({
  merchants = [],
  foodItems = [],
  radiusKm = 2.0,
  onRadiusChange,
  onViewFood = null,
  style = { height: "560px", width: "100%" },
  className = "food-saver-google-map-container rounded-3xl overflow-hidden shadow-xl relative border border-[#DCE6E3]",
  initialUserLocation = null,
  onUserLocationChange = null,
  selectedCategory = "All",
  onCategoryChange = null,
  onSelectMerchantProp = null,
}) {
  // 1. User Location & GPS Tracking State
  const [userLocation, setUserLocation] = useState(
    initialUserLocation || DEFAULT_COORDINATES
  );
  const [mapCenter, setMapCenter] = useState([
    initialUserLocation?.latitude || 9.1724,
    initialUserLocation?.longitude || 77.8694,
  ]);
  const [gpsPermissionState, setGpsPermissionState] = useState("checking"); // "checking" | "granted" | "denied" | "unavailable"
  const [gpsErrorMessage, setGpsErrorMessage] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const watchIdRef = useRef(null);

  // 2. Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [showPlacesDrawer, setShowPlacesDrawer] = useState(true);

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

  // Sync props if initialUserLocation updates
  useEffect(() => {
    if (initialUserLocation?.latitude && initialUserLocation?.longitude) {
      setUserLocation(initialUserLocation);
      setMapCenter([initialUserLocation.latitude, initialUserLocation.longitude]);
    }
  }, [initialUserLocation]);

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
    setIsDetectingLocation(true);

    if (!navigator.geolocation) {
      setGpsPermissionState("unavailable");
      setGpsErrorMessage("GPS geolocation is not supported by your browser or device.");
      setIsDetectingLocation(false);
      return;
    }

    // 1. Initial position
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
        setMapCenter([pos.latitude, pos.longitude]);
        setGpsPermissionState("granted");
        setIsDetectingLocation(false);
        if (onUserLocationChange) onUserLocationChange(loc);
      })
      .catch((err) => {
        setIsDetectingLocation(false);
        if (err.code === 1) {
          setGpsPermissionState("denied");
          setGpsErrorMessage("Location access is disabled. Enable location permission in your browser or search for a location manually.");
        } else if (err.code === 3) {
          setGpsPermissionState("unavailable");
          setGpsErrorMessage("Location request timed out. Please try again or search for a location manually.");
        } else {
          setGpsPermissionState("unavailable");
          setGpsErrorMessage("GPS/location services are unavailable on your device. Please search for a location manually.");
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
      const uLat = Number(userLocation?.latitude) || 9.1724;
      const uLng = Number(userLocation?.longitude) || 77.8694;

      if (!mLat || !mLng || isNaN(mLat) || isNaN(mLng)) return;

      setIsLoadingRoute(true);
      try {
        const routeData = await fetchRoute(uLat, uLng, mLat, mLng);
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
    [userLocation]
  );

  /**
   * Select a merchant from marker click or nearby list
   */
  const handleSelectMerchant = (merchant) => {
    setSelectedMerchant(merchant);
    setHasArrived(false);
    if (merchant.latitude && merchant.longitude) {
      setMapCenter([Number(merchant.latitude), Number(merchant.longitude)]);
    }
    calculateRoadRoute(merchant);
    if (onSelectMerchantProp) onSelectMerchantProp(merchant);
  };

  /**
   * Select a location from autocomplete search (moves map to that real location)
   */
  const handleSelectLocation = (loc) => {
    if (loc && loc.latitude && loc.longitude) {
      setMapCenter([Number(loc.latitude), Number(loc.longitude)]);
      const newLoc = {
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        accuracy: 25.0,
        address: loc.address || loc.displayName,
        displayName: loc.displayName,
      };
      setUserLocation(newLoc);
      if (onUserLocationChange) onUserLocationChange(newLoc);
    }
  };

  /**
   * Clear search and return to real device GPS location
   */
  const handleClearToCurrentLocation = () => {
    setSearchQuery("");
    startLocationWatch();
  };

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

  return (
    <div className={className} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
      {/* Top Search Bar & Proximity Controls Overlay */}
      <div
        style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          right: "14px",
          zIndex: 1000,
          maxWidth: "620px",
          margin: "0 auto",
        }}
      >
        <NearbySearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          radiusKm={radiusKm}
          onRadiusChange={onRadiusChange || (() => {})}
          selectedCategory={selectedCategory}
          onCategoryChange={onCategoryChange}
          merchants={merchants}
          foodItems={foodItems}
          onSelectMerchant={handleSelectMerchant}
          onSelectLocation={handleSelectLocation}
          onClearToCurrentLocation={handleClearToCurrentLocation}
          onDirections={handleSelectMerchant}
          userLocation={userLocation}
        />
      </div>

      {/* Loading Location Indicator Banner */}
      {isDetectingLocation && (
        <div
          style={{
            position: "absolute",
            top: "115px",
            left: "14px",
            right: "14px",
            zIndex: 1000,
            maxWidth: "340px",
            margin: "0 auto",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
            borderRadius: "14px",
            padding: "8px 16px",
            color: "#145C52",
            border: "1px solid #BDE8DE",
            boxShadow: "0 6px 20px rgba(20, 92, 82, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          <span className="animate-spin">⏳</span>
          <span>Acquiring real device GPS location...</span>
        </div>
      )}

      {/* Permission Denied Notification Card */}
      {gpsPermissionState === "denied" && (
        <div
          style={{
            position: "absolute",
            top: "115px",
            left: "14px",
            right: "14px",
            zIndex: 1000,
            maxWidth: "460px",
            margin: "0 auto",
            background: "#FFFFFF",
            borderRadius: "18px",
            padding: "16px 20px",
            color: "#102A2A",
            border: "1px solid #FCA5A5",
            boxShadow: "0 12px 32px rgba(220, 38, 38, 0.15)",
            textAlign: "center",
            fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 800, color: "#DC2626", marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <span>📍</span>
            <span>Location Access Denied</span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#687674", lineHeight: 1.4 }}>
            {gpsErrorMessage || "Please enable location permission in your browser to discover restaurants near you, or search manually above."}
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={startLocationWatch}
              style={{
                background: "#145C52",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main Map View Area */}
      <div style={{ position: "relative", width: "100%", height: style.height || "560px" }}>
        <MapContainer
          center={mapCenter}
          zoom={14}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <MapViewUpdater center={mapCenter} zoom={14} bounds={routeBounds} />

          {/* Real OpenStreetMap Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Proximity Search Radar Circle (1 km, 2 km, 5 km, 10 km) */}
          {radiusKm && userLocation?.latitude && userLocation?.longitude && (
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
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

          {/* 1. Distinctive Blue Location Marker (Customer Real GPS position only) */}
          {userLocation?.latitude && userLocation?.longitude && (
            <CurrentLocationMarker
              location={userLocation}
              showAccuracyCircle={!isNavigating}
            />
          )}

          {/* 2. Discovered Businesses & FoodSaver Partners */}
          {merchants.map((merchant) => {
            const isSelected =
              selectedMerchant &&
              String(selectedMerchant.id || selectedMerchant.hotelId) ===
                String(merchant.id || merchant.hotelId);
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

          {/* 3. Real Road Route Polyline */}
          {route && route.length >= 2 && (
            <>
              <Polyline
                positions={route}
                pathOptions={{
                  color: "#0F4C45",
                  weight: 8,
                  opacity: 0.4,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
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

          {/* Floating Zoom and Recenter Controls */}
          <LeafletMapControls
            onRecenter={() => {
              setMapCenter([userLocation.latitude, userLocation.longitude]);
              startLocationWatch();
            }}
            isSelected={Boolean(selectedMerchant)}
          />
        </MapContainer>

        {/* Toggleable Responsive Nearby Places Sidebar on Desktop / Bottom Sheet on Mobile */}
        <div
          className={`absolute top-28 left-4 z-40 transition-all duration-300 ${
            showPlacesDrawer ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
          }`}
          style={{
            maxWidth: "340px",
            width: "calc(100% - 32px)",
            maxHeight: "calc(100% - 130px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "20px",
              border: "1px solid #DCE6E3",
              boxShadow: "0 12px 36px rgba(20, 92, 82, 0.14)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "100%",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "10px 14px",
                background: "#F7FAF9",
                borderBottom: "1px solid #DCE6E3",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>🏪</span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#145C52" }}>
                  Nearby Places ({merchants.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPlacesDrawer(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#687674",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
                title="Hide list"
              >
                ✕
              </button>
            </div>

            {/* List of cards */}
            <div style={{ overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {merchants.length === 0 ? (
                <div style={{ padding: "20px 14px", textAlign: "center", color: "#687674", fontSize: "12px" }}>
                  <span style={{ fontSize: "24px", display: "block", marginBottom: "6px" }}>🍽️</span>
                  <strong>No places found nearby</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "11px" }}>
                    Try expanding search radius to 5 km or 10 km.
                  </p>
                </div>
              ) : (
                merchants.map((m) => {
                  const isSelected =
                    selectedMerchant &&
                    String(selectedMerchant.id || selectedMerchant.hotelId) ===
                      String(m.id || m.hotelId);
                  const isPartner = m.isFoodSaverPartner !== false;
                  const deals = Number(m.availableFoodCount || 0);

                  return (
                    <div
                      key={m.id || m.hotelId}
                      onClick={() => handleSelectMerchant(m)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "14px",
                        border: isSelected ? "2px solid #145C52" : "1px solid #E8F0EE",
                        background: isSelected ? "#E8F4F1" : "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "12px" }}>{isPartner ? "🍱" : "🍽️"}</span>
                            <span style={{ fontSize: "12px", fontWeight: 800, color: "#102A2A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.businessName || m.hotelName || m.name}
                            </span>
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#687674", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.cuisine || m.category || "Restaurant"} • {m.address || "Verified Location"}
                          </div>
                        </div>

                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#145C52", whiteSpace: "nowrap" }}>
                          {m.distanceText || (m.distance ? `${m.distance} km` : "")}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", paddingTop: "4px", borderTop: "1px dashed #E8F0EE" }}>
                        {isPartner ? (
                          <span style={{ fontSize: "10px", fontWeight: 800, color: deals > 0 ? "#FF9F43" : "#145C52" }}>
                            {deals > 0 ? `🔥 ${deals} Surplus Deals` : "✓ FoodSaver Partner"}
                          </span>
                        ) : (
                          <span style={{ fontSize: "10px", fontWeight: 600, color: "#687674" }}>
                            Discovered Restaurant
                          </span>
                        )}

                        <span style={{ fontSize: "10px", color: "#145C52", fontWeight: 700 }}>
                          Select ➔
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Floating Button to open list when drawer is closed */}
        {!showPlacesDrawer && (
          <button
            type="button"
            onClick={() => setShowPlacesDrawer(true)}
            style={{
              position: "absolute",
              top: "100px",
              left: "14px",
              zIndex: 900,
              background: "#FFFFFF",
              border: "1.5px solid #16796B",
              color: "#145C52",
              padding: "7px 14px",
              borderRadius: "14px",
              fontSize: "11.5px",
              fontWeight: 800,
              boxShadow: "0 6px 18px rgba(20, 92, 82, 0.15)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🏪</span>
            <span>View Places ({merchants.length})</span>
          </button>
        )}

        {/* Directions & Navigation Card */}
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
    </div>
  );
}
