import React, { useState } from "react";

export default function LocationPermissionModal({ isOpen, onClose, onLocationGranted, onManualSelect }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  function handleAllowLocation() {
    setLoading(true);
    setErrorMsg("");

    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser. Please select location manually.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        const { latitude, longitude } = pos.coords;
        onLocationGranted({ latitude, longitude });
        onClose();
      },
      (err) => {
        setLoading(false);
        setErrorMsg("Location access denied or unavailable. Please choose location manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white relative">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-500/30">
          📍
        </div>

        <h3 className="text-xl font-bold text-center text-slate-100 mb-2">
          Discover Food Near You
        </h3>

        <p className="text-sm text-slate-300 text-center mb-6 leading-relaxed">
          Allow location access to find discounted surplus meals, bakery items, and closing deals within <strong className="text-emerald-400">2 km</strong> of your current location.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAllowLocation}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Obtaining Location...
              </span>
            ) : (
              <>
                <span>📍</span> Allow Location Access
              </>
            )}
          </button>

          <button
            onClick={() => {
              onManualSelect();
              onClose();
            }}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-2xl border border-slate-700 transition-all text-sm"
          >
            Choose Location Manually
          </button>
        </div>
      </div>
    </div>
  );
}
