import React, { useState } from "react";
import StoreCard from "./StoreCard.jsx";

export default function NearbyStores({
  merchants = [],
  loading = false,
  selectedMerchantId = null,
  onSelectMerchant = () => {},
  onViewFood = () => {},
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // "all" | "partners" | "surplus"

  const partnersCount = merchants.filter((m) => m.isFoodSaverPartner !== false).length;
  const surplusCount = merchants.filter((m) => (m.availableFoodCount || 0) > 0).length;

  const filtered = merchants.filter((m) => {
    // 1. Text filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        m.businessName?.toLowerCase().includes(q) ||
        m.hotelName?.toLowerCase().includes(q) ||
        m.name?.toLowerCase().includes(q) ||
        m.address?.toLowerCase().includes(q) ||
        m.cuisine?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q);
      if (!match) return false;
    }

    // 2. Mode filter
    if (filterMode === "partners") {
      return m.isFoodSaverPartner !== false;
    }
    if (filterMode === "surplus") {
      return (m.availableFoodCount || 0) > 0;
    }

    return true;
  });

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Search Input & Quick Filter Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search nearby restaurants, cafes, bakeries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2.5 pl-10 pr-9 bg-white border border-[#D8E5E2] rounded-xl text-xs sm:text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition-all shadow-xs"
          />
          <span className="absolute left-3.5 top-3 text-[#8A9490] text-sm">🔍</span>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3.5 top-2.5 text-[#8A9490] hover:text-[#172321] text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filterMode === "all"
                ? "bg-[#176B5B] text-white shadow-xs"
                : "bg-white text-[#65736F] border border-[#D8E5E2] hover:text-[#172321]"
            }`}
          >
            All ({merchants.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("partners")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filterMode === "partners"
                ? "bg-[#176B5B] text-white shadow-xs"
                : "bg-white text-[#65736F] border border-[#D8E5E2] hover:text-[#172321]"
            }`}
          >
            🍱 Partners ({partnersCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("surplus")}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              filterMode === "surplus"
                ? "bg-[#FF9F43] text-white shadow-xs"
                : "bg-white text-[#65736F] border border-[#D8E5E2] hover:text-[#172321]"
            }`}
          >
            🔥 Surplus Deals ({surplusCount})
          </button>
        </div>
      </div>

      {/* Stores List Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-white border border-[#D8E5E2] rounded-2xl h-44 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-2xl bg-white border border-[#D8E5E2] shadow-xs">
          <span className="text-4xl mb-3 block">🍽️</span>
          <h4 className="text-base font-bold text-[#172321] mb-1">
            No businesses found
          </h4>
          <p className="text-xs text-[#65736F] max-w-sm mx-auto">
            {searchTerm
              ? `No restaurants matched "${searchTerm}". Try a different keyword or expand the radius.`
              : "No restaurants or FoodSaver partners found in this radius. Try selecting 5 km, 10 km, or 25 km."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <StoreCard
              key={m.id || m.hotelId || m.merchantId}
              merchant={m}
              isSelected={
                selectedMerchantId &&
                String(selectedMerchantId) ===
                  String(m.id || m.hotelId || m.merchantId)
              }
              onSelect={onSelectMerchant}
              onViewFood={onViewFood}
            />
          ))}
        </div>
      )}
    </div>
  );
}
