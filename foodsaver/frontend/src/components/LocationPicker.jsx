import React, { useState, useEffect, useRef } from "react";
import { getCurrentLocation, reverseGeocode, searchLocation } from "../services/locationService.js";

/**
 * LocationPicker with Real Browser GPS, Real Geocoding Search (OSM Nominatim),
 * and Reverse Geocoding Address display.
 */
export default function LocationPicker({
  currentLocation,
  locationState = "granted", // "loading" | "granted" | "denied" | "unavailable" | "poor_accuracy"
  onLocationUpdate,
  onRequestPermission,
}) {
  const [detecting, setDetecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocation(searchQuery);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        console.error("Geocoding error:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Use Real Browser GPS
  const handleUseMyLocation = async () => {
    setDetecting(true);
    try {
      const pos = await getCurrentLocation({ enableHighAccuracy: true, timeout: 12000 });
      const address = await reverseGeocode(pos.latitude, pos.longitude);
      onLocationUpdate({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy || 10,
        timestamp: pos.timestamp || Date.now(),
        address: address || "Current Location",
      });
      setSearchQuery("");
      setShowDropdown(false);
    } catch (err) {
      if (onRequestPermission) onRequestPermission(err);
    } finally {
      setDetecting(false);
    }
  };

  // Select searched location
  const handleSelectLocation = (loc) => {
    onLocationUpdate({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: 20,
      timestamp: Date.now(),
      address: loc.displayName || loc.city,
    });
    setSearchQuery(loc.city || loc.displayName.split(",")[0]);
    setShowDropdown(false);
  };

  return (
    <div className="bg-white border border-[#D8E5E2] rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        {/* Top Row: Search Location Bar + "Use My Location" Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Geocoding Search Input */}
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9490] text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search location (e.g. Chennai, Kovilpatti, Madurai, Coimbatore...)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true);
                }}
                className="w-full bg-[#F7FAF9] border border-[#D8E5E2] rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition-all shadow-xs"
              />
              {searching ? (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#8A9490] animate-spin">
                  ⏳
                </span>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9490] hover:text-[#172321] text-xs font-bold"
                >
                  ✕
                </button>
              ) : null}
            </div>

            {/* Live Search Suggestions Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#D8E5E2] rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.map((res, idx) => (
                  <button
                    key={`${res.latitude}-${res.longitude}-${idx}`}
                    type="button"
                    onClick={() => handleSelectLocation(res)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#F7FAF9] transition-colors flex items-start gap-2.5 border-b border-[#E8F0EE] last:border-b-0"
                  >
                    <span className="text-base text-[#176B5B] mt-0.5">📍</span>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs text-[#172321] font-bold truncate">
                        {res.city || res.displayName.split(",")[0]}
                      </strong>
                      <span className="block text-[11px] text-[#65736F] truncate">
                        {res.displayName}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Location Button: "📍 Use My Location" */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={detecting}
            className="px-4 py-2.5 bg-[#176B5B] hover:bg-[#0D4037] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 disabled:opacity-50"
          >
            <span>{detecting ? "⏳" : "📍"}</span>
            <span>{detecting ? "Acquiring GPS..." : "Use My Location"}</span>
          </button>
        </div>

        {/* Bottom Row: Current Location Display & GPS Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E8F0EE]">
          <div className="flex items-center gap-2.5">
            <span className="text-[#176B5B] text-sm">📍</span>
            <span className="text-xs font-semibold text-[#65736F]">Current Location:</span>
            <strong className="text-xs sm:text-sm font-bold text-[#172321] truncate max-w-md">
              {currentLocation?.address || "Detecting live location..."}
            </strong>
          </div>

          {currentLocation?.latitude && currentLocation?.longitude && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#65736F] font-mono">
                {Number(currentLocation.latitude).toFixed(4)}° N, {Number(currentLocation.longitude).toFixed(4)}° E
              </span>
              {locationState === "granted" && (
                <span className="text-[10px] font-bold bg-[#DDF4EE] text-[#176B5B] px-2.5 py-0.5 rounded-full border border-[#BDE8DE]">
                  GPS Active
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* State-specific Warning Banners */}
      {locationState === "denied" && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <span>Location permission is required to find FoodSaver stores near you.</span>
          <button
            type="button"
            onClick={onRequestPermission}
            className="underline font-bold hover:text-rose-900"
          >
            Enable Now
          </button>
        </div>
      )}

      {locationState === "unavailable" && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          Unable to detect your device location. Please search your city above.
        </div>
      )}

      {locationState === "poor_accuracy" && (
        <div className="mt-3 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs">
          Your location accuracy is low. Move to an open area and click "Use My Location".
        </div>
      )}
    </div>
  );
}
