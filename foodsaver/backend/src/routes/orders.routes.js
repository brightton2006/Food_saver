const express = require("express");
const store = require("../data/store");
const { verifyToken } = require("./auth");

module.exports = function createOrdersRouter(io) {
  const router = express.Router();

  function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.body?.token || req.query?.token;

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ error: "Authentication token required.", code: "NO_TOKEN" });
    }

    const payload = verifyToken(token);
    const userId = payload?.userId || payload?.id;
    if (!payload || !userId) {
      return res.status(401).json({ error: "Invalid or expired token.", code: "INVALID_TOKEN" });
    }

    req.user = {
      userId,
      email: payload.email,
      role: (payload.role || "customer").toLowerCase(),
    };
    next();
  }

  // POST /api/orders/:orderId/confirm — Merchant confirms food reservation
  router.post("/:orderId/confirm", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const merchantUserId = req.user.userId;

      const result = await store.confirmOrder(orderId, merchantUserId);
      if (result.error) {
        const code = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return res.status(code).json({ error: result.error, message: result.message });
      }

      return res.json({
        ok: true,
        message: "Order confirmed successfully.",
        order: result.order,
      });
    } catch (err) {
      console.error("Error confirming order:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  // POST /api/orders/verify-pickup — Merchant verifies customer token or QR code
  router.post("/verify-pickup", requireAuth, async (req, res) => {
    try {
      const { token, orderId, method = "TOKEN" } = req.body;
      const merchantUserId = req.user.userId;

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

      if (io) {
        io.emit("order:token_verified", {
          orderId: result.order?.id,
          token: result.order?.token,
          status: "TOKEN_VERIFIED",
          order: result.order,
        });
        io.emit("claim:updated", result.order);
      }

      return res.json({
        ok: true,
        verified: true,
        order: result.order,
        message: result.message || "✓ Pickup Verified: Customer verified successfully.",
      });
    } catch (err) {
      console.error("Error in verify-pickup:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  // POST /api/orders/:orderId/verify-pickup
  router.post("/:orderId/verify-pickup", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { token, method = "TOKEN" } = req.body;
      const merchantUserId = req.user.userId;

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

      if (io) {
        io.emit("order:token_verified", {
          orderId: result.order?.id,
          token: result.order?.token,
          status: "TOKEN_VERIFIED",
          order: result.order,
        });
        io.emit("claim:updated", result.order);
      }

      return res.json({
        ok: true,
        verified: true,
        order: result.order,
        message: result.message || "✓ Pickup Verified: Customer verified successfully.",
      });
    } catch (err) {
      console.error("Error in verify-pickup for order:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  // POST /api/orders/:orderId/handover — Merchant confirms physical handover AFTER verification
  router.post("/:orderId/handover", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const merchantUserId = req.user.userId;

      const result = await store.completeOrderHandover(orderId, merchantUserId);
      if (result.error) {
        const code = result.error === "not_found" ? 404 :
                     result.error === "forbidden" ? 403 :
                     result.error === "token_verification_required" ? 400 : 400;
        return res.status(code).json({ error: result.error, message: result.message });
      }

      if (io) {
        io.emit("order:completed", {
          orderId: result.order?.id,
          token: result.order?.token,
          status: "PICKED_UP",
          order: result.order,
        });
        io.emit("claim:collected", result.order);
      }

      return res.json({
        ok: true,
        completed: true,
        message: "Order handover confirmed. Marked as Picked Up / Completed.",
        order: result.order,
      });
    } catch (err) {
      console.error("Error confirming handover:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  // POST /api/orders/:orderId/collected / /delivered — Customer picked up at counter
  router.post("/:orderId/delivered", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const merchantUserId = req.user.userId;

      const result = await store.markOrderDelivered(orderId, merchantUserId);
      if (result.error) {
        const code = result.error === "not_found" ? 404 :
                     result.error === "forbidden" ? 403 :
                     result.error === "token_verification_required" ? 400 : 400;
        return res.status(code).json({ error: result.error, message: result.message });
      }

      if (io) {
        io.emit("order:completed", {
          orderId: result.order?.id,
          token: result.order?.token,
          status: "PICKED_UP",
          order: result.order,
        });
        io.emit("claim:collected", result.order);
      }

      return res.json({
        ok: true,
        message: "Food marked as picked up / completed.",
        order: result.order,
      });
    } catch (err) {
      console.error("Error marking order picked up:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  // POST /api/orders/:orderId/cancel
  router.post("/:orderId/cancel", requireAuth, async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.userId;

      const result = await store.cancelOrder(orderId, userId);
      if (result.error) {
        const code = result.error === "not_found" ? 404 : 400;
        return res.status(code).json({ error: result.error, message: result.message });
      }

      return res.json({
        ok: true,
        message: "Order cancelled.",
        order: result.order,
      });
    } catch (err) {
      console.error("Error cancelling order:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  // GET /api/orders/:orderId
  router.get("/:orderId", async (req, res) => {
    try {
      const order = await store.getOrderDetails(req.params.orderId);
      if (!order) {
        return res.status(404).json({ error: "not_found", message: "Order not found." });
      }
      return res.json({ ok: true, order });
    } catch (err) {
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  });

  return router;
};
