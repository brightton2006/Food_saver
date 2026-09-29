import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.jsx";
import GoogleMap from "../../components/GoogleMap.jsx";

export default function DonationPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [description, setDescription] = useState("Fresh unsold food donated to local NGO network before closing.");
  const [address, setAddress] = useState("Rajagopalapuram, Kovilpatti");
  const [deadlineMinutes, setDeadlineMinutes] = useState("120");
  const [donations, setDonations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const merchantCoords = { lat: 9.1724, lng: 77.8694 };

  useEffect(() => {
    loadNearbyDonations();
  }, []);

  async function loadNearbyDonations() {
    try {
      const res = await api.getNearbyDonations(merchantCoords.lat, merchantCoords.lng, 10.0);
      if (res.donations) {
        setDonations(res.donations);
      }
    } catch (err) {}
  }

  async function handleCreateDonation(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const res = await api.createDonation({
        merchantUserId: session?.user?.userId || session?.userId || session?.merchantId || "merchant",
        hotelId: session?.hotelId || session?.user?.hotelId || "hotel",
        itemName,
        quantity: Number(quantity) || 5,
        description,
        address,
        latitude: merchantCoords.lat,
        longitude: merchantCoords.lng,
        pickupDeadlineMinutes: Number(deadlineMinutes) || 120,
      });

      if (res.success) {
        setMessage(`🎉 Unsold food donation created! Notified ${res.notifiedNgosCount} nearby NGOs within 5 km.`);
        setItemName("");
        loadNearbyDonations();
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setSubmitting(false);
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
                Zero Waste Food Rescue
              </span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                5 km NGO Network
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-100">Donate Unsold Surplus Food</h1>
            <p className="text-sm text-slate-400">
              Directly dispatch unsold meals approaching closing time to verified local NGOs within 5 km.
            </p>
          </div>

          <button
            onClick={() => navigate("/merchant")}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl border border-slate-700 transition-all"
          >
            Back to Merchant Dashboard
          </button>
        </div>

        {/* Creation Form & Active Donations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Donation Form */}
          <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
              <span>🍱</span> Create Donation Request
            </h2>

            {message && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                {message}
              </div>
            )}

            <form onSubmit={handleCreateDonation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Food Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 10x Veg Meals / Fresh Bread Loaves"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Quantity (Meals/Items)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Pickup Deadline (Minutes)</label>
                  <input
                    type="number"
                    required
                    min="15"
                    value={deadlineMinutes}
                    onChange={(e) => setDeadlineMinutes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Pickup Address</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description & Notes</label>
                <textarea
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-extrabold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-xs active:scale-95"
              >
                {submitting ? "Creating Donation..." : "🚀 Publish Food Donation (Notify 5 km NGOs)"}
              </button>
            </form>
          </div>

          {/* Active Donations List */}
          <div className="md:col-span-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Active Unsold Food Donations ({donations.length})
            </h2>

            {donations.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
                <span className="text-3xl block mb-2">🤝</span>
                <p className="text-xs">No active donation requests created yet.</p>
              </div>
            ) : (
              donations.map((d) => (
                <div
                  key={d.donationId}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-100 text-sm">{d.itemName}</h3>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                      {d.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{d.description}</p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <span>📦 {d.quantity} meals</span>
                    <span>📍 {d.distanceKm || 0.5} km radius</span>
                    <span>🕒 Deadline: {new Date(d.pickupDeadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
