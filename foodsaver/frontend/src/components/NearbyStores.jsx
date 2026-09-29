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

  const filtered = merchants.filter((m) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      m.businessName?.toLowerCase().includes(q) ||
      m.hotelName?.toLowerCase().includes(q) ||
      m.address?.toLowerCase().includes(q) ||
      m.cuisine?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search nearby restaurants & bakeries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full py-2.5 pl-10 pr-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
        />
        <span className="absolute left-3.5 top-3 text-slate-400 text-sm">🔍</span>
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-3.5 top-2.5 text-slate-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stores List */}
      {loading ? (
        <div className="flex flex-col gap-3 py-6 items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Scanning nearby FoodSaver merchants...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
          <span className="text-3xl mb-2 block">🏪</span>
          <h4 className="text-sm font-bold text-slate-200 mb-1">No FoodSaver stores found nearby</h4>
          <p className="text-xs text-slate-400">
            {searchTerm ? "No stores matched your search query." : "Try expanding your search radius to 5 km or 10 km."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[560px] overflow-y-auto pr-1">
          {filtered.map((m) => (
            <StoreCard
              key={m.id || m.hotelId || m.merchantId}
              merchant={m}
              isSelected={selectedMerchantId && String(selectedMerchantId) === String(m.id || m.hotelId || m.merchantId)}
              onSelect={onSelectMerchant}
              onViewFood={onViewFood}
            />
          ))}
        </div>
      )}
    </div>
  );
}
