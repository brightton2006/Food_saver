import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { api, API_BASE } from "../../lib/api.js";
import { useCart } from "../../lib/cart.jsx";
import { useSession } from "../../lib/session.jsx";
import { addMyClaim } from "../../lib/myClaims.js";
import { getFoodFallbackImage } from "../../lib/foodImageService.js";
import RealMap from "../../components/RealMap.jsx";
import StoreMap from "../../components/StoreMap.jsx";
import LocationPicker from "../../components/LocationPicker.jsx";
import NearbyStores from "../../components/NearbyStores.jsx";
import LocationPermissionModal from "../../components/LocationPermissionModal.jsx";
import PaymentModal from "../../components/PaymentModal.jsx";
import {
  getCurrentLocation,
  watchUserLocation,
  clearWatch,
  reverseGeocode,
  fetchNearbyMerchants,
  fetchNearbyFood,
  openDirections,
  syncUserLocationToBackend,
  DEFAULT_COORDINATES,
} from "../../services/locationService.js";

const CATEGORIES = [
  { id: "All", label: "All Near Me", icon: "🍽️" },
  { id: "South Indian", label: "South Indian", icon: "🥟" },
  { id: "Biryani", label: "Biryani & Meals", icon: "🍛" },
  { id: "Fast Food", label: "Pizza & Fast Food", icon: "🍕" },
  { id: "Beverages", label: "Beverages & Milk", icon: "☕" },
  { id: "Starters", label: "Starters & Snacks", icon: "🍗" },
];

const RADIUS_OPTIONS = [
  { value: 0.5, label: "500 m" },
  { value: 1.0, label: "1 km" },
  { value: 2.0, label: "2 km", isDefault: true },
  { value: 5.0, label: "5 km" },
  { value: 10.0, label: "10 km" },
];

// Live Countdown Timer component
function CountdownBadge({ initialSeconds = 5079 }) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 5000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return (
    <div className="bg-black/75 backdrop-blur-md text-white font-extrabold text-[11px] px-2.5 py-1 rounded-full border border-white/20 shadow flex items-center gap-1.5">
      <span className="text-[12px] animate-pulse">⏱️</span>
      <span>{mins}m {secs < 10 ? `0${secs}` : secs}s</span>
    </div>
  );
}

