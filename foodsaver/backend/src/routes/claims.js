const express = require("express");
const store = require("../data/store");

module.exports = function claimsRouter(io) {
  const router = express.Router();

  // GET /api/claims/merchant/:merchantName — merchant's collection queue
  router.get("/merchant/:merchantName", async (req, res) => {
    try {
      const claims = await store.claimsForMerchant(req.params.merchantName);
      res.json({ claims });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/claims/sales/today/:merchantName — merchant's today sales overview & hourly breakdown
  router.get("/sales/today/:merchantName", async (req, res) => {
    try {
      const data = await store.getTodaySalesForMerchant(req.params.merchantName);
      res.json({ ok: true, salesData: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/claims/admin/metrics — admin platform summary metrics
  router.get("/admin/metrics", async (req, res) => {
    try {
      const data = await store.getAdminMetrics();
      res.json({ ok: true, metrics: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/claims/customer/:customerId — customer's personal order history
  router.get("/customer/:customerId", async (req, res) => {
    try {
      const claims = await store.claimsForCustomer(req.params.customerId);
      res.json({ claims });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/claims/:token — merchant looks up a token at the counter
  router.get("/:token", async (req, res) => {
    try {
      const claim = await store.getClaimByToken(req.params.token.toUpperCase());
      if (!claim) return res.status(404).json({ error: "not_found" });
      res.json({ claim });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/claims/verify-token — merchant verifies customer pickup token
  router.post("/verify-token", async (req, res) => {
    try {
      const { token, orderId, method = "TOKEN", merchantUserId } = req.body;
      if (!token) {
        return res.status(400).json({ error: "missing_token", message: "Pickup token is required." });
      }

      const result = await store.verifyPickupToken({
        token,
        orderId,
        merchantUserId,
        method: method === "QR" ? "QR" : "TOKEN",
      });

      if (result.error) {
        const code = result.error === "not_found" ? 404 :
                     result.error === "forbidden" ? 403 :
                     result.error === "already_used" ? 409 : 400;
        return res.status(code).json({ error: result.error, message: result.message });
      }

      io.emit("claim:updated", result.order);
      io.emit("order:token_verified", {
        orderId: result.order?.id,
        token: result.order?.token,
        status: "TOKEN_VERIFIED",
        order: result.order,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/claims/:token/collect — merchant marks the pickup as completed (ONLY after verification)
  router.post("/:token/collect", async (req, res) => {
    try {
      const result = await store.markCollected(req.params.token.toUpperCase(), req.body?.merchantUserId);
      if (result.error) {
        const code = result.error === "not_found" ? 404 :
                     result.error === "forbidden" ? 403 :
                     result.error === "token_verification_required" ? 400 : 409;
        return res.status(code).json({ error: result.error, message: result.message });
      }
      io.emit("claim:collected", result.order || result.claim);
      io.emit("order:completed", {
        orderId: result.order?.id,
        token: result.order?.token || req.params.token.toUpperCase(),
        status: "PICKED_UP",
        order: result.order,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/claims/:token/reroute-ngo — customer failed to reach counter, reroute food to rescue NGO
  router.post("/:token/reroute-ngo", async (req, res) => {
    try {
      const result = await store.rerouteClaimToNgo(req.params.token.toUpperCase());
      if (result.error) {
        const code = result.error === "not_found" ? 404 : 409;
        return res.status(code).json({ error: result.error });
      }
      io.emit("claim:updated", result.claim);
      io.emit("ngo:notification", result.notification);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
