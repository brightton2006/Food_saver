import React, { useState } from "react";
import { motion } from "framer-motion";

export default function CashOnDelivery({ amount, onConfirm }) {
  const [processing, setProcessing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="payment-panel cod-panel"
    >
      <div className="cod-card">
        <div className="cod-title">Cash on Delivery</div>
        <div className="cod-desc">
          Pay in cash when you collect your order at pickup.
        </div>
        <div className="cod-amount">Payable: ₹{amount}</div>
      </div>

      <div className="panel-actions">
        <button
          className="btn btn-primary"
          disabled={processing}
          onClick={async () => {
            setProcessing(true);
            await new Promise((r) => setTimeout(r, 900));
            setProcessing(false);
            onConfirm({ method: "cod" });
          }}
        >
          {processing ? "Confirming…" : "Confirm Cash on Delivery"}
        </button>
      </div>
    </motion.div>
  );
}
