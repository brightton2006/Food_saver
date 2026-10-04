const nodemailer = require("nodemailer");
const { pool } = require("../config/database");

// Environment Configuration
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || '"FoodSaver" <no-reply@foodsaver.com>';
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

let transporter = null;

/**
 * Initializes or retrieves nodemailer transporter
 */
async function getTransporter() {
  if (transporter) return transporter;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  } else {
    // Development / Fallback Ethereal test transporter
    transporter = nodemailer.createTransport({
      jsonTransport: true, // Safe JSON transport when real SMTP credentials are not yet added in env
    });
  }

  return transporter;
}

/**
 * Checks if a communication event has already been sent (Idempotency)
 */
async function isEventProcessed(eventId) {
  if (!eventId) return false;
  try {
    const [rows] = await pool.query(
      "SELECT status FROM communication_events WHERE event_id = ? AND status = 'SENT'",
      [eventId]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("Error checking communication event idempotency:", err.message);
    return false;
  }
}

/**
 * Records or updates a communication event in the database
 */
async function recordCommunicationEvent({
  eventId,
  eventType,
  referenceId,
  recipient,
  channel = "EMAIL",
  status = "PENDING",
  lastError = null,
  payload = null,
}) {
  if (!eventId) return;
  try {
    await pool.query(
      `INSERT INTO communication_events (event_id, event_type, reference_id, recipient, channel, status, attempts, last_error, payload, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ${status === "SENT" ? "NOW()" : "NULL"})
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         attempts = attempts + 1,
         last_error = VALUES(last_error),
         payload = VALUES(payload),
         sent_at = IF(VALUES(status) = 'SENT', NOW(), sent_at)`,
      [eventId, eventType, referenceId, recipient, channel, status, lastError, JSON.stringify(payload || {})]
    );
  } catch (err) {
    console.error("Error logging communication event:", err.message);
  }
}

/**
 * Generic Mail Sender with Idempotency & Error Handling
 */
async function sendMail({ to, subject, html, text, eventId, eventType, referenceId, payload }) {
  if (!to || !to.includes("@")) {
    console.warn(`[EmailService] Invalid recipient email address: "${to}"`);
    return { success: false, reason: "invalid_email" };
  }

  // 1. Idempotency Check
  if (eventId) {
    const alreadySent = await isEventProcessed(eventId);
    if (alreadySent) {
      console.log(`[EmailService] Duplicate prevention: event "${eventId}" already sent to ${to}. Skipping.`);
      return { success: true, skipped: true, reason: "duplicate_prevented", eventId };
    }
  }

  // Log pending attempt
  if (eventId) {
    await recordCommunicationEvent({
      eventId,
      eventType: eventType || "GENERIC_EMAIL",
      referenceId,
      recipient: to,
      channel: "EMAIL",
      status: "PENDING",
      payload,
    });
  }

  try {
    const mailer = await getTransporter();
    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      text: text || "Please view this message in an HTML-compatible email viewer.",
      html,
    };

    const info = await mailer.sendMail(mailOptions);
    console.log(`📧 [EmailService] Email sent successfully to ${to} [Subject: "${subject}"]`);

    if (eventId) {
      await recordCommunicationEvent({
        eventId,
        eventType: eventType || "GENERIC_EMAIL",
        referenceId,
        recipient: to,
        channel: "EMAIL",
        status: "SENT",
        payload: { ...payload, messageId: info.messageId },
      });
    }

    return { success: true, messageId: info.messageId, eventId };
  } catch (err) {
    console.error(`❌ [EmailService] Failed to send email to ${to}:`, err.message);

    if (eventId) {
      await recordCommunicationEvent({
        eventId,
        eventType: eventType || "GENERIC_EMAIL",
        referenceId,
        recipient: to,
        channel: "EMAIL",
        status: "FAILED",
        lastError: err.message,
        payload,
      });
    }

    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// RESPONSIVE HTML EMAIL TEMPLATES
// -------------------------------------------------------------

function getBaseTemplate({ title, preheader, content }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F4F7F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    .email-container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #DCE6E3; box-shadow: 0 8px 30px rgba(20, 92, 82, 0.08); }
    .header-banner { background: linear-gradient(135deg, #145C52 0%, #16796B 100%); padding: 32px 28px; text-align: center; color: #FFFFFF; }
    .brand-logo-text { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-subtext { font-size: 13px; color: #E8F4F1; margin-top: 4px; font-weight: 500; }
    .content-body { padding: 32px 28px; color: #102A2A; font-size: 15px; line-height: 1.6; }
    .btn-action { display: inline-block; background-color: #145C52; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 10px; margin: 20px 0; text-align: center; }
    .card-box { background-color: #F7FAF9; border: 1px solid #E2EBE8; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .footer { background-color: #F4F7F6; padding: 24px; text-align: center; font-size: 12px; color: #687674; border-top: 1px solid #E2EBE8; }
    .footer a { color: #145C52; text-decoration: none; font-weight: 600; }
    .token-chip { display: inline-block; font-size: 24px; font-weight: 900; letter-spacing: 4px; color: #145C52; background: #E8F4F1; padding: 8px 20px; border-radius: 8px; border: 1.5px dashed #145C52; margin: 10px 0; }
    .impact-badge { background: #FEF9EB; border: 1px solid #F5C451; border-radius: 10px; padding: 14px; color: #B45309; font-weight: 600; margin: 20px 0; display: flex; align-items: center; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || title}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F7F6; padding: 20px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          <!-- Header -->
          <div class="header-banner">
            <h1 class="brand-logo-text">🍱 FoodSaver</h1>
            <div class="brand-subtext">Save Good Food • Save Money • Save The Planet</div>
          </div>
          <!-- Body -->
          <div class="content-body">
            ${content}
          </div>
          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 8px;">You received this transactional email from FoodSaver.</p>
            <p style="margin: 0 0 8px;">FoodSaver Direct Connect • Kovilpatti, Tamil Nadu • <a href="mailto:support@foodsaver.com">support@foodsaver.com</a></p>
            <p style="margin: 0; color: #8A9693;">&copy; ${new Date().getFullYear()} FoodSaver. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 1. Welcome Email
 */
async function sendWelcomeEmail({ to, name, role = "Customer" }) {
  const eventId = `welcome_${to.toLowerCase()}`;
  const html = getBaseTemplate({
    title: `Welcome to FoodSaver, ${name}!`,
    preheader: "Welcome to FoodSaver - Join our community saving surplus food.",
    content: `
      <h2 style="color: #145C52; margin-top: 0;">Welcome aboard, ${name}! 🎉</h2>
      <p>Thank you for joining FoodSaver as a registered <strong>${role}</strong>. Our mission is to connect local food businesses with people and organizations to ensure delicious surplus food is eaten, not wasted.</p>
      
      <div class="card-box">
        <strong style="color: #145C52; font-size: 16px;">What you can do next:</strong>
        <ul style="margin: 10px 0 0; padding-left: 20px; color: #4A5568;">
          <li>Explore hyper-local surplus meals within 2 km of your location.</li>
          <li>Reserve fresh closing deals with discounts up to 70%.</li>
          <li>Collect directly with high-security QR and token verification.</li>
          <li>Track your environmental impact and CO₂ savings in real-time.</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${APP_URL}" class="btn-action">Start Saving Food</a>
      </div>
      
      <p style="color: #687674; font-size: 13px;">If you have any questions, our support team is always ready to assist at <a href="mailto:support@foodsaver.com" style="color: #145C52;">support@foodsaver.com</a>.</p>
    `,
  });

  return sendMail({
    to,
    subject: `Welcome to FoodSaver, ${name}! 🍱`,
    html,
    eventId,
    eventType: "WELCOME_EMAIL",
    payload: { name, role },
  });
}

/**
 * 2. Order Confirmation Email
 */
async function sendOrderConfirmationEmail({
  to,
  customerName,
  orderId,
  token,
  itemName,
  quantity = 1,
  totalAmount = 0,
  merchantName,
  address,
  pickupWindow,
}) {
  const eventId = `order_confirm_${orderId}`;
  const html = getBaseTemplate({
    title: `Order Confirmation #${orderId}`,
    preheader: `Your FoodSaver order for ${itemName} is confirmed! Pickup token: ${token}`,
    content: `
      <h2 style="color: #145C52; margin-top: 0;">Order Confirmed! 🛒</h2>
      <p>Hello <strong>${customerName}</strong>, your reservation has been placed successfully. Please present your verification token or QR code at the counter for collection.</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <div style="font-size: 13px; color: #687674; text-transform: uppercase; font-weight: 700;">Your Pickup Token</div>
        <div class="token-chip">${token}</div>
        <div style="font-size: 12px; color: #8A9693;">Show this code to the merchant upon arrival</div>
      </div>

      <div class="card-box">
        <table width="100%" cellspacing="0" cellpadding="6" style="border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="color: #687674;">Order ID:</td>
            <td align="right" style="font-weight: 700; color: #102A2A;">#${orderId}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Item:</td>
            <td align="right" style="font-weight: 700; color: #102A2A;">${itemName} (${quantity} portions)</td>
          </tr>
          <tr>
            <td style="color: #687674;">Merchant Partner:</td>
            <td align="right" style="font-weight: 700; color: #102A2A;">${merchantName}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Pickup Location:</td>
            <td align="right" style="color: #102A2A;">${address || "Kovilpatti, Tamil Nadu"}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Pickup Window Ends:</td>
            <td align="right" style="font-weight: 700; color: #C2410C;">${pickupWindow || "Today"}</td>
          </tr>
          <tr style="border-top: 1px solid #DCE6E3;">
            <td style="font-weight: 800; font-size: 16px; color: #145C52; padding-top: 12px;">Total Paid / Payable:</td>
            <td align="right" style="font-weight: 800; font-size: 16px; color: #145C52; padding-top: 12px;">₹${Number(totalAmount).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${APP_URL}/customer/pickups" class="btn-action">Track & View Token</a>
      </div>
    `,
  });

  return sendMail({
    to,
    subject: `Order Confirmed: ${itemName} (#${orderId}) - FoodSaver`,
    html,
    eventId,
    eventType: "ORDER_CONFIRMATION",
    referenceId: orderId,
    payload: { orderId, token, itemName, totalAmount, merchantName },
  });
}

/**
 * 3. Order Status Update Email (Preparing, Ready for Pickup, etc.)
 */
async function sendOrderStatusUpdateEmail({
  to,
  customerName,
  orderId,
  token,
  status,
  merchantName,
  itemName,
}) {
  const eventId = `status_${orderId}_${status.toLowerCase()}`;
  
  const statusLabels = {
    CONFIRMED: "Confirmed by Merchant",
    PREPARING: "Being Prepared",
    READY_FOR_PICKUP: "Ready for Pickup!",
    OUT_FOR_DELIVERY: "Out for Delivery",
  };
  const displayStatus = statusLabels[status] || status;

  const html = getBaseTemplate({
    title: `Order Update: ${displayStatus}`,
    preheader: `Your order #${orderId} is now ${displayStatus}.`,
    content: `
      <h2 style="color: #145C52; margin-top: 0;">Order Status Update 🔔</h2>
      <p>Hello <strong>${customerName}</strong>, your order from <strong>${merchantName}</strong> has a new update:</p>

      <div style="text-align: center; margin: 20px 0;">
        <span style="background: #E8F4F1; color: #145C52; font-size: 16px; font-weight: 800; padding: 10px 24px; border-radius: 30px; border: 1.5px solid #145C52;">
          ${displayStatus}
        </span>
      </div>

      <div class="card-box">
        <table width="100%" cellspacing="0" cellpadding="4" style="font-size: 14px;">
          <tr>
            <td style="color: #687674;">Order ID:</td>
            <td align="right" style="font-weight: 700;">#${orderId}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Item:</td>
            <td align="right" style="font-weight: 700;">${itemName}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Verification Token:</td>
            <td align="right" style="font-weight: 900; color: #145C52;">${token}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${APP_URL}/customer/pickups" class="btn-action">View Live Status</a>
      </div>
    `,
  });

  return sendMail({
    to,
    subject: `Order #${orderId} is ${displayStatus} - FoodSaver`,
    html,
    eventId,
    eventType: "ORDER_STATUS_UPDATE",
    referenceId: orderId,
    payload: { orderId, status },
  });
}

/**
 * 4. Professional Delivery / Collection Success Email
 * IMMEDIATELY after merchant or authorized delivery workflow confirms order delivered/collected.
 * Contains:
 * - FoodSaver branding and logo
 * - Customer's name and order ID
 * - Ordered food items and order summary
 * - Merchant name and pickup or delivery details
 * - Confirmed delivery date and time
 * - Payment status and receipt information
 * - Professional thank-you message explaining food waste reduction
 * - Link to view order details and contact support
 * - Idempotency control: deliv_email_${orderId}
 */
async function sendDeliverySuccessEmail({
  to,
  customerName = "Valued Customer",
  orderId,
  token,
  items = [],
  itemName = "Surplus Food Pack",
  quantity = 1,
  totalAmount = 0,
  merchantName = "Partner Merchant",
  address = "Store Counter Pickup",
  deliveredAt = new Date(),
  paymentMethod = "Digital / Pre-paid",
  paymentStatus = "Paid",
}) {
  const eventId = `deliv_email_${orderId}`;

  // Calculate environmental waste reduction metrics (~2.5 kg CO2 avoided per kg surplus meal)
  const portions = Math.max(1, Number(quantity) || 1);
  const estimatedKgSaved = (portions * 0.45).toFixed(1);
  const co2AvoidedKg = (estimatedKgSaved * 2.5).toFixed(1);

  const formattedDate = new Date(deliveredAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const html = getBaseTemplate({
    title: `Delivered: Your FoodSaver Order #${orderId}`,
    preheader: `Thank you for saving food! Your order from ${merchantName} has been successfully completed.`,
    content: `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="display: inline-block; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; background: #E8F5F0; font-size: 32px;">
          ✅
        </span>
        <h2 style="color: #145C52; margin: 12px 0 4px;">Order Delivered & Verified!</h2>
        <p style="color: #687674; margin: 0; font-size: 14px;">Receipt #${orderId} • Confirmed at ${formattedDate}</p>
      </div>

      <p>Dear <strong>${customerName}</strong>,</p>
      <p>Your order from <strong>${merchantName}</strong> has been successfully handed over and marked as completed at the pickup counter.</p>

      <!-- Impact Card -->
      <div class="card-box" style="background: linear-gradient(135deg, #E8F5F0 0%, #D4ECE4 100%); border: 1.5px solid #145C52;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 28px;">🌱</div>
          <div>
            <strong style="color: #145C52; font-size: 15px; display: block;">You are a Food-Saving Hero!</strong>
            <span style="color: #2D3B37; font-size: 13px; line-height: 1.4; display: block; margin-top: 2px;">
              By rescuing this meal, you prevented approximately <strong>${estimatedKgSaved} kg of food</strong> from going to waste and avoided <strong>${co2AvoidedKg} kg of CO₂ emissions</strong>. Thank you for making a positive difference for our planet!
            </span>
          </div>
        </div>
      </div>

      <!-- Order Details Table -->
      <div class="card-box">
        <h3 style="color: #145C52; font-size: 15px; margin: 0 0 12px; border-bottom: 1px solid #DCE6E3; padding-bottom: 8px;">
          🧾 Order Summary & Receipt
        </h3>
        <table width="100%" cellspacing="0" cellpadding="6" style="border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="color: #687674;">Order ID:</td>
            <td align="right" style="font-weight: 700; color: #102A2A;">#${orderId}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Claim Token:</td>
            <td align="right" style="font-weight: 800; color: #145C52;">${token || "VERIFIED"}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Food Item:</td>
            <td align="right" style="font-weight: 700; color: #102A2A;">${itemName} &times; ${portions}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Merchant Partner:</td>
            <td align="right" style="font-weight: 700; color: #102A2A;">${merchantName}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Handover Location:</td>
            <td align="right" style="color: #102A2A;">${address}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Completed Date & Time:</td>
            <td align="right" style="color: #102A2A;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Payment Method:</td>
            <td align="right" style="color: #102A2A;">${paymentMethod}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Payment Status:</td>
            <td align="right" style="font-weight: 700; color: #16A34A;">✓ ${paymentStatus}</td>
          </tr>
          <tr style="border-top: 1.5px solid #DCE6E3;">
            <td style="font-weight: 800; font-size: 16px; color: #145C52; padding-top: 12px;">Total Paid:</td>
            <td align="right" style="font-weight: 800; font-size: 16px; color: #145C52; padding-top: 12px;">₹${Number(totalAmount).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}/customer/pickups" class="btn-action">View Order History</a>
      </div>

      <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 10px; padding: 14px; text-align: center; font-size: 12.5px; color: #64748B;">
        Need help or have feedback about this pickup? We're here for you:
        <br />
        <a href="mailto:support@foodsaver.com" style="color: #145C52; font-weight: 700; text-decoration: underline;">Contact FoodSaver Support</a>
      </div>
    `,
  });

  return sendMail({
    to,
    subject: `Order Delivered: ${itemName} (#${orderId}) - Thank You for Saving Food! 🌱`,
    html,
    eventId,
    eventType: "ORDER_DELIVERY_SUCCESS",
    referenceId: orderId,
    payload: {
      orderId,
      token,
      itemName,
      quantity: portions,
      totalAmount,
      merchantName,
      deliveredAt: formattedDate,
    },
  });
}

/**
 * 5. Payment Confirmation Email
 */
async function sendPaymentConfirmationEmail({
  to,
  customerName,
  orderId,
  amount,
  paymentMethod = "UPI",
  transactionId = "",
}) {
  const eventId = `payment_${orderId}_${transactionId || "tx"}`;
  const html = getBaseTemplate({
    title: `Payment Receipt #${orderId}`,
    preheader: `Payment of ₹${Number(amount).toFixed(2)} confirmed for order #${orderId}.`,
    content: `
      <h2 style="color: #145C52; margin-top: 0;">Payment Received! 💳</h2>
      <p>Hello <strong>${customerName}</strong>, we have verified and confirmed your payment.</p>

      <div class="card-box">
        <table width="100%" cellspacing="0" cellpadding="6" style="font-size: 14px;">
          <tr>
            <td style="color: #687674;">Order ID:</td>
            <td align="right" style="font-weight: 700;">#${orderId}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Amount Paid:</td>
            <td align="right" style="font-weight: 800; color: #145C52; font-size: 16px;">₹${Number(amount).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #687674;">Payment Method:</td>
            <td align="right" style="font-weight: 600;">${paymentMethod}</td>
          </tr>
          ${transactionId ? `
          <tr>
            <td style="color: #687674;">Transaction Reference:</td>
            <td align="right" style="font-family: monospace;">${transactionId}</td>
          </tr>` : ""}
          <tr>
            <td style="color: #687674;">Status:</td>
            <td align="right" style="font-weight: 800; color: #16A34A;">✓ Verified & Captured</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${APP_URL}/customer/pickups" class="btn-action">View Order Details</a>
      </div>
    `,
  });

  return sendMail({
    to,
    subject: `Payment Confirmed: ₹${Number(amount).toFixed(2)} for Order #${orderId} - FoodSaver`,
    html,
    eventId,
    eventType: "PAYMENT_CONFIRMATION",
    referenceId: orderId,
    payload: { orderId, amount, paymentMethod, transactionId },
  });
}

/**
 * 6. Cancellation / Refund Status Email
 */
async function sendCancellationRefundEmail({
  to,
  customerName,
  orderId,
  reason = "Customer cancelled",
  refundStatus = "Initiated",
  refundAmount = 0,
}) {
  const eventId = `cancel_${orderId}`;
  const html = getBaseTemplate({
    title: `Order #${orderId} Cancelled`,
    preheader: `Your order #${orderId} has been cancelled.`,
    content: `
      <h2 style="color: #D9534F; margin-top: 0;">Order Cancelled</h2>
      <p>Hello <strong>${customerName}</strong>, your order #${orderId} has been cancelled.</p>

      <div class="card-box">
        <p style="margin: 0 0 8px;"><strong>Reason:</strong> ${reason}</p>
        ${refundAmount > 0 ? `
          <p style="margin: 0 0 8px;"><strong>Refund Status:</strong> ${refundStatus}</p>
          <p style="margin: 0; color: #145C52; font-weight: 700;"><strong>Refund Amount:</strong> ₹${Number(refundAmount).toFixed(2)}</p>
        ` : ""}
      </div>

      <p style="font-size: 13px; color: #687674;">Refunds are processed back to the original source within 3-5 business days depending on your banking provider.</p>
    `,
  });

  return sendMail({
    to,
    subject: `Order #${orderId} Cancelled - FoodSaver`,
    html,
    eventId,
    eventType: "ORDER_CANCELLED",
    referenceId: orderId,
    payload: { orderId, reason, refundAmount },
  });
}

/**
 * 7. Merchant Onboarding & Verification Status Email
 */
async function sendMerchantOnboardingStatusEmail({
  to,
  merchantName,
  status, // "APPROVED", "REJECTED", "SUBMITTED"
  reason = "",
}) {
  const eventId = `onboarding_${to.toLowerCase()}_${status.toLowerCase()}`;
  const isApproved = status.toUpperCase() === "APPROVED";
  const isRejected = status.toUpperCase() === "REJECTED";

  const title = isApproved
    ? "Partner Verification Approved! 🎉"
    : isRejected
    ? "Action Required: Partner Verification Update"
    : "Application Submitted for Review";

  const html = getBaseTemplate({
    title,
    preheader: `Your FoodSaver partner onboarding status is now ${status}.`,
    content: `
      <h2 style="color: ${isApproved ? "#145C52" : isRejected ? "#D9534F" : "#145C52"}; margin-top: 0;">
        ${title}
      </h2>
      <p>Hello <strong>${merchantName}</strong>,</p>

      ${isApproved ? `
        <p>Congratulations! Your business documents and partner profile have been reviewed and approved by the FoodSaver Administration team.</p>
        <div class="card-box" style="background: #E8F5F0; border-color: #145C52;">
          <strong style="color: #145C52;">You can now:</strong>
          <ul style="margin: 8px 0 0; padding-left: 20px;">
            <li>Publish daily surplus food deals.</li>
            <li>Accept customer digital reservations and counter collections.</li>
            <li>Reroute unsold inventory to verified NGO rescue partners.</li>
          </ul>
        </div>
        <div style="text-align: center;">
          <a href="${APP_URL}/merchant" class="btn-action">Access Merchant Dashboard</a>
        </div>
      ` : isRejected ? `
        <p>Thank you for submitting your documents. Our administration team has reviewed your application and noted an issue:</p>
        <div class="card-box" style="background: #FFF5F5; border-color: #FEB2B2; color: #9B2C2C;">
          <strong>Feedback / Reason:</strong>
          <p style="margin: 6px 0 0;">${reason || "Please ensure your FSSAI license or business registration document is clearly readable and valid."}</p>
        </div>
        <div style="text-align: center;">
          <a href="${APP_URL}/login" class="btn-action" style="background-color: #C53030;">Resubmit Documents</a>
        </div>
      ` : `
        <p>We have safely received your partner application and documents. Our compliance team verifies partners within 24 business hours.</p>
      `}
    `,
  });

  return sendMail({
    to,
    subject: `${title} - FoodSaver`,
    html,
    eventId,
    eventType: "MERCHANT_ONBOARDING_STATUS",
    payload: { merchantName, status, reason },
  });
}

/**
 * 8. OTP & Security Email
 */
async function sendOtpEmail({ to, name, otp, expiryMinutes = 5 }) {
  const eventId = `otp_${to.toLowerCase()}_${Date.now()}`;
  const html = getBaseTemplate({
    title: `Your Security Verification Code: ${otp}`,
    preheader: `Use code ${otp} to verify your FoodSaver account. Expires in ${expiryMinutes} minutes.`,
    content: `
      <h2 style="color: #145C52; margin-top: 0;">Account Verification Code 🔒</h2>
      <p>Hello <strong>${name || "User"}</strong>, you requested a one-time verification code for your FoodSaver account.</p>

      <div style="text-align: center; margin: 24px 0;">
        <div class="token-chip" style="font-size: 28px; padding: 12px 28px;">${otp}</div>
        <div style="color: #C2410C; font-size: 13px; font-weight: 700; margin-top: 8px;">
          Expires in ${expiryMinutes} minutes • Never share this code with anyone
        </div>
      </div>

      <p style="color: #687674; font-size: 13px;">If you did not initiate this request, please change your password immediately or contact <a href="mailto:support@foodsaver.com">support@foodsaver.com</a>.</p>
    `,
  });

  return sendMail({
    to,
    subject: `${otp} is your FoodSaver verification code`,
    html,
    eventId,
    eventType: "SECURITY_OTP_EMAIL",
    payload: { expiryMinutes },
  });
}

module.exports = {
  sendMail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendDeliverySuccessEmail,
  sendPaymentConfirmationEmail,
  sendCancellationRefundEmail,
  sendMerchantOnboardingStatusEmail,
  sendOtpEmail,
  isEventProcessed,
  recordCommunicationEvent,
};
