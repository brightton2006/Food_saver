/**
 * FoodSaver Production Motion & Animation System
 *
 * Core Motion Principles:
 * - Smooth, natural easing [0.16, 1, 0.3, 1]
 * - 150–250ms for micro-interactions
 * - 300–450ms for page transitions
 * - 800–1200ms for cinematic transitions
 * - Full respect for prefers-reduced-motion
 */

export const isReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Custom Cubic Easing
export const premiumEase = [0.16, 1, 0.3, 1];
export const gentleEase = [0.25, 0.1, 0.25, 1];

// Springs
export const smoothSpring = {
  type: "spring",
  stiffness: 380,
  damping: 28,
};

export const gentleSpring = {
  type: "spring",
  stiffness: 220,
  damping: 24,
};

export const bouncySpring = {
  type: "spring",
  stiffness: 420,
  damping: 18,
};

// Page Transition Variants
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: premiumEase,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.18,
      ease: premiumEase,
    },
  },
};

// Subtle Upward Reveal Variants (for hero & headings)
export const fadeUpVariants = {
  hidden: {
    opacity: 0,
    y: 18,
  },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.48,
      delay: custom * 0.08,
      ease: premiumEase,
    },
  }),
};

// Stagger Container
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

// Food Card Micro-interactions
export const cardHoverVariants = {
  rest: {
    y: 0,
    scale: 1,
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)",
    transition: { duration: 0.22, ease: premiumEase },
  },
  hover: {
    y: -4,
    scale: 1.015,
    boxShadow: "0 16px 36px rgba(0, 0, 0, 0.38), 0 0 20px rgba(105, 199, 168, 0.12)",
    transition: { duration: 0.22, ease: premiumEase },
  },
  tap: {
    scale: 0.985,
    transition: { duration: 0.12 },
  },
};

// Subtly Shaking Error Variant (e.g. invalid token)
export const shakeVariants = {
  idle: { x: 0 },
  shake: {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    transition: {
      duration: 0.42,
      ease: "easeInOut",
    },
  },
};

// Pulsing Radar Beacon Variant
export const radarPulseVariants = {
  pulse: {
    scale: [1, 2.2],
    opacity: [0.8, 0],
    transition: {
      duration: 2.0,
      repeat: Infinity,
      ease: "easeOut",
    },
  },
};

// SVG Path Draw Variants
export const checkmarkPathVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.45, ease: premiumEase },
      opacity: { duration: 0.15 },
    },
  },
};
