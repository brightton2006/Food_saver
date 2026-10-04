const QRCode = require("qrcode");
const { nanoid } = require("nanoid");

/**
 * Generates a human-readable 6-character pickup token format: FS-XXXXXX
 */
function generatePickupToken() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "FS-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates DataURL representation of QR code for claim/order token
 */
async function generateQRCodeDataUrl(token, orderDetails = {}) {
  try {
    const payload = JSON.stringify({
      token,
      order_id: orderDetails.order_id || orderDetails.claim_id,
      hotel_id: orderDetails.hotel_id,
      timestamp: Date.now(),
    });
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      color: {
        dark: "#1e293b",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("❌ Failed to generate QR Code DataURL:", err);
    return null;
  }
}

module.exports = {
  generatePickupToken,
  generateQRCodeDataUrl,
};
