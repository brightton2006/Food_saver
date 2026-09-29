import React from "react";
import { motion } from "framer-motion";

export default function AnimatedCard({ number, name, expiry, cvv, focused }) {
  const formatted = (number || "").replace(/(\d{4})/g, "$1 ").trim();
  const showBack = focused === "cvv";

  return (
    <div className="animated-card-wrap">
      <motion.div
        className={`card-preview ${showBack ? "flipped" : "front"}`}
        animate={{ rotateY: showBack ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      >
        <div className="card-front">
          <div className="chip" />
          <div className="card-number">
            {formatted || "•••• •••• •••• ••••"}
          </div>
          <div className="card-row">
            <div className="card-name">{name || "CARDHOLDER"}</div>
            <div className="card-expiry">{expiry || "MM/YY"}</div>
          </div>
        </div>

        <div className="card-back">
          <div className="magstripe" />
          <div className="cvv-box">{cvv ? cvv.replace(/./g, "•") : "•••"}</div>
        </div>
      </motion.div>
    </div>
  );
}
