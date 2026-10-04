import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket.js";
import { api } from "../lib/api.js";
import { useCountdown } from "../lib/useCountdown.js";
import { getFoodFallbackImage } from "../lib/foodImageService.js";
import PaymentModal from "./PaymentModal.jsx";
import { addMyClaim } from "../lib/myClaims.js";
import { useSession } from "../lib/session.jsx";
import { getCurrentLocation } from "../services/locationService.js";
import {
  Moon,
  Clock,
  MapPin,
  Flame,
  Percent,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  AlertTriangle,
  ShoppingBag,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react";

// Live Countdown timer component for collection deadline
function CollectionCountdownBadge({ deadline, isClosed }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const msLeft = Math.max(0, new Date(deadline).getTime() - now);
  const totalSeconds = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (isClosed || msLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
        <Clock className="w-3.5 h-3.5 text-rose-400" />
        <span>Deadline Expired</span>
      </span>
    );
  }

  const isUrgent = totalSeconds < 1800; // less than 30 mins
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-extrabold shadow-sm ${
        isUrgent
          ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse"
          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
      }`}
    >
      <Clock className="w-3.5 h-3.5" />
      <span>
        {hours > 0 ? `${hours}h ` : ""}
        {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s left
      </span>
    </span>
  );
}

export default function NightSaleSection({
  searchQuery = "",
  city = "Kovilpatti",
  userLat = null,
  userLng = null,
  onOpenAuth = null,
}) {
  const navigate = useNavigate();
  const { session } = useSession();

  // Active Category Tab
  const [activeTab, setActiveTab] = useState("availableTonight");
  // Radius Filter (1km, 2km, 5km, 10km)
  const [selectedRadius, setSelectedRadius] = useState(2.0);
  // Data state
  const [nightData, setNightData] = useState({
    availableTonight: [],
    closingSoon: [],
    nearbyNightDeals: [],
    bigDiscountsTonight: [],
    almostSoldOut: [],
    ngoFoodRescue: [],
  });
  const [loading, setLoading] = useState(true);
  const [claimingItem, setClaimingItem] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const effectiveLat = userLat || 9.1724;
  const effectiveLng = userLng || 77.8694;

  const loadNightSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getNightSales({
        lat: effectiveLat,
        lng: effectiveLng,
        radius: selectedRadius,
        searchQuery,
        city,
      });
      if (res && res.categories) {
        setNightData(res.categories);
      }
    } catch (err) {
      console.warn("Failed to load night sales:", err.message);
    } finally {
      setLoading(false);
    }
  }, [effectiveLat, effectiveLng, selectedRadius, searchQuery, city]);

  useEffect(() => {
    loadNightSales();
  }, [loadNightSales]);

  // Real-time socket updates for night offers
  useEffect(() => {
    const handleUpdate = () => {
      loadNightSales();
    };

    const handleNightAlert = (data) => {
      setToastMsg(`🌙 New Night Flash Sale: ${data?.listing?.itemName || "Fresh surplus food"}!`);
      setTimeout(() => setToastMsg(""), 4000);
      loadNightSales();
    };

    socket.on("night_sale:created", handleNightAlert);
    socket.on("night_sale:alert", handleNightAlert);
    socket.on("listing:created", handleUpdate);
    socket.on("listing:updated", handleUpdate);
    socket.on("claim:created", handleUpdate);

    return () => {
      socket.off("night_sale:created", handleNightAlert);
      socket.off("night_sale:alert", handleNightAlert);
      socket.off("listing:created", handleUpdate);
      socket.off("listing:updated", handleUpdate);
      socket.off("claim:created", handleUpdate);
    };
  }, [loadNightSales]);

  const categoryTabs = [
    {
      id: "availableTonight",
      label: "Available Tonight",
      icon: Moon,
      count: nightData.availableTonight?.length || 0,
      description: "Confirmed surplus food available for pickup & delivery tonight",
    },
    {
      id: "closingSoon",
      label: "Closing Soon",
      icon: Clock,
      count: nightData.closingSoon?.length || 0,
      description: "Offers approaching their collection deadline (< 60 mins)",
    },
    {
      id: "nearbyNightDeals",
      label: "Nearby Night Deals",
      icon: MapPin,
      count: nightData.nearbyNightDeals?.length || 0,
      description: `Active surplus deals within ${selectedRadius} km of your location`,
    },
    {
      id: "bigDiscountsTonight",
      label: "Big Discounts Tonight",
      icon: Percent,
      count: nightData.bigDiscountsTonight?.length || 0,
      description: "Highest savings on freshly cooked meals and bakery items",
    },
    {
      id: "almostSoldOut",
      label: "Almost Sold Out",
      icon: Flame,
      count: nightData.almostSoldOut?.length || 0,
      description: "Final surplus bundles remaining (3 or fewer items left)",
    },
    {
      id: "ngoFoodRescue",
      label: "Food Rescue for NGOs",
      icon: HeartHandshake,
      count: nightData.ngoFoodRescue?.length || 0,
      description: "Safe surplus food offered by hotels for approved NGO food banks",
    },
  ];

  const currentItems = useMemo(() => {
    return nightData[activeTab] || [];
  }, [nightData, activeTab]);

  const activeTabMeta = categoryTabs.find((t) => t.id === activeTab) || categoryTabs[0];

  return (
    <section
      className="night-sale-section my-7 relative overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(145deg, #091312 0%, #11221f 50%, #0d1a18 100%)",
        border: "1.5px solid rgba(105, 199, 168, 0.35)",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        padding: "24px 20px",
      }}
    >
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(105, 199, 168, 0.18) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Header Banner */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-[#69C7A8] border border-[#69C7A8]/40 shadow-sm uppercase tracking-wider">
              <Moon className="w-3.5 h-3.5 fill-[#69C7A8]" />
              Tonight's Food Deals
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" />
              6:00 PM – 11:00 PM Flash Sale
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>🌙 Night-Time Surplus Food Flash Sales</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Genuine unsold food from top approved hotels in {city}, discounted before closing. Safe, delicious, and helping stop food waste.
          </p>
        </div>

        {/* Proximity Radius Selector & Refresh */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="flex items-center bg-black/40 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-slate-200">
            <MapPin className="w-3.5 h-3.5 text-[#69C7A8] mr-1.5" />
            <span className="mr-1 text-slate-400">Radius:</span>
            <select
              value={selectedRadius}
              onChange={(e) => setSelectedRadius(Number(e.target.value))}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value={1.0} className="bg-slate-900 text-white">1 km</option>
              <option value={2.0} className="bg-slate-900 text-white">2 km (Default)</option>
              <option value={5.0} className="bg-slate-900 text-white">5 km</option>
              <option value={10.0} className="bg-slate-900 text-white">10 km</option>
              <option value={25.0} className="bg-slate-900 text-white">25 km (Whole City)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadNightSales}
            title="Refresh Night Deals"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#69C7A8]" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Category Pills Row (Requirement B: 6 Categories) */}
      <div className="relative z-10 flex gap-2.5 overflow-x-auto py-4 scrollbar-none border-b border-white/10">
        {categoryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-extrabold text-xs whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-[#69C7A8] to-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 scale-[1.02]"
                  : "bg-black/40 hover:bg-black/60 text-slate-300 border border-white/10 hover:border-white/20"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-[#69C7A8]"}`} />
              <span>{tab.label}</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-black ${
                  isActive ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-slate-300"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category Description Banner */}
      <div className="relative z-10 py-2.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#69C7A8]" />
          <span>{activeTabMeta.description}</span>
        </div>
        <span className="font-extrabold text-slate-300">{currentItems.length} offer{currentItems.length === 1 ? "" : "s"}</span>
      </div>

      {/* Food Cards Grid */}
      <div className="relative z-10 mt-3">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-72 rounded-2xl bg-white/5 animate-pulse border border-white/10"
              />
            ))}
          </div>
        ) : currentItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {currentItems.map((item) => {
              const isDonationItem = item.isDonation;
              const originalPrice = Number(item.originalPrice || item.price || 0);
              const discountPrice = Number(item.discountPrice || 0);
              const savingsPct = item.discountPercentage || (originalPrice > 0 ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100) : 50);
              const qtyLeft = item.quantityAvailable ?? item.quantity ?? 1;
              const isLowStock = qtyLeft > 0 && qtyLeft <= 3;
              const collectionDeadline = item.collectionDeadline || item.expiresAt || item.pickupDeadline;
              const isClosed = item.status === "soldout" || (item.minutesRemaining !== undefined && item.minutesRemaining <= 0);

              return (
                <div
                  key={item.id || item.donationId}
                  className="group relative flex flex-col rounded-2xl overflow-hidden bg-slate-900/80 border border-white/10 hover:border-[#69C7A8]/50 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-teal-900/20"
                >
                  {/* Media Section */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-950">
                    <img
                      src={item.imageUrl || getFoodFallbackImage(item.itemName, item.category)}
                      alt={item.itemName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = getFoodFallbackImage(item.itemName, item.category);
                      }}
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-black uppercase bg-emerald-500 text-slate-950 shadow">
                        {item.isVeg !== false ? "🟢 Veg" : "🔴 Non-Veg"}
                      </span>
                      {isDonationItem ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-black bg-purple-500 text-white shadow flex items-center gap-1">
                          <HeartHandshake className="w-3 h-3" /> NGO Food Rescue
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-black bg-amber-500 text-slate-950 shadow flex items-center gap-1">
                          <Moon className="w-3 h-3 fill-slate-950" /> Night Flash Deal
                        </span>
                      )}
                    </div>

                    {/* Top Right: Countdown Deadline Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <CollectionCountdownBadge deadline={collectionDeadline} isClosed={isClosed} />
                    </div>

                    {/* Bottom Left: Discount Badge */}
                    {!isDonationItem && savingsPct > 0 && (
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-500 text-white shadow-md flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {savingsPct}% OFF
                        </span>
                      </div>
                    )}

                    {/* Bottom Right: Low Stock Alert */}
                    {isLowStock && (
                      <div className="absolute bottom-2.5 right-2.5">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-500 text-slate-950 shadow-md flex items-center gap-1 animate-bounce">
                          <Flame className="w-3 h-3 fill-slate-950" />
                          Only {qtyLeft} left!
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-white text-base leading-snug line-clamp-1">
                        {item.itemName}
                      </h3>
                      {item.rating && (
                        <span className="text-xs font-extrabold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
                          ★ {Number(item.rating).toFixed(1)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      By <strong className="text-slate-200">{item.merchantName || item.hotelName}</strong> • {item.category || "Meals"}
                    </p>

                    {/* Location & Distance */}
                    <div className="flex items-center justify-between text-xs text-slate-300 mt-2.5 pt-2.5 border-t border-white/5">
                      <span className="flex items-center gap-1 text-slate-400 line-clamp-1">
                        <MapPin className="w-3 h-3 text-[#69C7A8] shrink-0" />
                        <span>{item.address || city}</span>
                      </span>
                      {item.distanceFormatted && (
                        <span className="text-[#69C7A8] font-black shrink-0 ml-1">
                          {item.distanceFormatted}
                        </span>
                      )}
                    </div>

                    {/* Food Safety & Storage info */}
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {item.safeStorageInfo || "Safe, temperature-controlled counter"}
                      </span>
                    </div>

                    {/* Price and Order Action */}
                    <div className="mt-auto pt-3.5 flex items-center justify-between gap-2">
                      <div>
                        {isDonationItem ? (
                          <div>
                            <span className="text-xs text-purple-400 font-extrabold">Free NGO Donation</span>
                            <div className="text-[11px] text-slate-400">{qtyLeft} servings ready</div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-emerald-400">
                                ₹{discountPrice}
                              </span>
                              {originalPrice > discountPrice && (
                                <span className="text-xs text-slate-400 line-through">
                                  ₹{originalPrice}
                                </span>
                              )}
                            </div>
                            <span className="text-[10.5px] text-slate-400">
                              Pickup by {item.pickupWindowEnd || "closing"}
                            </span>
                          </div>
                        )}
                      </div>

                      {isDonationItem ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!session) {
                              onOpenAuth ? onOpenAuth("login") : navigate("/login");
                              return;
                            }
                            navigate("/ngo/donations");
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          Claim for NGO →
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isClosed}
                          onClick={() => {
                            if (isClosed) return;
                            if (!session) {
                              onOpenAuth ? onOpenAuth("login") : navigate("/login");
                              return;
                            }
                            setClaimingItem(item);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                            isClosed
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                              : "bg-gradient-to-r from-[#69C7A8] to-teal-500 text-slate-950 shadow-md hover:brightness-110 active:scale-95"
                          }`}
                        >
                          {isClosed ? "Unavailable" : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5" />
                              Order Now
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State (Requirement B: "No surplus food available nearby right now. Check again later." Never fake deals!) */
          <div
            className="text-center py-12 px-6 rounded-2xl border border-white/10"
            style={{ background: "rgba(10, 20, 18, 0.6)" }}
          >
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
              🌙
            </div>
            <h4 className="text-lg font-black text-white mb-1.5">
              No surplus food available nearby right now. Check again later.
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
              Hotels post their evening flash sales as they prepare for closing between 6:00 PM and 11:00 PM. Expand your search radius or explore partner restaurants below.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedRadius(25.0)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-white/10 text-white hover:bg-white/20 border border-white/15 transition-all"
              >
                Search Entire City (25 km)
              </button>
              <button
                type="button"
                onClick={() => navigate("/customer/nearby-food")}
                className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#69C7A8] to-teal-500 text-slate-950 shadow transition-all"
              >
                Open Live Food Map →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-[#69C7A8] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <Moon className="w-4 h-4 text-[#69C7A8]" />
          <span className="text-xs font-extrabold">{toastMsg}</span>
        </div>
      )}

      {/* Claim & Payment Modal */}
      {claimingItem && (
        <PaymentModal
          open={!!claimingItem}
          listing={claimingItem}
          onClose={() => setClaimingItem(null)}
          onComplete={async (listingObj, quantity, order) => {
            try {
              const custId = session?.userId || session?.id || session?.username || session?.email || "guest";
              const res = await api.claimListing(listingObj.id, {
                customerId: custId,
                customerName: session?.name || session?.fullName || "Resident Customer",
                customerUsername: session?.username || "resident_customer",
                quantity,
              });
              if (res && res.claim) {
                addMyClaim(res.claim, custId);
                loadNightSales();
                return res;
              }
            } catch (e) {
              console.error("Night deal claim failed:", e);
              throw e;
            }
          }}
        />
      )}
    </section>
  );
}
