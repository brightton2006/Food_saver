import React, { useState } from "react";
import AnimatedCard from "./AnimatedCard";
import { motion, AnimatePresence } from "framer-motion";

export default function CardPayment({ amount, onConfirm, disabled = false }) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCvv, setShowCvv] = useState(false);
  const [focused, setFocused] = useState(null);
  const [processing, setProcessing] = useState(false);

  function formatNumber(v) {
    const raw = v.replace(/\D/g, "").slice(0, 16);
    return raw.replace(/(\d{4})/g, "$1 ").trim();
  }

  function getCardBrand(numStr) {
    const raw = numStr.replace(/\D/g, "");
    if (raw.startsWith("4")) return { name: "Visa", icon: "💳", color: "#3b82f6" };
    if (raw.startsWith("5") || raw.startsWith("2")) return { name: "Mastercard", icon: "💳", color: "#f97316" };
    if (raw.startsWith("60") || raw.startsWith("65") || raw.startsWith("81") || raw.startsWith("82")) return { name: "RuPay", icon: "💳", color: "#69C7A8" };
    if (raw.startsWith("34") || raw.startsWith("37")) return { name: "Amex", icon: "💳", color: "#06b6d4" };
    return { name: "Card", icon: "💳", color: "#8A9490" };
  }

  const rawDigits = number.replace(/\D/g, "");
  const isValidCard = rawDigits.length === 16;
  const cardBrand = getCardBrand(rawDigits);

  async function handlePayClick() {
    if (processing || disabled || !isValidCard) return;
    setProcessing(true);
    try {
      if (onConfirm) {
        await onConfirm({
          method: "card",
          last4: rawDigits.slice(-4),
          cardBrand: cardBrand.name,
        });
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="payment-panel card-panel space-y-4">
      <div className="card-preview-row mb-4">
        <AnimatedCard
          number={number}
          name={name}
          expiry={expiry}
          cvv={cvv}
          focused={focused}
        />
      </div>

      {/* CARD NUMBER FIELD WITH BRAND DETECTOR & CHECKMARK */}
      <div className="field">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Card Number</span>
          <AnimatePresence>
            {rawDigits.length > 0 && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: `${cardBrand.color}20`, color: cardBrand.color, border: `1px solid ${cardBrand.color}40` }}
              >
                <span>{cardBrand.icon}</span> {cardBrand.name}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="relative">
          <input
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white font-mono text-sm tracking-widest focus:outline-none focus:border-amber-500 transition-all shadow-inner"
            value={number}
            onChange={(e) => setNumber(formatNumber(e.target.value))}
            onFocus={() => setFocused("number")}
            inputMode="numeric"
            placeholder="1234  ••••  ••••  5678"
          />
          {isValidCard && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md"
            >
              ✓
            </motion.div>
          )}
        </div>
      </div>

      {/* NAME & EXPIRY GRID */}
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Cardholder Name</span>
          <input
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white text-xs uppercase focus:outline-none focus:border-amber-500 transition-all"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            onFocus={() => setFocused("name")}
            placeholder="FULL NAME ON CARD"
          />
        </div>

        <div className="field">
          <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Expiry (MM/YY)</span>
          <input
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white font-mono text-xs text-center focus:outline-none focus:border-amber-500 transition-all"
            value={expiry}
            onChange={(e) =>
              setExpiry(e.target.value.replace(/[^0-9\/]/g, "").slice(0, 5))
            }
            onFocus={() => setFocused("expiry")}
            placeholder="MM/YY"
          />
        </div>
      </div>

      {/* CVV FIELD WITH MASK TOGGLE */}
      <div className="field">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">CVV / CVC</span>
          <button
            type="button"
            onClick={() => setShowCvv((prev) => !prev)}
            className="text-[11px] text-amber-400 font-semibold hover:underline bg-amber-500/10 px-2 py-0.5 rounded"
          >
            {showCvv ? "🙈 Hide CVV" : "👁️ Show CVV"}
          </button>
        </div>
        <input
          type={showCvv ? "text" : "password"}
          className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white font-mono text-xs tracking-widest text-center focus:outline-none focus:border-amber-500 transition-all"
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onFocus={() => setFocused("cvv")}
          inputMode="numeric"
          placeholder="•••"
        />
      </div>

      {/* SUBMIT BUTTON WITH FINTECH PROCESSING ANIMATION */}
      <div className="pt-2">
        <motion.button
          type="button"
          whileHover={{ scale: processing || !isValidCard ? 1 : 1.01 }}
          whileTap={{ scale: processing || !isValidCard ? 1 : 0.98 }}
          onClick={handlePayClick}
          disabled={processing || disabled || !isValidCard}
          className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2.5 min-h-[52px] ${
            !isValidCard
              ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              : processing
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
            <span>Pay ₹{amount}</span>
          )}
        </motion.button>
      </div>
    </div>
  );
}
