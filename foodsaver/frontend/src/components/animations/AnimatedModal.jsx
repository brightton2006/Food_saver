import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { smoothSpring, isReducedMotion } from "../../lib/animations.js";

/**
 * AnimatedModal
 * Unified modal presentation with backdrop blur and smooth spring physics
 */
export default function AnimatedModal({
  isOpen,
  onClose,
  children,
  maxWidth = 480,
  className = "",
}) {
  const reduced = isReducedMotion();

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen && onClose) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.76)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) onClose();
          }}
        >
          <motion.div
            initial={reduced ? {} : { scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduced ? {} : { scale: 0.94, opacity: 0, y: 8 }}
            transition={smoothSpring}
            className={`card ${className}`}
            style={{
              width: "100%",
              maxWidth,
              background: "#182421",
              borderRadius: 20,
              border: "1.5px solid rgba(105, 199, 168, 0.35)",
              boxShadow: "0 24px 50px rgba(0, 0, 0, 0.65), 0 0 35px rgba(105, 199, 168, 0.12)",
              padding: 24,
              position: "relative",
            }}
          >
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  color: "#cbd5e1",
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                }}
              >
                ✕
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
