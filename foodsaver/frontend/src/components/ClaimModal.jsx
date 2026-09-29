import React, { useState } from "react";
import { api } from "../lib/api.js";
import { addMyClaim } from "../lib/myClaims.js";
import { useSession } from "../lib/session.jsx";
import TokenStub from "./TokenStub.jsx";

export default function ClaimModal({ listing, customerName, onClose, onClaimed }) {
  const { session } = useSession();
  const [quantity, setQuantity] = useState(1);
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const maxQty = listing.quantityAvailable;

  async function handleClaim() {
    setBusy(true);
    setError(null);
    try {
      const custId = session?.userId || session?.id || session?.username || session?.email || "guest";
      const nameToPass = customerName || session?.name || "Resident Customer";
      const result = await api.claimListing(listing.id, {
        customerId: custId,
        customerName: nameToPass,
        customerUsername: session?.username || "resident_customer",
        quantity,
      });
      setClaim(result.claim);
      addMyClaim(result.claim, custId);
      onClaimed?.(result.claim);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="display" style={{ fontSize: 20 }}>
            {claim ? "You rescued it" : "Claim bundle"}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!claim && (
          <>
            <p style={{ marginTop: 0, color: "var(--dusk-soft)" }}>
              {listing.itemName} from {listing.merchantName} — ${listing.discountPrice.toFixed(2)} each.
            </p>
            <div className="qty-stepper-container" style={{ marginBottom: 16 }}>
              <label htmlFor="qty">Quantity ({maxQty} available)</label>
              <div className="qty-stepper-box">
                <button
                  type="button"
                  className="qty-step-btn"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  id="qty"
                  type="number"
                  min={1}
                  max={maxQty}
                  className="qty-step-input"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
                <button
                  type="button"
                  className="qty-step-btn"
                  disabled={quantity >= maxQty}
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
            {error && (
              <p style={{ color: "var(--ember)", fontSize: 13.5, marginTop: -8 }}>{error}</p>
            )}
            <button className="btn btn-amber" style={{ width: "100%" }} onClick={handleClaim} disabled={busy}>
              {busy ? "Claiming…" : `Claim ${quantity} for $${(quantity * listing.discountPrice).toFixed(2)}`}
            </button>
          </>
        )}

        {claim && (
          <>
            <TokenStub claim={claim} />
            <p style={{ fontSize: 13, color: "var(--dusk-soft)", marginTop: 14 }}>
              Show this token at the counter before {claim.pickupWindowEnd}. It's also saved under
              "My pickups".
            </p>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} onClick={onClose}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