export default function NearbyFood() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { addItem } = useCart();

  // Location State
  const [userLocation, setUserLocation] = useState(DEFAULT_COORDINATES);
  const [locationStatus, setLocationStatus] = useState("loading"); // "loading" | "granted" | "denied" | "unavailable" | "poor_accuracy"
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Data States
  const [merchants, setMerchants] = useState([]);
  const [nearbyListings, setNearbyListings] = useState([]);
  const [selectedMerchantFilter, setSelectedMerchantFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMerchants, setLoadingMerchants] = useState(false);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [radiusKm, setRadiusKm] = useState(2.0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("distance"); // "distance" | "discount" | "price_asc" | "rating"
  const [dietaryFilter, setDietaryFilter] = useState("all"); // "all" | "veg" | "nonveg"
  const [activeTab, setActiveTab] = useState("food"); // "food" | "stores"
  const [viewMode, setViewMode] = useState("stacked"); // "stacked" | "split" | "list" | "map"
  const [hoveredListingId, setHoveredListingId] = useState(null);

  // Order/Claim Modal State
  const [claimingListing, setClaimingListing] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [realtimeNotification, setRealtimeNotification] = useState(null);
  const socketRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // 1. Initial Real Device Location Request on Mount
  useEffect(() => {
    detectRealLocation();
  }, []);

  const detectRealLocation = async () => {
    setLocationStatus("loading");
    try {
      const pos = await getCurrentLocation({ enableHighAccuracy: true, timeout: 10000 });
      const address = await reverseGeocode(pos.latitude, pos.longitude);

      const detected = {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy || 15.0,
        timestamp: pos.timestamp || Date.now(),
        address,
      };

      setUserLocation(detected);
      setLocationStatus("granted");

      // Background sync to backend if user is logged in
      if (session?.userId) {
        syncUserLocationToBackend(session.userId, pos.latitude, pos.longitude, address, pos.accuracy);
      }
    } catch (err) {
      console.warn("Location detection note:", err);
      setLocationStatus(err.code === 1 ? "denied" : "unavailable");
      // Fallback gracefully to default coordinates
      setUserLocation(DEFAULT_COORDINATES);
    }
  };

  // 2. Fetch Nearby Stores & Food whenever Location or Radius Changes
  useEffect(() => {
    if (!userLocation.latitude || !userLocation.longitude) return;
    loadNearbyData();
  }, [userLocation.latitude, userLocation.longitude, radiusKm, selectedCategory]);

  const loadNearbyData = async () => {
    setLoading(true);
    setLoadingMerchants(true);

    try {
      // Parallel fetch for speed & accuracy
      const [merchantsData, foodData] = await Promise.all([
        fetchNearbyMerchants(userLocation.latitude, userLocation.longitude, radiusKm),
        fetchNearbyFood(
          userLocation.latitude,
          userLocation.longitude,
          radiusKm,
          selectedCategory === "All" ? null : selectedCategory
        ),
      ]);

      setMerchants(merchantsData);
      setNearbyListings(foodData);
    } catch (err) {
      console.error("Failed to load nearby data:", err);
    } finally {
      setLoading(false);
      setLoadingMerchants(false);
    }
  };

  // 3. Socket.io Live Real-Time Integration for Fresh Surplus Food Alerts
  useEffect(() => {
    try {
      const socket = io(API_BASE, { reconnectionDelayMax: 10000 });
      socketRef.current = socket;

      // Join location radius room
      socket.emit("join_location_radar", {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radiusKm,
      });

      // Listen for new surplus food posted nearby
      socket.on("new_nearby_listing", (newListing) => {
        setRealtimeNotification({
          title: "Fresh Surplus Deal Near You! 🔥",
          message: `${newListing.foodName || newListing.itemName} posted by ${newListing.merchantName || newListing.hotelName}`,
          listing: newListing,
        });

        // Add to active listings if within radius
        setNearbyListings((prev) => [newListing, ...prev]);
        setTimeout(() => setRealtimeNotification(null), 8000);
      });

      // Listen for claimed or expired listings to update quantity live
      socket.on("listing_quantity_updated", ({ listingId, quantityAvailable }) => {
        setNearbyListings((prev) =>
          prev.map((item) =>
            item.id === listingId ? { ...item, quantityAvailable } : item
          )
        );
      });

      return () => {
        socket.disconnect();
      };
    } catch (e) {
      console.warn("Socket connection note:", e);
    }
  }, [userLocation.latitude, userLocation.longitude, radiusKm]);

  // 4. Client-side Processing: Search Query, Dietary Filter, Sorting, Merchant Filter
  const processedListings = useMemo(() => {
    let result = [...nearbyListings];

    // Merchant filter (from map click or store select)
    if (selectedMerchantFilter) {
      const mId = selectedMerchantFilter.id || selectedMerchantFilter.hotelId || selectedMerchantFilter.merchantId;
      result = result.filter(
        (item) => String(item.merchantId) === String(mId) || String(item.hotelId) === String(mId)
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.foodName?.toLowerCase().includes(q) ||
          item.itemName?.toLowerCase().includes(q) ||
          item.merchantName?.toLowerCase().includes(q) ||
          item.hotelName?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    }

    // Dietary filter
    if (dietaryFilter === "veg") {
      result = result.filter((item) => item.isVeg === true);
    } else if (dietaryFilter === "nonveg") {
      result = result.filter((item) => item.isVeg === false);
    }

    // Sorting
    if (sortBy === "distance") {
      result.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    } else if (sortBy === "discount") {
      result.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
    } else if (sortBy === "price_asc") {
      result.sort((a, b) => (a.price || a.discountPrice || 0) - (b.price || b.discountPrice || 0));
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return result;
  }, [nearbyListings, selectedMerchantFilter, searchQuery, dietaryFilter, sortBy]);

  return (
    <div className="min-h-screen bg-[#F7FAF9] text-[#172321] font-sans pb-28 selection:bg-[#176B5B] selection:text-white">
      {/* Real-time Push Alert Banner */}
      {realtimeNotification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] bg-[#176B5B] text-white p-3.5 rounded-2xl shadow-xl border border-[#BDE8DE]/40 flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔥</span>
            <div>
              <strong className="text-xs sm:text-sm block font-bold">{realtimeNotification.title}</strong>
              <span className="text-xs text-[#DDF4EE] line-clamp-1">{realtimeNotification.message}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (realtimeNotification.listing) {
                setClaimingListing(realtimeNotification.listing);
              }
              setRealtimeNotification(null);
            }}
            className="px-3 py-1.5 bg-white hover:bg-[#F7FAF9] text-[#176B5B] font-bold text-xs rounded-xl whitespace-nowrap shadow-xs"
          >
            View Deal
          </button>
        </div>
      )}

      {/* Toast Notification Floating Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-[#D8E5E2] text-[#176B5B] font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Location & Controls Bar */}
      <div className="bg-white border-b border-[#D8E5E2] sticky top-0 z-40 px-4 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          {/* Real GPS Location Picker */}
          <LocationPicker
            currentLocation={userLocation}
            locationState={locationStatus}
            onLocationUpdate={(newLoc) => {
              setUserLocation(newLoc);
              setLocationStatus("granted");
              showToast(`📍 Location updated to: ${newLoc.address || "Selected Location"}`);
            }}
            onRequestPermission={() => setShowLocationModal(true)}
          />

          {/* Row 1: Search & Radius Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A9490] text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search nearby surplus food, dishes, restaurants, bakeries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F7FAF9] border border-[#D8E5E2] rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9490] hover:text-[#172321] text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Radar Radius Controls */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
              <span className="text-xs text-[#65736F] font-bold whitespace-nowrap flex items-center gap-1">
                <span>🎯</span> Radar Radius:
              </span>
              <div className="flex bg-[#EDF3F1] p-1 rounded-xl border border-[#D8E5E2]">
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRadiusKm(opt.value)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      Number(radiusKm) === opt.value
                        ? "bg-[#176B5B] text-white shadow-xs scale-105"
                        : "text-[#65736F] hover:text-[#172321]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle: Stacked / Split / Grid / Map */}
              <div className="flex bg-[#EDF3F1] p-1 rounded-xl border border-[#D8E5E2] ml-1">
                <button
                  type="button"
                  onClick={() => setViewMode("stacked")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    viewMode === "stacked" ? "bg-[#176B5B] text-white shadow-xs" : "text-[#65736F] hover:text-[#172321]"
                  }`}
                  title="Interactive Map + Food Cards (Section 27 layout)"
                >
                  🗺️ Map & Food
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("split")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    viewMode === "split" ? "bg-[#176B5B] text-white shadow-xs" : "text-[#65736F] hover:text-[#172321]"
                  }`}
                  title="Split Cards & Map View"
                >
                  ⚡ Split
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    viewMode === "list" ? "bg-[#176B5B] text-white shadow-xs" : "text-[#65736F] hover:text-[#172321]"
                  }`}
                  title="Food Grid Only"
                >
                  🍱 Food Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    viewMode === "map" ? "bg-[#176B5B] text-white shadow-xs" : "text-[#65736F] hover:text-[#172321]"
                  }`}
                  title="Full Map View"
                >
                  🌐 Map Only
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Categories Ribbon & Dietary Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-[#E8F0EE]">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? "bg-[#176B5B] text-white shadow-xs scale-105 border border-transparent"
                      : "bg-white hover:bg-[#F7FAF9] text-[#65736F] border border-[#D8E5E2]"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Dietary Filter & Sort Dropdown */}
            <div className="flex items-center gap-2">
              <div className="flex bg-[#EDF3F1] p-1 rounded-xl border border-[#D8E5E2] text-xs">
                <button
                  type="button"
                  onClick={() => setDietaryFilter("all")}
                  className={`px-2.5 py-1 font-bold rounded-lg transition-all ${
                    dietaryFilter === "all" ? "bg-[#176B5B] text-white shadow-xs" : "text-[#65736F]"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setDietaryFilter("veg")}
                  className={`px-2.5 py-1 font-bold rounded-lg transition-all ${
                    dietaryFilter === "veg" ? "bg-[#2E8B72] text-white shadow-xs" : "text-[#65736F]"
                  }`}
                >
                  🟢 Veg
                </button>
                <button
                  type="button"
                  onClick={() => setDietaryFilter("nonveg")}
                  className={`px-2.5 py-1 font-bold rounded-lg transition-all ${
                    dietaryFilter === "nonveg" ? "bg-[#D95C5C] text-white shadow-xs" : "text-[#65736F]"
                  }`}
                >
                  🔴 Non-Veg
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-[#D8E5E2] rounded-xl px-3 py-1.5 text-xs font-bold text-[#172321] focus:outline-none focus:border-[#176B5B] cursor-pointer shadow-xs"
              >
                <option value="distance">📍 Closest First</option>
                <option value="discount">🔥 Max Discount %</option>
                <option value="price_asc">💵 Price: Low to High</option>
                <option value="rating">⭐ Highest Rated</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        {/* Active Filter Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-[#172321] tracking-tight flex items-center gap-2">
              <span>Surplus food deals available near your location</span>
            </h2>
            <span className="text-xs bg-[#DDF4EE] text-[#176B5B] border border-[#BDE8DE] px-3 py-0.5 rounded-full font-bold">
              {processedListings.length} deals • {merchants.length} stores
            </span>
          </div>

          {selectedMerchantFilter && (
            <div className="flex items-center gap-2 bg-[#DDF4EE] border border-[#BDE8DE] px-3 py-1 rounded-xl text-xs text-[#176B5B] font-bold shadow-xs">
              <span>🏪 Filtering by: {selectedMerchantFilter.businessName || selectedMerchantFilter.hotelName}</span>
              <button
                type="button"
                onClick={() => setSelectedMerchantFilter(null)}
                className="text-[#172321] hover:text-rose-600 font-black ml-1"
                title="Clear filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Tab Toggle: Food Deals vs Nearby Stores */}
        <div className="flex border-b border-[#D8E5E2] mb-6 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("food")}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "food" ? "text-[#176B5B]" : "text-[#65736F] hover:text-[#172321]"
            }`}
          >
            <span>🍱 Available Surplus Food Deals</span>
            <span className="bg-[#DDF4EE] text-[#176B5B] text-xs px-2.5 py-0.5 rounded-full font-bold">
              {processedListings.length}
            </span>
            {activeTab === "food" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#176B5B] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stores")}
            className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "stores" ? "text-[#176B5B]" : "text-[#65736F] hover:text-[#172321]"
            }`}
          >
            <span>🏪 Nearby FoodSaver Merchants</span>
            <span className="bg-[#EDF3F1] text-[#65736F] text-xs px-2.5 py-0.5 rounded-full font-bold border border-[#D8E5E2]">
              {merchants.length}
            </span>
            {activeTab === "stores" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#176B5B] rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1: FOOD DEALS */}
        {activeTab === "food" && (
          <div className="space-y-8">
            {/* Top Interactive Live Leaflet Map (Section 27 Stacked UX) */}
            {(viewMode === "stacked" || viewMode === "map") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🗺️</span>
                    <h3 className="font-bold text-[#172321] text-sm sm:text-base">
                      Interactive Live Map & Real-World Locations
                    </h3>
                  </div>
                  <span className="text-xs text-[#65736F] hidden sm:inline font-medium">
                    Click any store pin for details or instant directions
                  </span>
                </div>
                <RealMap
                  userLocation={userLocation}
                  merchants={merchants}
                  foodItems={nearbyListings}
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  onUserLocationChange={setUserLocation}
                  onSelectMerchant={(m) => {
                    setSelectedMerchantFilter(m);
                    const foodEl = document.getElementById("nearby-food-grid");
                    if (foodEl) foodEl.scrollIntoView({ behavior: "smooth" });
                  }}
                  onViewFood={(m) => {
                    setSelectedMerchantFilter(m);
                    const foodEl = document.getElementById("nearby-food-grid");
                    if (foodEl) foodEl.scrollIntoView({ behavior: "smooth" });
                  }}
                  onRecenter={detectRealLocation}
                  style={{ height: viewMode === "map" ? "650px" : "480px", width: "100%" }}
                  className={`w-full ${viewMode === "map" ? "h-[650px]" : "h-[480px]"} rounded-2xl shadow-card border border-[#D8E5E2] relative overflow-hidden`}
                />
              </div>
            )}

            {/* Food Deals Section */}
            {viewMode !== "map" && (
              <div id="nearby-food-grid" className="pt-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🍱</span>
                    <h3 className="font-black text-[#172321] text-base sm:text-lg">
                      Nearby Food
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#65736F]">
                    {processedListings.length} deals available within {radiusKm} km
                  </span>
                </div>

                <div className={viewMode === "split" ? "grid grid-cols-1 md:grid-cols-12 gap-6 items-start" : ""}>
                  <div className={viewMode === "split" ? "md:col-span-7 lg:col-span-7" : ""}>
                    {loading ? (
                      <div className={`grid ${viewMode === "split" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"} gap-5`}>
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <div
                            key={n}
                            className="bg-white border border-[#D8E5E2] rounded-2xl h-96 animate-pulse"
                          />
                        ))}
                      </div>
                    ) : processedListings.length === 0 ? (
                      <div className="bg-white border border-[#D8E5E2] rounded-2xl p-10 text-center text-[#65736F] shadow-sm">
                        <span className="text-5xl block mb-3 animate-pulse">🍱</span>
                        <h3 className="text-lg font-bold text-[#172321] mb-1">
                          No surplus food deals found within {radiusKm} km.
                        </h3>
                        <p className="text-xs text-[#65736F] max-w-sm mx-auto mb-5 leading-relaxed">
                          Local restaurants and bakeries typically post end-of-day surplus deals closer to closing hours.
                          Try expanding your search radius to 5 km or 10 km!
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setRadiusKm(5.0);
                            setSelectedCategory("All");
                            setDietaryFilter("all");
                            setSearchQuery("");
                            setSelectedMerchantFilter(null);
                          }}
                          className="px-5 py-2.5 bg-[#176B5B] hover:bg-[#0D4037] text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                        >
                          Expand Radar to 5 km & Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div className={`grid ${viewMode === "split" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"} gap-5`}>
                        {processedListings.map((item, idx) => {
                          const isHovered = String(item.id) === String(hoveredListingId);
                          const discount = item.discountPercentage || 30;
                          const isVeg = item.isVeg === true;
                          const photo =
                            item.imageUrl ||
                            getFoodFallbackImage(item.foodName || item.itemName, item.category);

                          return (
                            <div
                              key={item.id}
                              onMouseEnter={() => setHoveredListingId(item.id)}
                              onMouseLeave={() => setHoveredListingId(null)}
                              className={`bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-pop transition-all duration-300 flex flex-col border ${
                                isHovered
                                  ? "border-[#176B5B] shadow-md scale-[1.015]"
                                  : "border-[#D8E5E2]"
                              }`}
                            >
                              {/* Image Header with Countdown & Badges */}
                              <div className="h-44 relative flex flex-col justify-between p-3 overflow-hidden bg-slate-100">
                                <img
                                  src={photo}
                                  alt={item.foodName || item.itemName}
                                  className="absolute inset-0 w-full h-full object-cover transition-opacity"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = getFoodFallbackImage(
                                      item.foodName || item.itemName,
                                      item.category
                                    );
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />

                                {/* Top Badges */}
                                <div className="flex items-center justify-between relative z-10">
                                  {isVeg ? (
                                    <div className="bg-[#176B5B] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow">
                                      <span className="w-2 h-2 rounded-full bg-white" />
                                      <span>Veg</span>
                                    </div>
                                  ) : (
                                    <div className="bg-[#D95C5C] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow">
                                      <span className="w-2 h-2 rounded-full bg-white" />
                                      <span>Non-Veg</span>
                                    </div>
                                  )}

                                  <CountdownBadge initialSeconds={5079 - idx * 120} />
                                </div>

                                {/* Discount Pill (Warm Apricot / Deal Highlight) */}
                                <div className="absolute -bottom-2.5 left-4 z-20 bg-[#F4A261] text-[#7A3600] font-black text-xs px-3 py-1 rounded-full shadow-xs border border-[#F4A261]/30">
                                  🔥 {discount}% OFF
                                </div>
                              </div>

                              {/* Card Content Body */}
                              <div className="p-4 pt-5 flex-1 flex flex-col justify-between text-[#172321]">
                                <div>
                                  {/* Title & Rating */}
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-bold text-base text-[#172321] leading-tight">
                                      {item.foodName || item.itemName}
                                    </h3>
                                    <div className="bg-[#DDF4EE] border border-[#BDE8DE] text-[#176B5B] text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap shadow-xs">
                                      <span>★</span>
                                      <span>{item.rating || 4.7}</span>
                                    </div>
                                  </div>

                                  {/* Store Name & Category */}
                                  <p className="text-xs font-semibold text-[#65736F] mt-1">
                                    By <strong className="text-[#172321]">{item.merchantName || item.hotelName}</strong> •{" "}
                                    {item.category || "Surplus"}
                                  </p>

                                  {/* Distance & Location */}
                                  <div className="flex items-center justify-between gap-2 mt-2 text-xs text-[#65736F]">
                                    <div className="flex items-center gap-1 truncate">
                                      <span>📍</span>
                                      <span className="truncate">{item.address || "Local FoodSaver Partner"}</span>
                                    </div>
                                    <span className="font-bold text-[#176B5B] whitespace-nowrap">
                                      {item.distanceText || `${item.distanceKm || 1.2} km`}
                                    </span>
                                  </div>

                                  <div className="border-b border-dashed border-[#E8F0EE] my-3" />

                                  {/* Price & Quantity Available */}
                                  <div className="flex items-baseline justify-between">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-xl font-black text-[#172321]">
                                        ₹{item.price || item.discountPrice}
                                      </span>
                                      {(item.originalPrice || 0) > (item.price || item.discountPrice) && (
                                        <span className="text-xs text-[#8A9490] line-through font-medium">
                                          ₹{item.originalPrice}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-bold text-[#B45309] bg-[#FFF0DD] px-2 py-0.5 rounded-md border border-[#F4A261]/30">
                                      {item.quantityAvailable || 1} available
                                    </span>
                                  </div>
                                </div>

                                {/* Pickup Window & Actions */}
                                <div className="flex items-center justify-between mt-4 pt-1 gap-2 flex-wrap sm:flex-nowrap">
                                  <span className="text-[11px] font-semibold text-[#65736F] flex items-center gap-1">
                                    ⏰ Pickup: {item.pickupWindowStart || "8:30 PM"} – {item.pickupWindowEnd || "10:00 PM"}
                                  </span>

                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDirections(item.latitude || item.lat, item.longitude || item.lng);
                                      }}
                                      className="bg-[#F7FAF9] hover:bg-[#EDF3F1] active:scale-95 text-[#172321] font-semibold text-xs px-2.5 py-2 rounded-xl border border-[#D8E5E2] transition-all flex items-center gap-1 shadow-xs"
                                      title="Open Directions in Google Maps"
                                    >
                                      <span>🧭</span> Directions
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addItem(item);
                                        showToast(`Added "${item.foodName || item.itemName}" to cart! 🛍️`);
                                      }}
                                      className="bg-[#F7FAF9] hover:bg-[#EDF3F1] active:scale-95 text-[#172321] font-semibold text-xs px-3 py-2 rounded-xl border border-[#D8E5E2] transition-all"
                                      title="Add item to your cart"
                                    >
                                      + Cart
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setClaimingListing(item)}
                                      className="bg-[#176B5B] hover:bg-[#0D4037] active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all whitespace-nowrap"
                                    >
                                      View Deal
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Split mode right column: RealMap */}
                  {viewMode === "split" && (
                    <div className="md:col-span-5 lg:col-span-5 sticky top-28">
                      <RealMap
                        userLocation={userLocation}
                        merchants={merchants}
                        foodItems={nearbyListings}
                        radiusKm={radiusKm}
                        onRadiusChange={setRadiusKm}
                        onUserLocationChange={setUserLocation}
                        onSelectMerchant={(m) => setSelectedMerchantFilter(m)}
                        onViewFood={(m) => setSelectedMerchantFilter(m)}
                        onRecenter={detectRealLocation}
                        style={{ height: "540px", width: "100%" }}
                        className="w-full h-[540px] rounded-2xl shadow-card border border-[#D8E5E2] relative overflow-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NEARBY STORES LIST */}
        {activeTab === "stores" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-6 lg:col-span-6">
              <NearbyStores
                merchants={merchants}
                loading={loadingMerchants}
                selectedMerchantId={selectedMerchantFilter?.id || selectedMerchantFilter?.hotelId}
                onSelectMerchant={(m) => setSelectedMerchantFilter(m)}
                onViewFood={(m) => {
                  setSelectedMerchantFilter(m);
                  setActiveTab("food");
                }}
              />
            </div>

            <div className="md:col-span-6 lg:col-span-6 sticky top-28">
              <RealMap
                userLocation={userLocation}
                merchants={merchants}
                foodItems={nearbyListings}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                onUserLocationChange={setUserLocation}
                onSelectMerchant={(m) => setSelectedMerchantFilter(m)}
                onViewFood={(m) => {
                  setSelectedMerchantFilter(m);
                  setActiveTab("food");
                }}
                onRecenter={detectRealLocation}
                style={{ height: "540px", width: "100%" }}
                className="w-full h-[540px] rounded-2xl shadow-card border border-[#D8E5E2] relative overflow-hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* Permission Request Modal */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationGranted={(coords) => {
          setUserLocation((prev) => ({
            ...prev,
            latitude: coords.latitude,
            longitude: coords.longitude,
          }));
          setLocationStatus("granted");
          reverseGeocode(coords.latitude, coords.longitude).then((addr) => {
            setUserLocation((prev) => ({ ...prev, address: addr }));
            showToast(`📍 Location updated to: ${addr}`);
          });
        }}
        onManualSelect={() => {
          setUserLocation(DEFAULT_COORDINATES);
          setLocationStatus("granted");
          showToast("Location set to Kovilpatti Center.");
        }}
      />

      {/* Instant Claim / Payment Modal */}
      {claimingListing && (
        <PaymentModal
          listing={claimingListing}
          open={Boolean(claimingListing)}
          onClose={() => setClaimingListing(null)}
          onComplete={async (listingObj, quantity) => {
            try {
              const custId =
                session?.userId || session?.id || session?.username || session?.email || "guest";
              const res = await api.claimListing(listingObj.id, {
                customerId: custId,
                customerName: session?.name || "Resident Customer",
                customerUsername: session?.username || "resident_customer",
                quantity: quantity || 1,
              });
              if (res && res.claim) {
                addMyClaim(res.claim, custId);
                showToast("🎉 Surplus meal deal claimed successfully!");
                return res;
              }
            } catch (e) {
              console.error("Claim error in NearbyFood:", e);
            }
          }}
        />
      )}
    </div>
  );
}
