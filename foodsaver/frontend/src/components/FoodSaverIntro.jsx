import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * FoodSaverIntro — Cinematic 5-Scene Food-Focused Intro Animation
 * 
 * Timeline (Total 5.6s - 6.0s):
 * Scene 1 (0.0s – 1.3s): FOOD COMES ALIVE — Clean deep-teal background, appetizing cinematic food visual
 *                       (hot idlis, crispy dosa, bakery rolls, meal box), rising steam, slow camera drift.
 * Scene 2 (1.3s – 2.4s): THE PROBLEM — Kitchen closing hour (9:00 PM), untouched surplus food.
 *                       "Good food shouldn't go to waste." Professional, positive, not sad.
 * Scene 3 (2.4s – 3.6s): THE FOOD SAVER MOMENT — Food packed into clean takeaway box.
 *                       Restaurant → FoodSaver → Nearby Person with glowing teal route animation.
 * Scene 4 (3.6s – 4.7s): LOCAL DISCOVERY — Animated map radar, user location pin, popup food deal cards:
 *                       "Fresh Dosa • 50% OFF", "Bakery Box • 40% OFF", "Meal Pack • 60% OFF", "Available Nearby".
 * Scene 5 (4.7s – 5.8s): BRAND REVEAL — FoodSaver authentic logo smooth scale & glow, "FoodSaver",
 *                       "GOOD FOOD • LESS WASTE", "Save Food. Save More. Make a Difference.",
 *                       journey: "FOOD 🍽️ → DISCOVERY 📍 → SAVINGS 💰 → RESCUE ♻️ → IMPACT 🌱"
 * Morph & Transition: Seamless fade into homepage with responsive Skip button and session cache.
 */
