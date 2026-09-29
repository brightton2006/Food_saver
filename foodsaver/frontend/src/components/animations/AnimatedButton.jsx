import React from "react";
import { motion } from "framer-motion";
import { isReducedMotion } from "../../lib/animations.js";

/**
 * AnimatedButton
 * Premium micro-interaction button with subtle tap feedback, hover lift & loading state
 */
export default function AnimatedButton({
  children,
  onClick,
  className = "btn btn-amber",
  disabled = false,
  loading = false,
  type = "button",
  style = {},
  ...props
}) {
  const reduced = isReducedMotion();

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={reduced || disabled || loading ? {} : { y: -1.5, filter: "brightness(1.06)" }}
      whileTap={reduced || disabled || loading ? {} : { scale: 0.975 }}
      transition={{ duration: 0.16 }}
      className={className}
      style={{
        position: "relative",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <svg
            style={{ animation: "spin 0.9s linear infinite", width: 16, height: 16 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
