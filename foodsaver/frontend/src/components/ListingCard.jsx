import React, { useState, useEffect, useRef } from "react";
import { useCountdown } from "../lib/useCountdown";
import { useFlyToCart } from "../lib/useFlyToCart";
import { useCart } from "../lib/cart.jsx";
import { useSession } from "../lib/session.jsx";
import NoImagePlaceholder from "./NoImagePlaceholder.jsx";
import { getFoodFallbackImage } from "../lib/foodImageService.js";



function formatDistance(listing) {
  if (listing.distanceFormatted) return listing.distanceFormatted;
  if (listing.distance_km !== undefined && listing.distance_km !== null) {
    const d = Number(listing.distance_km);
    return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
  }
  if (listing.distanceKm !== undefined && listing.distanceKm !== null) {
    const d = Number(listing.distanceKm);
    return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
  }
  return "";
}

export default function ListingCard({ listing, onClaim, isMerchant = false }) {
  const { session } = useSession();
  const isMerchantUser = isMerchant || session?.role === "merchant";
  const { addToCart, cartItems, updateQuantity } = useCart();
  const [btnState, setBtnState] = useState("idle"); // idle | adding | added
  const [showToast, setShowToast] = useState(false);
  const { flyToCart, FlyCanvas } = useFlyToCart();
  const imgRef = useRef(null);

  const hasMerchantImage = Boolean(listing.imageUrl && String(listing.imageUrl).trim().length > 0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [listing.imageUrl]);

  const soldOut = listing.quantityAvailable <= 0;
  const savingsPct = listing.originalPrice
    ? Math.max(
        10,
        Math.round((1 - listing.discountPrice / listing.originalPrice) * 100),
      )
    : 0;
  const rating = listing.rating ? Number(listing.rating) : null;
  const distance = formatDistance(listing);
  const timer = useCountdown(listing.expiresAt, listing.createdAt);
  const isVeg = !/chicken|mutton|egg|fish|meen|kari/i.test(listing.itemName);
  const qtyLeft = listing.quantityAvailable ?? listing.quantityTotal ?? 0;

  function handleAddToCartClick(e) {
    e.stopPropagation();
    if (isMerchantUser || soldOut || (listing.status && listing.status !== "active")) return;

    setBtnState("adding");

    // Add item to cart context
    addToCart(listing, 1);

    // Trigger Fly-to-Cart Animation from image to header cart icon
    flyToCart(listing.imageUrl || "", imgRef.current, () => {
      setBtnState("added");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1800);
      setTimeout(() => setBtnState("idle"), 2400);
    });
  }

  // Check if item is currently in cart
  const cartItem = cartItems.find((item) => item.listing.id === listing.id);
  const inCartQty = cartItem ? cartItem.quantity : 0;

  function handleIncrease(e) {
    e.stopPropagation();
    if (isMerchantUser) return;
    if (inCartQty < listing.quantityAvailable) {
      updateQuantity(listing.id, inCartQty + 1);
    }
  }

  function handleDecrease(e) {
    e.stopPropagation();
    if (isMerchantUser) return;
    updateQuantity(listing.id, inCartQty - 1);
  }

  const [isFavorite, setIsFavorite] = useState(false);
  const [justFavorited, setJustFavorited] = useState(false);

  function handleFavoriteClick(e) {
    e.stopPropagation();
    const next = !isFavorite;
    setIsFavorite(next);
    if (next) {
      setJustFavorited(true);
      setTimeout(() => setJustFavorited(false), 1600);
    }
  }

  return (
    <>
      <FlyCanvas />
      <article
        className="card food-card"
        onClick={() => !isMerchantUser && !soldOut && onClaim && onClaim(listing)}
        style={{
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
      >
        {/* 1. RESTAURANT IMAGE WITH AUTOMATIC FOOD PHOTO FALLBACK */}
        <div ref={imgRef} className="food-card-media-wrap" style={{ position: "relative", overflow: "hidden", minHeight: 180 }}>
          {!imageLoaded && (
            <div
              className="shimmer-box"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 1,
              }}
            />
          )}
          <img
            src={listing.imageUrl || getFoodFallbackImage(listing.itemName, listing.category)}
            alt={listing.itemName}
            className="food-card-img"
            loading="lazy"
            style={{
              opacity: imageLoaded ? 1 : 0,
              transition: "opacity 0.3s ease-in-out, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
              objectFit: "cover",
              width: "100%",
              height: "100%",
            }}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = getFoodFallbackImage(listing.itemName, listing.category);
              setImageLoaded(true);
            }}
          />

          {/* TOP LEFT: VEG/NON-VEG BADGE & NIGHT DEAL */}
          <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 5, zIndex: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: isVeg ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)", color: "#fff", fontWeight: 700 }}>
              {isVeg ? "🟢 Veg" : "🔴 Non-Veg"}
            </span>
            {listing.isNightSale && (
              <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 12, background: "#f59e0b", color: "#091312", fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 3 }}>
                🌙 Night Deal
              </span>
            )}
            {listing.isClosingSoon && !timer.isClosed && (
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12, background: "#ef4444", color: "#fff", fontWeight: 800 }}>
                ⏳ Closing Soon
              </span>
            )}
          </div>

          {/* TOP RIGHT: FAVORITE SAVE BUTTON (♡ → ✓ Saved) */}
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label="Save food item"
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 3,
              background: isFavorite ? "rgba(34, 197, 94, 0.9)" : "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(6px)",
              border: `1px solid ${isFavorite ? "#22c55e" : "rgba(255, 255, 255, 0.2)"}`,
              borderRadius: 18,
              padding: "4px 9px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: justFavorited ? "scale(1.15)" : "scale(1)",
            }}
          >
            <span>{isFavorite ? "✓" : "♡"}</span>
            <span>{isFavorite ? "Saved" : "Save"}</span>
          </button>

          {/* BOTTOM LEFT: Offer Badge */}
          {savingsPct > 0 && (
            <span className="card-offer-badge" style={{ position: "absolute", bottom: 10, left: 10, zIndex: 2 }}>
              {savingsPct}% OFF
            </span>
          )}

          {/* BOTTOM RIGHT: Live Timer Badge */}
          <span
            className={`card-timer-badge ${timer.isClosed ? "closed" : ""}`}
            style={{ position: "absolute", bottom: 10, right: 10, zIndex: 2 }}
          >
            ⏱️ {timer.isClosed ? "Ended" : timer.label}
          </span>
        </div>

        {/* DYNAMIC CLOSING-WINDOW AVAILABILITY PROGRESS INDICATOR */}
        <div
          style={{
            height: 3,
            width: "100%",
            background: "rgba(255, 255, 255, 0.08)",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: timer.isClosed ? "0%" : "68%",
              background: timer.isClosed ? "#ef4444" : "linear-gradient(90deg, #10b981, #f59e0b)",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        <div className="food-card-body">
          {/* 2. DISH NAME & RESTAURANT */}
          <div className="card-row-name-rating">
            <h3 className="restaurant-card-title" title={listing.itemName}>
              {listing.itemName}
            </h3>
            {rating !== null && <span className="compact-rating-badge">★ {rating.toFixed(1)}</span>}
          </div>

          <div className="card-cuisine-line" style={{ color: "var(--color-text-secondary, #66736F)", fontSize: 13.5, fontWeight: 500 }}>
            By <strong style={{ color: "var(--color-charcoal, #24332F)", fontWeight: 800 }}>{listing.merchantName || listing.hotelName || "Verified Kitchen"}</strong> • {listing.category || "Meals"}
          </div>

          {/* 3. LOCATION & DISTANCE */}
          <div className="card-location-line" style={{ display: "flex", justifyContent: "space-between", color: "#66736F", fontWeight: 600, fontSize: 13 }}>
            <span>📍 {listing.address || "Local Kitchen"}</span>
            {distance ? <span style={{ color: "#2D3B37", fontWeight: 800 }}>{distance}</span> : null}
          </div>

          {/* SAFE STORAGE & PREPARATION BADGE */}
          {listing.safeStorageInfo && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "3px 8px", borderRadius: 6, marginTop: 4 }}>
              <span>🛡️</span>
              <span style={{ fontWeight: 600 }}>{listing.safeStorageInfo}</span>
            </div>
          )}

          {/* 4. PRICE DISPLAY (ORIGINAL STRIKETHROUGH + FLASH PRICE) */}
          <div className="card-row-price-distance" style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--fs-primary, #145C52)" }}>
              ₹{listing.discountPrice}
            </span>
            {listing.originalPrice > listing.discountPrice && (
              <span style={{ fontSize: 13.5, color: "var(--fs-text-muted, #8A9693)", textDecoration: "line-through", fontWeight: 500 }}>
                ₹{listing.originalPrice}
              </span>
            )}
            <span style={{ fontSize: 12, color: qtyLeft <= 3 ? "var(--fs-danger, #D9534F)" : "var(--fs-primary, #145C52)", fontWeight: 700, marginLeft: "auto" }}>
              {qtyLeft <= 3 ? `Only ${qtyLeft} left!` : `${qtyLeft} available`}
            </span>
          </div>

          {/* 5. AVAILABILITY & ANIMATED ADD TO CART / STEPPER CONTROL */}
          <div className="card-row-status-cta" style={{ marginTop: 8, position: "relative" }}>
            <span className="status-indicator-text open" style={{ color: timer.isClosed ? "var(--fs-text-muted)" : "var(--fs-success, #4CAF73)" }}>
              {timer.isClosed ? "Counter Closed" : `Pickup till ${listing.pickupWindowEnd || "22:00"}`}
            </span>
            
            {isMerchantUser ? (
              <button
                type="button"
                className="btn btn-outline"
                disabled
                style={{
                  minWidth: 105,
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: 0.85,
                  color: "var(--fs-primary)",
                  borderColor: "var(--fs-border)",
                  cursor: "default",
                }}
                title="Merchant Food accounts manage inventory; residents claim deals"
              >
                ✓ Active Listing
              </button>
            ) : inCartQty > 0 ? (
              <div
                className="card-qty-stepper"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1.5px solid var(--fs-primary)",
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(20, 92, 82, 0.15)",
                }}
              >
                <button
                  type="button"
                  onClick={handleDecrease}
                  style={{
                    background: "var(--fs-teal-light)",
                    border: "none",
                    color: "var(--fs-primary)",
                    fontWeight: 900,
                    fontSize: 18,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    color: "var(--fs-text)",
                    fontWeight: 800,
                    fontSize: 14,
                    minWidth: 28,
                    textAlign: "center",
                    background: "#FFFFFF",
                  }}
                >
                  {inCartQty}
                </span>
                <button
                  type="button"
                  onClick={handleIncrease}
                  style={{
                    background: "var(--fs-teal-light)",
                    border: "none",
                    color: "var(--fs-primary)",
                    fontWeight: 900,
                    fontSize: 18,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                className={`btn ${btnState === "added" ? "btn-secondary" : "btn-primary"} card-reserve-btn`}
                disabled={soldOut || (listing.status && listing.status !== "active") || btnState === "adding"}
                onClick={handleAddToCartClick}
                style={{
                  minWidth: 110,
                  transition: "all 0.2s ease",
                  transform: btnState === "adding" ? "scale(0.95)" : "scale(1)",
                  fontWeight: 600,
                  padding: "8px 16px",
                  minHeight: "38px",
                  fontSize: "13.5px",
                }}
              >
                {soldOut
                  ? "Sold out"
                  : btnState === "adding"
                    ? "Adding..."
                    : btnState === "added"
                      ? "✓ Added"
                      : "+ Add to Cart"}
              </button>
            )}

            {/* MICRO-TOAST CONFIRMATION */}
            {showToast && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  right: 0,
                  marginBottom: 6,
                  background: "#145C52",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                  animation: "badgePop 300ms ease-out forwards",
                  zIndex: 10,
                }}
              >
                ✓ Added to cart
              </div>
            )}
          </div>
        </div>
      </article>
    </>
  );
}

