import React from "react";

export default function StoreCard({
  merchant,
  isSelected = false,
  onSelect = () => {},
  onViewFood = () => {},
}) {
  if (!merchant) return null;

  const lat = merchant.latitude || merchant.lat;
  const lng = merchant.longitude || merchant.lng;
  const dealsCount = merchant.availableFoodCount || 0;

  return (
    <div
      onClick={() => onSelect(merchant)}
      className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer border ${
        isSelected
          ? "bg-[#DDF4EE]/40 border-[#176B5B] shadow-md scale-[1.01]"
          : "bg-white hover:bg-[#F7FAF9] border-[#D8E5E2] hover:border-[#176B5B] shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏪</span>
            <h4 className="font-bold text-[#172321] text-base leading-tight">
              {merchant.businessName || merchant.hotelName}
            </h4>
          </div>
          <p className="text-xs text-[#65736F] line-clamp-1">
            {merchant.address || "Local FoodSaver Partner Store"}
          </p>
        </div>

        {/* Distance Badge */}
        <span className="text-xs font-bold bg-[#DDF4EE] text-[#176B5B] border border-[#BDE8DE] px-2.5 py-1 rounded-full whitespace-nowrap shadow-xs">
          📍 {merchant.distanceText || `${merchant.distanceKm} km away`}
        </span>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between py-2 border-t border-b border-[#E8F0EE] my-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-[#B45309] font-bold">
          <span>🔥</span>
          <span>{dealsCount > 0 ? `${dealsCount} Deals Available` : "No Active Deals"}</span>
        </div>

        <div className="text-[#65736F]">
          <span>⏰ {merchant.openingHours || "10:00 AM – 10:30 PM"}</span>
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewFood(merchant);
          }}
          className="flex-1 py-2 px-3 bg-[#176B5B] hover:bg-[#0D4037] text-white font-bold rounded-xl text-xs shadow-xs transition-all text-center"
        >
          View Food Deals ({dealsCount})
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (lat && lng) {
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
            }
          }}
          className="py-2 px-3 bg-[#F7FAF9] hover:bg-[#EDF3F1] text-[#172321] font-semibold rounded-xl text-xs border border-[#D8E5E2] transition-all flex items-center gap-1"
        >
          <span>🧭</span> Directions
        </button>
      </div>
    </div>
  );
}
