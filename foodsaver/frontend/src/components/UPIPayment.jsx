import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";

const POPULAR_UPI_APPS = [
  { id: "gpay", name: "Google Pay", icon: "🟢" },
  { id: "phonepe", name: "PhonePe", icon: "🟣" },
  { id: "paytm", name: "Paytm", icon: "🔵" },
  { id: "bhim", name: "BHIM UPI", icon: "🟠" },
];

export default function UPIPayment({ amount, onConfirm, disabled = false }) {
  const [upiId, setUpiId] = useState("foodsaver@icici");
  const [selectedApp, setSelectedApp] = useState("gpay");
  const [qr, setQr] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const targetUpi = upiId || "foodsaver@icici";
    const payload = `upi://pay?pa=${encodeURIComponent(
      targetUpi
    )}&pn=FoodSaver+Marketplace&am=${amount}&tn=Surplus+Food+Order`;

    QRCode.toDataURL(payload)
      .then((url) => active && setQr(url))
      .catch(() => active && setQr(null));

    return () => {
      active = false;
    };
  }, [upiId, amount]);

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiId || "foodsaver@icici");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handlePayClick() {
    if (processing || disabled) return;
    setProcessing(true);
    try {
      if (onConfirm) {
        await onConfirm({
          method: "upi",
          upiId: upiId || "foodsaver@icici",
          upiApp: selectedApp,
        });
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="payment-panel upi-panel space-y-4"
    >
      <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Instant UPI Verification Active</span>
        </div>
        <span className="text-[11px] font-extrabold text-slate-300 bg-slate-900 px-2 py-0.5 rounded-full">
          ₹0 Gateway Fee
        </span>
      </div>

      {/* QUICK UPI APP SELECTOR CHIPS */}
      <div>
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Select UPI App / Method
        </label>
        <div className="grid grid-cols-2 gap-2">
          {POPULAR_UPI_APPS.map((app) => {
            const isSelected = selectedApp === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedApp(app.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                  isSelected
                    ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-md"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span className="text-base">{app.icon}</span>
                <span>{app.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VPA / UPI ID INPUT */}
      <div className="field">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
          UPI VPA / Virtual ID
        </label>
        <div className="relative">
          <input
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white font-mono text-xs focus:outline-none focus:border-amber-500 transition-all"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="mobile/name@upi"
            inputMode="text"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition-all"
          >
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
        </div>
      </div>

      {/* QR CODE CONTAINER */}
      <div className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-2xl my-2">
        {qr ? (
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 bg-white rounded-2xl shadow-xl">
              <img src={qr} alt="UPI QR code" className="w-36 h-36" />
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">
              Scan with GPay, PhonePe, Paytm, or BHIM
            </span>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-6">Generating instant QR code...</div>
        )}
      </div>

      {/* SUBMIT BUTTON WITH PROCESSING SPINNER */}
      <motion.button
        type="button"
        whileHover={{ scale: processing ? 1 : 1.01 }}
        whileTap={{ scale: processing ? 1 : 0.98 }}
        onClick={handlePayClick}
        disabled={processing || disabled}
        className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2.5 min-h-[52px] ${
          processing
            ? "bg-amber-500/80 text-slate-950 cursor-wait"
            : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25 active:scale-95"
        }`}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            <span>Processing Payment...</span>
          </span>
        ) : (
          <span>Pay ₹{amount} with UPI</span>
        )}
      </motion.button>
    </motion.div>
  );
}
