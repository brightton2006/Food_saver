const express = require("express");
const { getMerchantRescueIntelligence, getPlatformRescueIntelligence } = require("../services/rescueIntelligence");
const { verifyToken } = require("./auth");

const router = express.Router();

/**
 * GET /api/intelligence/merchant
 * Merchant-specific intelligent surplus food pricing & NGO recommendations
 */
router.get("/merchant", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.query?.token;
    let merchantUserId = req.query.merchantId;

    if (token) {
      const payload = verifyToken(token);
      if (payload && (payload.userId || payload.id)) {
        merchantUserId = payload.userId || payload.id;
      }
    }

    if (!merchantUserId) {
      return res.status(400).json({ error: "merchantId or Bearer auth token is required." });
    }

    const data = await getMerchantRescueIntelligence(merchantUserId);
    return res.json({ ok: true, intelligence: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/intelligence/merchant/:merchantId
 */
router.get("/merchant/:merchantId", async (req, res) => {
  try {
    const data = await getMerchantRescueIntelligence(req.params.merchantId);
    return res.json({ ok: true, intelligence: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/intelligence/platform
 * Admin platform-wide Food Saved & waste prevention analytics
 */
router.get("/platform", async (req, res) => {
  try {
    const data = await getPlatformRescueIntelligence();
    return res.json({ ok: true, intelligence: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