export default function FoodSaverIntro({ onComplete, enabled = true }) {
  const [scene, setScene] = useState(1);
  const [isMorphingToHome, setIsMorphingToHome] = useState(false);
  const [progress, setProgress] = useState(0);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Floating ambient micro-particles in FoodSaver palette
  const particles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: (i * 19.3) % 94 + 3,
      y: (i * 27.7) % 92 + 4,
      size: 2.5 + ((i * 3) % 3.5),
      delay: (i * 0.14) % 1.2,
      duration: 2.5 + (i % 3) * 0.7,
      color: i % 3 === 0 ? "#16796B" : i % 3 === 1 ? "#FF9F43" : "#F5C451",
    }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (onComplete) onComplete();
      return;
    }

    if (prefersReducedMotion) {
      const quick = setTimeout(() => {
        if (onComplete) onComplete();
      }, 800);
      return () => clearTimeout(quick);
    }

    // Timeline orchestrator:
    // Scene 1: 0.0s – 1.3s
    // Scene 2: 1.3s – 2.4s
    // Scene 3: 2.4s – 3.6s
    // Scene 4: 3.6s – 4.7s
    // Scene 5: 4.7s – 5.8s
    // Crossfade exit: 5.8s – 6.2s
    const t2 = setTimeout(() => setScene(2), 1300);
    const t3 = setTimeout(() => setScene(3), 2400);
    const t4 = setTimeout(() => setScene(4), 3600);
    const t5 = setTimeout(() => setScene(5), 4700);

    const tMorph = setTimeout(() => {
      setIsMorphingToHome(true);
    }, 5650);

    const tEnd = setTimeout(() => {
      if (onComplete) onComplete();
    }, 6150);

    // Progress bar ticker
    const start = Date.now();
    const duration = 5800;
    const pTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / duration) * 100));
    }, 35);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(tMorph);
      clearTimeout(tEnd);
      clearInterval(pTimer);
    };
  }, [enabled, prefersReducedMotion, onComplete]);

  const handleSkip = () => {
    setIsMorphingToHome(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 350);
  };

  if (!enabled) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isMorphingToHome ? 0 : 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: "#0F4C45",
        color: "#ffffff",
        fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Bar: Subtle Mission pill + Fast Skip button */}
      <div className="absolute top-5 left-5 right-5 z-50 flex items-center justify-between pointer-events-auto">
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#145C52]/70 border border-[#16796B]/50 backdrop-blur-md text-[11px] font-semibold text-[#E8F4F1] tracking-wide">
          <span>🌱</span>
          <span>GOOD FOOD • GREAT SAVINGS • LESS WASTE</span>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="ml-auto group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase text-[#E8F4F1] hover:text-white bg-[#0F4C45]/80 hover:bg-[#145C52] border border-[#DCE6E3]/30 hover:border-[#16796B] backdrop-blur-xl transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
          title="Skip intro animation"
        >
          <span>Skip</span>
          <span className="text-[#FF9F43] group-hover:translate-x-0.5 transition-transform text-xs">→</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 🎬 SCENE 01: FOOD COMES ALIVE (0.0s – 1.3s)              */}
      {/* ======================================================== */}
      {scene === 1 && (
        <motion.div
          key="scene-1-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          {/* Realistic Food Photography with slow camera drift (Warm, Appetizing, Natural colors) */}
          <motion.div
            initial={{ scale: 1.15, opacity: 0.4 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <img
              src="/cinematic_fresh_food.jpg"
              alt="Fresh gourmet South Indian food, crispy dosa, hot idlis, bakery box"
              className="w-full h-full object-cover object-center"
              style={{
                filter: "brightness(0.92) contrast(1.05)",
              }}
            />
            {/* Subtle Dark Teal Vignette at edges - NOT heavy filter over food */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, transparent 45%, rgba(15, 76, 69, 0.65) 90%, #0F4C45 100%)",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(to top, #0F4C45 0%, transparent 35%, transparent 70%, rgba(15, 76, 69, 0.7) 100%)",
              }}
            />
          </motion.div>

          {/* Realistic Gentle Rising Steam Wisps above hot idlis */}
          <div className="absolute top-[35%] left-[51%] pointer-events-none flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  y: [-5, -45],
                  x: [0, (i % 2 === 0 ? 6 : -6)],
                  opacity: [0, 0.65, 0],
                  scaleX: [0.8, 1.4],
                }}
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  delay: i * 0.35,
                  ease: "easeOut",
                }}
                className="w-2.5 h-16 rounded-full bg-gradient-to-t from-white/40 via-white/15 to-transparent blur-[3px]"
              />
            ))}
          </div>

          {/* Appetizing Food Item Tags Floating Gently */}
          <div className="absolute top-20 sm:top-24 left-6 sm:left-12 z-20 flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="px-3.5 py-1.5 rounded-full bg-[#145C52]/90 border border-[#16796B] backdrop-blur-md shadow-lg text-[12px] font-bold text-white flex items-center gap-1.5"
            >
              <span>♨️</span>
              <span>Hot Steaming Idlis</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="px-3.5 py-1.5 rounded-full bg-[#145C52]/90 border border-[#FF9F43]/60 backdrop-blur-md shadow-lg text-[12px] font-bold text-[#F5C451] flex items-center gap-1.5"
            >
              <span>🥞</span>
              <span>Crispy Golden Dosa</span>
            </motion.div>
          </div>

          {/* Bottom Headline Caption */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
            className="absolute bottom-16 sm:bottom-20 z-20 text-center px-4"
          >
            <span className="text-xl sm:text-3xl font-extrabold tracking-wide text-white drop-shadow-lg">
              Freshly Prepared. Delicious. Full of Value.
            </span>
            <div className="text-xs sm:text-sm font-medium text-[#E8F4F1] mt-1 drop-shadow">
              Hot meals, crispy savories & bakery specials from top local kitchens
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* 🎬 SCENE 02: THE PROBLEM — BUT VALUE REMAINS (1.3s – 2.4s)*/}
      {/* ======================================================== */}
      {scene === 2 && (
        <motion.div
          key="scene-2-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          {/* Subtle dimming with gentle food focus */}
          <div className="absolute inset-0">
            <img
              src="/cinematic_fresh_food.jpg"
              alt="Closing hour meal"
              className="w-full h-full object-cover object-center filter brightness-[0.35] blur-[2px] scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F4C45]/85 via-[#145C52]/90 to-[#0F4C45]/95 backdrop-blur-sm" />
          </div>

          {/* Warm Golden Glow of Opportunity in the center */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.95, 1.15, 1], opacity: [0.3, 0.65, 0.45] }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            className="absolute w-[440px] h-[440px] rounded-full blur-[80px] bg-gradient-to-r from-[#FF9F43]/30 via-[#F5C451]/25 to-[#16796B]/30 pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl">
            {/* Elegant Kitchen Closing Timer Indicator */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#0F4C45] border border-[#FF9F43]/50 shadow-2xl mb-6 backdrop-blur-md"
            >
              <span className="text-xl">🕒</span>
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#F5C451]">
                <span>Kitchen Closing Hour:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#FF9F43]/20 text-white font-extrabold">
                  9:00 PM
                </span>
              </div>
            </motion.div>

            {/* Core Professional Statement */}
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
              className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3"
            >
              “Good food shouldn't go to waste.”
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.45 }}
              className="text-sm sm:text-base text-[#E8F4F1] font-normal leading-relaxed max-w-md"
            >
              Untouched, high-quality surplus meals are ready to be rescued at incredible discounts.
            </motion.p>
          </div>
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* 🎬 SCENE 03: THE FOOD SAVER MOMENT (2.4s – 3.6s)         */}
      {/* ======================================================== */}
      {scene === 3 && (
        <motion.div
          key="scene-3-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ background: "#0F4C45" }}
        >
          {/* Subtle Map Grid lines */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: "linear-gradient(rgba(22, 121, 107, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(22, 121, 107, 0.3) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Central Transformation: Food packed into clean takeaway box & connected */}
          <div className="relative z-10 w-full max-w-xl px-6 flex flex-col items-center">
            {/* Top Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="mb-8 px-4 py-1.5 rounded-full bg-[#145C52] border border-[#16796B] text-[12px] font-bold text-[#E8F4F1] flex items-center gap-2 shadow-lg"
            >
              <span>📦</span>
              <span>Packed Fresh into Clean Eco Takeaway Boxes</span>
            </motion.div>

            {/* Pipeline: Restaurant → FoodSaver → Nearby Person */}
            <div className="flex items-center justify-between w-full mb-8 relative">
              {/* Restaurant Node */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFFFFF] border-2 border-[#16796B] flex items-center justify-center text-2xl shadow-[0_8px_25px_rgba(20,92,82,0.35)]">
                  🏪
                </div>
                <span className="text-[12px] font-extrabold text-white mt-2">
                  Restaurant
                </span>
                <span className="text-[10px] text-[#E8F4F1]">Surplus Food</span>
              </motion.div>

              {/* Glowing Teal Connecting Route 1 */}
              <div className="flex-1 h-1.5 bg-[#145C52] mx-2 sm:mx-3 relative overflow-hidden rounded-full border border-[#16796B]/50">
                <motion.div
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-1/2 h-full bg-gradient-to-r from-[#16796B] via-[#FF9F43] to-[#F5C451] shadow-[0_0_12px_#FF9F43]"
                />
              </div>

              {/* FoodSaver Core Node */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="flex flex-col items-center relative"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#145C52] to-[#0F4C45] border-2 border-[#FF9F43] flex items-center justify-center text-3xl shadow-[0_0_35px_rgba(255,159,67,0.55)]">
                  ⚡
                </div>
                <span className="text-[12px] font-black text-[#FF9F43] mt-2">
                  FoodSaver
                </span>
                <span className="text-[10px] text-[#F5C451]">Instant Match</span>
              </motion.div>

              {/* Glowing Teal Connecting Route 2 */}
              <div className="flex-1 h-1.5 bg-[#145C52] mx-2 sm:mx-3 relative overflow-hidden rounded-full border border-[#16796B]/50">
                <motion.div
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-1/2 h-full bg-gradient-to-r from-[#16796B] via-[#FF9F43] to-[#F5C451] shadow-[0_0_12px_#FF9F43]"
                />
              </div>

              {/* Nearby Person Node */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFFFFF] border-2 border-[#FF9F43] flex items-center justify-center text-2xl shadow-[0_8px_25px_rgba(255,159,67,0.35)]">
                  📍
                </div>
                <span className="text-[12px] font-extrabold text-white mt-2">
                  Nearby Person
                </span>
                <span className="text-[10px] text-[#E8F4F1]">Happy Pickup</span>
              </motion.div>
            </div>

            {/* Bottom Caption */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-center text-sm font-semibold text-[#E8F4F1]"
            >
              Direct hyper-local connection from commercial kitchens to your table.
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* 🎬 SCENE 04: LOCAL DISCOVERY & FOOD CARDS (3.6s – 4.7s)  */}
      {/* ======================================================== */}
      {scene === 4 && (
        <motion.div
          key="scene-4-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{ background: "#0F4C45" }}
        >
          {/* Animated Map Style Canvas */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: "linear-gradient(rgba(232, 244, 241, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(232, 244, 241, 0.2) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Central User Location Radar Beacon */}
          <div className="absolute flex items-center justify-center pointer-events-none">
            <motion.div
              animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-28 h-28 rounded-full border-2 border-[#16796B]"
            />
            <motion.div
              animate={{ scale: [1, 2.0], opacity: [0.5, 0] }}
              transition={{ duration: 1.6, delay: 0.4, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-20 h-20 rounded-full border-2 border-[#FF9F43]"
            />
            {/* Center User Dot */}
            <div className="w-12 h-12 rounded-full bg-[#145C52] border-4 border-white shadow-[0_0_24px_rgba(20,92,82,0.8)] flex items-center justify-center text-lg z-10">
              📍
            </div>
            <div className="absolute -bottom-6 text-[11px] font-extrabold text-[#E8F4F1] uppercase tracking-wider bg-[#0F4C45]/80 px-2 py-0.5 rounded-full">
              Your Location
            </div>
          </div>

          {/* Popping Up Food Deal Cards Around User */}
          <div className="relative z-20 w-full max-w-2xl px-6 h-[340px] pointer-events-none">
            {/* Card 1: Fresh Dosa • 50% OFF (Top-Left) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, x: -30, y: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="absolute top-4 left-4 sm:left-10 bg-white rounded-2xl p-3 shadow-[0_12px_30px_rgba(20,92,82,0.25)] border border-[#DCE6E3] flex items-center gap-3 w-56 sm:w-60"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E8F4F1] flex items-center justify-center text-xl shrink-0">
                🥞
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[#102A2A] truncate">
                  Fresh Dosa
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-[#FF9F43] bg-[#FF9F43]/15 px-1.5 py-0.5 rounded">
                    50% OFF
                  </span>
                  <span className="text-[10px] text-[#687674]">450m away</span>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Bakery Box • 40% OFF (Top-Right) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, x: 30, y: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="absolute top-8 right-4 sm:right-10 bg-white rounded-2xl p-3 shadow-[0_12px_30px_rgba(20,92,82,0.25)] border border-[#DCE6E3] flex items-center gap-3 w-56 sm:w-60"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E8F4F1] flex items-center justify-center text-xl shrink-0">
                🥐
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[#102A2A] truncate">
                  Bakery Box
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-[#FF9F43] bg-[#FF9F43]/15 px-1.5 py-0.5 rounded">
                    40% OFF
                  </span>
                  <span className="text-[10px] text-[#687674]">800m away</span>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Meal Pack • 60% OFF (Bottom-Left) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6, x: -30, y: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ delay: 0.4, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="absolute bottom-6 left-4 sm:left-12 bg-white rounded-2xl p-3 shadow-[0_12px_30px_rgba(20,92,82,0.25)] border border-[#DCE6E3] flex items-center gap-3 w-56 sm:w-60"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E8F4F1] flex items-center justify-center text-xl shrink-0">
                🍱
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[#102A2A] truncate">
                  Meal Pack
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-[#FF9F43] bg-[#FF9F43]/15 px-1.5 py-0.5 rounded">
                    60% OFF
                  </span>
                  <span className="text-[10px] text-[#687674]">1.1 km away</span>
                </div>
              </div>
            </motion.div>

            {/* Available Nearby Badge (Bottom-Right) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, x: 30, y: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              transition={{ delay: 0.55, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="absolute bottom-8 right-4 sm:right-12 bg-[#145C52] rounded-2xl px-4 py-2.5 shadow-xl border border-[#16796B] flex items-center gap-2.5"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#4CAF73] animate-ping" />
              <span className="text-xs font-bold text-white tracking-wide">
                Available Nearby
              </span>
            </motion.div>
          </div>

          {/* Bottom Discovery Caption */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="absolute bottom-6 text-center text-xs sm:text-sm font-semibold text-[#E8F4F1]"
          >
            Live GPS proximity discovery — finding hot surplus deals near you in real-time.
          </motion.div>
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* 🎬 SCENE 05: BRAND REVEAL & CALL TO ACTION (4.7s – 5.8s)  */}
      {/* ======================================================== */}
      {scene === 5 && (
        <motion.div
          key="scene-5-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 flex flex-col items-center text-center px-6"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -inset-10 rounded-full bg-gradient-to-r from-[#16796B]/30 via-[#FF9F43]/20 to-[#145C52]/40 blur-3xl opacity-80 pointer-events-none animate-pulse" />

          {/* Authentic FoodSaver Logo: Small → smooth scale-up → subtle glow → settle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{
              opacity: 1,
              scale: [0.7, 1.06, 1.0],
            }}
            transition={{ duration: 0.65, times: [0, 0.7, 1], ease: [0.34, 1.56, 0.64, 1] }}
            className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl p-3 bg-white shadow-[0_20px_50px_rgba(15,76,69,0.45)] border-2 border-[#16796B] flex items-center justify-center mb-5 z-20"
          >
            <img
              src="/logo.png"
              alt="FoodSaver Logo"
              className="w-full h-full object-contain pointer-events-none"
            />
          </motion.div>

          {/* Brand Name */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-1"
          >
            Food<span className="text-[#FF9F43]">Saver</span>
          </motion.h1>

          {/* Primary Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-[#F5C451] mb-3"
          >
            GOOD FOOD • LESS WASTE
          </motion.div>

          {/* Stronger Tagline Statement */}
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.45 }}
            className="text-lg sm:text-2xl font-extrabold text-white tracking-tight mb-4"
          >
            “Save Food. Save More. Make a Difference.”
          </motion.h2>

          {/* Emotional Journey Pillars */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.45 }}
            className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-bold tracking-wider text-[#E8F4F1] uppercase px-4 py-2 rounded-full bg-[#145C52]/90 border border-[#16796B] shadow-inner"
          >
            <span>FOOD 🍽️</span>
            <span className="text-[#16796B]">•</span>
            <span>DISCOVERY 📍</span>
            <span className="text-[#16796B]">•</span>
            <span>SAVINGS 💰</span>
            <span className="text-[#16796B]">•</span>
            <span>RESCUE ♻️</span>
            <span className="text-[#16796B]">•</span>
            <span className="text-[#FF9F43]">IMPACT 🌱</span>
          </motion.div>
        </motion.div>
      )}

      {/* Floating Micro-particles across entire intro */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.15, 0.65, 0.15],
              y: [-5, -45],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 6px ${p.color}`,
            }}
          />
        ))}
      </div>

      {/* Sleek Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#145C52]/60">
        <motion.div
          className="h-full bg-gradient-to-r from-[#16796B] via-[#FF9F43] to-[#F5C451]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
