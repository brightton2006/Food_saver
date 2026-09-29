import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.jsx";
import GoogleMap from "../../components/GoogleMap.jsx";

export default function NgoDonations() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState("");
  const ngoCoords = { lat: 9.1730, lng: 77.8680 };

  useEffect(() => {
    loadDonations();
  }, []);

  async function loadDonations() {
    setLoading(true);
    try {
      const res = await api.getNearbyDonations(ngoCoords.lat, ngoCoords.lng, 5.0);
      if (res.donations) {
        setDonations(res.donations);
      }
    } catch (err) {
      console.error("Error loading NGO donations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptDonation(donationId) {
    setClaiming(true);
    setMessage("");

    try {
      const ngoUserId = session?.user?.userId || "usr_ngo_1";
      const res = await api.claimDonation(donationId, ngoUserId);

      if (res.success) {
        setMessage("🎉 Donation accepted successfully! Pickup route navigation active.");
        loadDonations();
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 pb-20">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                NGO Zero-Waste Rescue Portal
              </span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                5 km Radius Active
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-100">Unsold Food Donations Available</h1>
            <p className="text-sm text-slate-400">
              Claim and rescue surplus food packages donated by local restaurants within 5 km of your food bank.
            </p>
          </div>

          <button
            onClick={loadDonations}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl border border-slate-700 transition-all flex items-center gap-2"
          >
            <span>🔄</span> Refresh Donations
          </button>
        </div>

        {message && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center">
            {message}
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left: Available Donations List */}
          <div className="md:col-span-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Available Donations ({donations.length})
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div key={n} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-slate-800 rounded w-2/3" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : donations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                <span className="text-4xl block mb-2">🏢</span>
                <p className="text-xs">No active food donations available within 5 km right now.</p>
              </div>
            ) : (
              donations.map((d) => (
                <div
                  key={d.donationId}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 shadow-xl transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-100 text-base">{d.itemName}</h3>
                      <p className="text-xs text-slate-400 font-semibold">{d.merchantName} • {d.address}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
                      📍 {d.distanceKm || 0.8} km away
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{d.description}</p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <span>📦 Quantity: {d.quantity} meals</span>
                    <span>🕒 Deadline: {new Date(d.pickupDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {d.status === "DONATION_CREATED" || d.status === "NGO_NOTIFIED" ? (
                      <button
                        onClick={() => handleAcceptDonation(d.donationId)}
                        disabled={claiming}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        {claiming ? "Claiming..." : "✓ Accept Food Donation"}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full py-3 bg-slate-800 text-emerald-400 font-bold text-xs rounded-2xl border border-slate-700"
                      >
                        ✓ Donation Claimed ({d.status})
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: NGO Radar Map */}
          <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3 sticky top-24">
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>🗺️</span> 5 km NGO Rescue Radar
              </span>
              <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                NGO Mode Active
              </span>
            </div>

            <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-800">
              <GoogleMap
                center={ngoCoords}
                zoom={13}
                radiusKm={5.0}
                markers={donations.map((d) => ({
                  id: d.donationId,
                  title: d.itemName,
                  lat: d.lat,
                  lng: d.lng,
                  type: "food",
                }))}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
