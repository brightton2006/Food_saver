import React from "react";
import { openDirections } from "../services/locationService.js";

export default function StoreCard({
  merchant,
  isSelected = false,
  onSelect = () => {},
  onViewFood = () => {},
}) {
  if (!merchant) return null;

  const isPartner = merchant.isFoodSaverPartner !== false;
  const lat = Number(merchant.latitude || merchant.lat);
  const lng = Number(merchant.longitude || merchant.lng);
  const dealsCount = Number(merchant.availableFoodCount || 0);
  const name = merchant.businessName || merchant.hotelName || merchant.name || (isPartner ? "FoodSaver Partner" : "Discovered Restaurant");

  return (
    <div
      onClick={() => onSelect(merchant)}
      className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
        isSelected
          ? "bg-[#DDF4EE]/50 border-[#176B5B] shadow-md ring-2 ring-[#176B5B]/20 scale-[1.01]"
          : "bg-white hover:bg-[#F7FAF9] border-[#D8E5E2] hover:border-[#176B5B] shadow-xs"
      }`}
    >
      <div>
        {/* Top Header: Icon + Name + Distance */}
        <div className="flex items-start justify-between gap-2.5 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-base">{isPartner ? "🍱" : "🍽️"}</span>
              <h4 className="font-bold text-[#172321] text-sm leading-snug truncate">
                {name}
              </h4>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {isPartner ? (
                <span className="text-[10px] font-extrabold bg-[#DDF4EE] text-[#176B5B] border border-[#BDE8DE] px-2 py-0.5 rounded-md">
                  ✓ Approved Partner
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] px-2 py-0.5 rounded-md">
                  🌐 Discovered Place
                </span>
              )}
              <span className="text-[11px] text-[#65736F] truncate">
                {merchant.cuisine || merchant.category || "Restaurant"}
              </span>
            </div>
          </div>

          {/* Distance Badge */}
          <span className="text-[11px] font-bold bg-[#DDF4EE] text-[#176B5B] border border-[#BDE8DE] px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs">
            📍 {merchant.distanceText || (merchant.distance ? `${merchant.distance} km` : "Nearby")}
          </span>
        </div>

        {/* Address */}
        <p className="text-xs text-[#65736F] line-clamp-1 mb-3">
          {merchant.address || "Verified Location"}
        </p>

        {/* Surplus Deals Info or External Status */}
        {isPartner ? (
          <div className="flex items-center justify-between py-2 border-t border-b border-[#E8F0EE] mb-3 text-xs">
            <div className="flex items-center gap-1.5 text-[#B45309] font-bold">
              <span>🔥</span>
              <span>{dealsCount > 0 ? `${dealsCount} Surplus Deals Available` : "No Deals Currently"}</span>
            </div>
            {merchant.rating && (
              <span className="text-xs font-bold text-[#172321] flex items-center gap-0.5">
                <span className="text-amber-500">⭐</span> {merchant.rating}
              </span>
            )}
          </div>
        ) : (
          <div className="py-2 border-t border-b border-[#E8F0EE] mb-3 text-[11px] text-[#65736F] flex items-center justify-between">
            <span>External Restaurant Directory</span>
            <span>⏱️ ~{merchant.estimatedMinutes || 5} min</span>
          </div>
        )}
      </div>

      {/* Card Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {isPartner && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewFood(merchant);
            }}
            className="flex-1 py-2 px-3 bg-[#176B5B] hover:bg-[#0D4037] text-white font-bold rounded-xl text-xs shadow-xs transition-all text-center"
          >
            View Food ({dealsCount})
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (lat && lng) {
              openDirections(lat, lng);
            }
          }}
          className={`${
            isPartner ? "flex-1" : "flex-1"
          } py-2 px-3 bg-[#F7FAF9] hover:bg-[#EDF3F1] text-[#172321] font-semibold rounded-xl text-xs border border-[#D8E5E2] transition-all flex items-center justify-center gap-1`}
        >
          <span>🧭</span> Get Directions
        </button>

        {merchant.googleMapsUrl && (
          <a
            href={merchant.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="py-2 px-2.5 bg-white hover:bg-[#F7FAF9] text-[#176B5B] border border-[#D8E5E2] rounded-xl text-xs flex items-center justify-center transition-all"
            title="Open in Google Maps"
          >
            🗺️
          </a>
        )}
      </div>
    </div>
  );
}
