const express = require("express");
const { createRazorpayOrder, verifyPaymentSignature, RAZORPAY_KEY_ID } = require("../services/razorpayService");
const router = express.Router();

/**
 * POST /api/payments/create-order
 * Creates Razorpay order in test mode or live mode
 */
router.post("/create-order", async (req, res) => {
  try {
    const { amount, receipt } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount for payment." });
    }

    const receiptId = receipt || "rcpt_" + Date.now();
    const orderData = await createRazorpayOrder(amount, receiptId);

    return res.json({
      success: true,
      order: orderData,
      key_id: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("❌ Error creating payment order:", err);
    return res.status(500).json({ error: "Failed to initialize payment gateway order." });
  }
});

/**
 * POST /api/payments/verify
 * Verifies payment signature and returns success status
 */
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (isValid) {
      return res.json({
        success: true,
        message: "Payment verified successfully.",
        payment_id: razorpay_payment_id,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature.",
      });
    }
  } catch (err) {
    console.error("❌ Payment verification error:", err);
    return res.status(500).json({ error: "Payment verification failed." });
  }
});

module.exports = router;
