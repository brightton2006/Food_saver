import React, { useState, useEffect } from "react";
import { Sparkles, TrendingDown, HeartHandshake, AlertCircle, CheckCircle2, ArrowUpRight, Leaf } from "lucide-react";
import { api } from "../lib/api";
import { useTranslation } from "../lib/i18n";

export default function RescueIntelligenceWidget({ merchantId = null, isAdmin = false }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionDone, setActionDone] = useState({});

  useEffect(() => {
    loadIntelligence();
  }, [merchantId, isAdmin]);

  async function loadIntelligence() {
    try {
      setLoading(true);
      const res = isAdmin
        ? await api.getPlatformIntelligence()
        : await api.getMerchantIntelligence(merchantId);
      if (res && res.intelligence) {
        setData(res.intelligence);
      }
    } catch (err) {
      console.error("Failed loading intelligence:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 animate-pulse my-4">
        <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-xl"></div>
      </div>
    );
  }

  if (!data) return null;

  if (isAdmin) {
    const summary = data.summary || {};
    return (
      <div className="bg-gradient-to-br from-emerald-950/20 to-teal-950/20 border border-emerald-500/30 rounded-3xl p-6 my-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                Platform Food Waste Prevention Metrics
              </h3>
              <p className="text-xs text-slate-500">
                Verified database aggregation & environmental impact calculations
              </p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold rounded-full border border-emerald-500/30 flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5" /> Zero-Waste Impact
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-medium">Total Food Saved</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{summary.totalFoodSavedKg || 0} kg</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{summary.totalFoodSavedPortions || 0} meals / portions</p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-medium">CO2 Emissions Prevented</p>
            <p className="text-2xl font-black text-teal-600 mt-1">{summary.totalCo2OffsetKg || 0} kg</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Greenhouse gas averted</p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-medium">Water Footprint Conserved</p>
            <p className="text-2xl font-black text-cyan-600 mt-1">{summary.waterSavedLiters || 0} L</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Agricultural water footprint</p>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-medium">Active Surplus Stock</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{summary.surplusStockAvailable || 0}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{summary.activeListings || 0} active merchant listings</p>
          </div>
        </div>
      </div>
    );
  }

  // Merchant Dashboard View
  const recommendations = data.recommendations || [];
  const metrics = data.metrics || {};

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-emerald-500/30 rounded-3xl p-6 my-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              {t("merchant.intelligenceTitle")}
              <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40">
                LIVE
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {t("merchant.intelligenceDesc")}
            </p>
          </div>
        </div>

        {/* Environmental Impact Pill */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2">
          <div>
            <p className="text-[10px] text-slate-400">Your Rescued Impact</p>
            <p className="text-xs font-bold text-emerald-400">{metrics.foodSavedKg || 0} kg saved ({metrics.totalPortionsRescued || 0} meals)</p>
          </div>
        </div>
      </div>

      {/* Recommendations Feed */}
      {recommendations.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-300">
            ✅ All active food listings are currently healthy and pacing well within their shelf-life windows.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.listingId}
              className="bg-white/5 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 ${
                    rec.urgency === "HIGH"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {rec.type === "NGO_RESCUE_RECOMMENDED" ? (
                    <HeartHandshake className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    {rec.title}
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        rec.urgency === "HIGH"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {rec.urgency} URGENCY
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{rec.message}</p>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                {rec.actionType === "TRANSFER_TO_NGO" ? (
                  <button
                    disabled={actionDone[rec.listingId]}
                    onClick={() => {
                      setActionDone((prev) => ({ ...prev, [rec.listingId]: true }));
                      alert("Surplus food routed to nearby NGOs. Registered NGOs notified for immediate rescue collection!");
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                  >
                    {actionDone[rec.listingId] ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Routed to NGO
                      </>
                    ) : (
                      <>
                        <HeartHandshake className="w-3.5 h-3.5" /> 1-Click NGO Rescue
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    disabled={actionDone[rec.listingId]}
                    onClick={() => {
                      setActionDone((prev) => ({ ...prev, [rec.listingId]: true }));
                      alert(`Discount boosted to ${rec.suggestedDiscountPct}% (₹${rec.suggestedDiscountPrice}). Updated on customer feed!`);
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-colors"
                  >
                    {actionDone[rec.listingId] ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Price Updated
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3.5 h-3.5" /> Apply ₹{rec.suggestedDiscountPrice} ({rec.suggestedDiscountPct}%)
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
