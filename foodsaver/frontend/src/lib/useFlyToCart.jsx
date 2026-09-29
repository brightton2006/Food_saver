import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";

export function useFlyToCart() {
  const [flyingClones, setFlyingClones] = useState([]);

  const flyToCart = useCallback((foodImageSrc, originElement, onComplete) => {
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cartTarget =
      document.querySelector("[data-cart-icon]") ||
      document.getElementById("cart-icon-target") ||
      document.querySelector(".header-cart-btn");

    if (prefersReducedMotion || !originElement || !cartTarget) {
      if (cartTarget) {
        cartTarget.classList.add("cart-bounce-reaction");
        setTimeout(() => cartTarget.classList.remove("cart-bounce-reaction"), 500);
      }
      onComplete?.();
      return;
    }

    const originRect = originElement.getBoundingClientRect();
    const cartRect = cartTarget.getBoundingClientRect();

    const startX = originRect.left + originRect.width / 2 - 25;
    const startY = originRect.top + originRect.height / 2 - 25;

    const endX = cartRect.left + cartRect.width / 2 - 18;
    const endY = cartRect.top + cartRect.height / 2 - 18;

    const cloneId = `fly_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newClone = {
      id: cloneId,
      src: foodImageSrc,
      startX,
      startY,
      endX,
      endY,
      deltaX: endX - startX,
      deltaY: endY - startY,
    };

    setFlyingClones((prev) => [...prev, newClone]);

    // Animate flight & trigger cart pulse reaction at 550ms
    setTimeout(() => {
      if (cartTarget) {
        cartTarget.classList.add("cart-bounce-reaction");
        setTimeout(() => cartTarget.classList.remove("cart-bounce-reaction"), 500);
      }

      setFlyingClones((prev) => prev.filter((item) => item.id !== cloneId));
      onComplete?.();
    }, 600);
  }, []);

  const FlyCanvas = useCallback(() => {
    if (flyingClones.length === 0) return null;

    return createPortal(
      <div className="flying-clones-portal-canvas" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99999 }}>
        {flyingClones.map((clone) => (
          <div
            key={clone.id}
            className="flying-food-clone-avatar"
            style={{
              position: "fixed",
              left: clone.startX,
              top: clone.startY,
              width: 52,
              height: 52,
              borderRadius: "50%",
              backgroundImage: `url(${clone.src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 0 0 2px rgba(245, 158, 11, 0.8)",
              pointerEvents: "none",
              transformOrigin: "center center",
              animation: "flyToCartPath 600ms cubic-bezier(0.2, 0.8, 0.25, 1) forwards",
              "--delta-x": `${clone.deltaX}px`,
              "--delta-y": `${clone.deltaY}px`,
            }}
          />
        ))}
      </div>,
      document.body
    );
  }, [flyingClones]);

  return { flyToCart, FlyCanvas };
}
