import React from "react";
import { motion } from "framer-motion";
import { pageVariants, isReducedMotion } from "../../lib/animations.js";

/**
 * PageTransition
 * Wraps page contents with smooth route fade + subtle slide
 */
export default function PageTransition({ children, className = "" }) {
  if (isReducedMotion()) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className={className}
      style={{ width: "100%" }}
    >
      {children}
    </motion.div>
  );
}
