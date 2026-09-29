import React from "react";
import { motion } from "framer-motion";
import { checkmarkPathVariants, smoothSpring, isReducedMotion } from "../../lib/animations.js";

const PRESET_MESSAGES = {
  FOOD_LISTED: {
    title: "✓ Food successfully listed",
    subtitle: "Your surplus food is now live on the FoodSaver map for nearby customers.",
    badge: "Food Live",
  },
  ORDER_PLACED: {
    title: "✓ Order confirmed",
    subtitle: "Your food reservation has been submitted. Check your Pickup Token code.",
    badge: "Order Reserved",
  },
  TOKEN_VERIFIED: {
    title: "✓ Pickup verified",
    subtitle: "Customer verification completed. You may now complete handover.",
    badge: "Verified",
  },
  ORDER_COMPLETED: {
    title: "✓ Food successfully picked up",
    subtitle: "Thank you for rescuing surplus food and fighting food waste!",
    badge: "Completed",
  },
  MERCHANT_VERIFIED: {
    title: "✓ Partner verification completed",
    subtitle: "Your merchant store profile and food safety credentials have been verified.",
    badge: "Partner Approved",
  },
};

/**
 * SuccessAnimation
 * Elegant, professional checkmark animation for FoodSaver transactions
 */
export default function SuccessAnimation({
  type = "ORDER_COMPLETED",
  customTitle = null,
  customSubtitle = null,
  size = 64,
  onDismiss = null,
}) {
  const reduced = isReducedMotion();
  const info = PRESET_MESSAGES[type] || {
    title: customTitle || "Action Successful",
    subtitle: customSubtitle || "",
    badge: "Success",
  };

  const displayTitle = customTitle || info.title;
  const displaySubtitle = customSubtitle || info.subtitle;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "20px 16px",
      }}
    >
      {/* ANIMATED CIRCULAR CHECKMARK */}
      <motion.div
        initial={reduced ? {} : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={smoothSpring}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(34, 197, 94, 0.22) 0%, rgba(16, 185, 129, 0.35) 100%)",
          border: "2px solid #22c55e",
          boxShadow: "0 0 25px rgba(34, 197, 94, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            variants={reduced ? {} : checkmarkPathVariants}
            initial="hidden"
            animate="visible"
          />
        </svg>
      </motion.div>

      {/* TEXT HEADLINE WITH SUBTLE FADE-UP */}
      <motion.h4
        initial={reduced ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.35 }}
        style={{
          margin: "0 0 6px",
          fontSize: 19,
          color: "#ffffff",
          fontWeight: 800,
          letterSpacing: 0.3,
        }}
      >
        {displayTitle}
      </motion.h4>

      {displaySubtitle && (
        <motion.p
          initial={reduced ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.35 }}
          style={{
            margin: "0 0 16px",
            fontSize: 13.5,
            color: "#cbd5e1",
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          {displaySubtitle}
        </motion.p>
      )}

      {onDismiss && (
        <motion.button
          initial={reduced ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.3 }}
          type="button"
          className="btn btn-amber"
          onClick={onDismiss}
          style={{ padding: "8px 24px", fontSize: 13, fontWeight: 700 }}
        >
          Continue
        </motion.button>
      )}
    </div>
  );
}
