const express = require("express");
const { fetchFoodImage } = require("../services/foodImageService");

const router = express.Router();

router.get("/", async (req, res) => {
  const query = String(req.query.name || req.query.query || req.query.q || "").trim();
  const category = String(req.query.category || "").trim();
  const cuisine = String(req.query.cuisine || "South Indian").trim();

  if (!query) {
    return res
      .status(400)
      .json({ success: false, error: "food name parameter is required" });
  }

  try {
    const result = await fetchFoodImage(query, category, cuisine);
    res.json({
      success: true,
      imageUrl: result.imageUrl,
      thumbnail: result.imageUrl,
      foodName: result.foodName || query,
      photographer: result.photographer || "Food Saver Verified Photography",
      photographerProfile: result.photographerProfile || "https://unsplash.com",
      source: result.source || "Unsplash Food Photography",
      alternatives: result.alternatives || [],
    });
  } catch (error) {
    res.json({
      success: false,
      foodName: query,
      imageUrl: "",
      thumbnail: "",
      photographer: "Food Saver",
      source: "no_image",
      alternatives: [],
      error: error.message,
    });
  }
});

module.exports = router;
