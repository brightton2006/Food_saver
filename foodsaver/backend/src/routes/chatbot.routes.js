const express = require("express");
const router = express.Router();

const KNOWLEDGE_BASE = [
  {
    keywords: ["find", "near", "location", "radius", "2km", "2 km", "distance", "explore"],
    response: "FoodSaver uses real-time geospatial distance calculation to show surplus food listings within a 2 km radius of your location. Make sure your location permission is enabled so you receive instant notifications when nearby restaurants post surplus meals!",
    suggestions: ["How do I place an order?", "What payment methods are supported?", "How does pickup work?"],
  },
  {
    keywords: ["order", "buy", "purchase", "cart", "checkout", "claim"],
    response: "To place an order: 1. Browse nearby restaurants on the FoodSaver feed. 2. Select your desired meal bundle and add it to your cart. 3. Choose your payment method (UPI, Card, or Cash on Pickup). 4. Upon checkout, you'll receive a secure digital claim token and live tracking updates!",
    suggestions: ["How do I track my order?", "What payment methods are supported?", "Where is my pickup token?"],
  },
  {
    keywords: ["track", "live", "status", "delivery", "map", "gps"],
    response: "FoodSaver provides live order tracking! Once the merchant confirms and prepares your order, real-time tracking begins. You can see the merchant's coordinates, preparation progress, and navigation route. Tracking automatically stops once you pick up or receive the order.",
    suggestions: ["How do I collect my order?", "How can I contact the restaurant?"],
  },
  {
    keywords: ["pay", "payment", "upi", "card", "cash", "refund"],
    response: "FoodSaver supports multiple secure payment options: UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Cash on Pickup at the restaurant counter. All payments are securely encrypted.",
    suggestions: ["How do I claim a refund?", "Can I pay at the counter?"],
  },
  {
    keywords: ["merchant", "seller", "restaurant", "hotel", "onboard", "register", "partner", "verification", "fssai"],
    response: "To become a verified merchant on FoodSaver: 1. Click 'Partner Onboarding' and submit your business details. 2. Upload your FSSAI/Food License and GST documents. 3. Our Admin team reviews the documents within 24 hours. 4. Once approved, you can instantly publish surplus food deals and reduce food waste!",
    suggestions: ["What documents are needed for merchants?", "How does the Food Rescue Intelligence work?"],
  },
  {
    keywords: ["ngo", "rescue", "donate", "donation", "food bank", "charity", "free food"],
    response: "NGOs play a vital role in FoodSaver's zero-waste mission! Unclaimed or closing-time surplus food is automatically eligible for NGO Rescue. Registered NGOs can claim donations with 1 click and arrange rapid collection for community distribution.",
    suggestions: ["How do NGOs register on FoodSaver?", "How is food waste calculated?"],
  },
  {
    keywords: ["safe", "safety", "hygiene", "quality", "fresh", "expiry"],
    response: "All food items on FoodSaver are freshly prepared, wholesome meals that were unsold during regular business hours (not leftover or expired food). Merchants adhere to strict food safety guidelines, and all listings have clear pickup windows and shelf-life tracking.",
    suggestions: ["How do I find food near me?", "What is Food Rescue Intelligence?"],
  },
  {
    keywords: ["intelligence", "smart", "pricing", "discount", "waste", "saved", "co2", "metric"],
    response: "FoodSaver's Food Rescue Intelligence monitors real-time sales velocity and expiry windows. It dynamically recommends optimal discounts to clear stock quickly and calculates environmental impact (Total Food Saved in kg, portions rescued, and CO2 emissions prevented).",
    suggestions: ["How much food has been saved?", "How does 2 km discovery work?"],
  },
];

/**
 * POST /api/chatbot/message
 * Safe, context-aware chatbot endpoint
 */
router.post("/message", async (req, res) => {
  try {
    const { message = "" } = req.body || {};
    const cleanText = message.trim().toLowerCase();

    if (!cleanText) {
      return res.status(400).json({ error: "Message text is required." });
    }

    // Security filter: Prevent revealing secrets or credentials
    if (
      cleanText.includes("password") ||
      cleanText.includes("jwt") ||
      cleanText.includes("secret") ||
      cleanText.includes("api key") ||
      cleanText.includes("env") ||
      cleanText.includes("token")
    ) {
      return res.json({
        ok: true,
        reply: "For your security, FoodSaver Assistant never discloses authentication secrets, passwords, or internal security credentials. How can I help you with finding food or managing orders?",
        suggestions: ["How to find nearby food?", "How to order?", "Merchant onboarding help"],
      });
    }

    // Keyword matching
    let matched = null;
    let highestScore = 0;

    for (const item of KNOWLEDGE_BASE) {
      let score = 0;
      for (const kw of item.keywords) {
        if (cleanText.includes(kw)) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        matched = item;
      }
    }

    if (matched && highestScore > 0) {
      return res.json({
        ok: true,
        reply: matched.response,
        suggestions: matched.suggestions,
      });
    }

    // Default intelligent fallback
    return res.json({
      ok: true,
      reply: "FoodSaver connects local restaurants with customers and NGOs to rescue fresh surplus food at up to 70% discount. You can discover nearby food within 2 km, track orders live, or register as a merchant/NGO partner.",
      suggestions: [
        "How can I find food near me?",
        "How do I become a verified merchant?",
        "How does NGO food rescue work?",
        "How does live order tracking work?",
      ],
    });
  } catch (err) {
    console.error("Error in chatbot endpoint:", err);
    return res.status(500).json({ error: "Failed to process chat message." });
  }
});

module.exports = router;
