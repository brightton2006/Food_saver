const { pool } = require("../config/database");

/**
 * getUserOrders
 * Retrieves orders placed by the authenticated customer.
 */
async function getUserOrders({ userId, limit = 5 }) {
  if (!userId || userId === "guest") {
    return {
      authenticated: false,
      message: "Please log in to your FoodSaver account to check your order history.",
      orders: [],
    };
  }

  const [rows] = await pool.query(
    `SELECT c.claim_id, c.claim_token, c.quantity, c.unit_price, c.price_paid, c.status,
            c.claimed_at, c.collected_at,
            l.listing_id, l.item_name, l.address as pickup_address, l.pickup_window_start, l.pickup_window_end,
            h.hotel_id, h.hotel_name, h.contact_number as merchant_phone
     FROM claims c
     JOIN listings l ON c.listing_id = l.listing_id
     JOIN hotels h ON l.hotel_id = h.hotel_id
     WHERE c.customer_user_id = ?
     ORDER BY c.claimed_at DESC
     LIMIT ?`,
    [userId, Math.min(Number(limit) || 5, 10)]
  );

  return {
    authenticated: true,
    count: rows.length,
    orders: rows.map((r) => ({
      orderId: r.claim_id,
      claimToken: r.claim_token,
      itemName: r.item_name,
      quantity: r.quantity,
      pricePaid: Number(r.price_paid),
      status: r.status,
      merchantName: r.hotel_name,
      pickupAddress: r.pickup_address,
      merchantPhone: r.merchant_phone,
      pickupWindow: `${String(r.pickup_window_start).slice(0, 5)} - ${String(r.pickup_window_end).slice(0, 5)}`,
      claimedAt: r.claimed_at,
    })),
  };
}

/**
 * getOrderStatus
 * Checks status of a specific order or the most recent active order for the authenticated customer.
 */
async function getOrderStatus({ userId, orderId = null, claimToken = null }) {
  if (!userId || userId === "guest") {
    return {
      authenticated: false,
      message: "Please log in to your account so I can look up your active order.",
    };
  }

  let sql = `
    SELECT c.claim_id, c.claim_token, c.quantity, c.unit_price, c.price_paid, c.status,
           c.claimed_at, c.collected_at,
           l.listing_id, l.item_name, l.address as pickup_address, l.pickup_window_start, l.pickup_window_end,
           h.hotel_id, h.hotel_name, h.contact_number as merchant_phone
    FROM claims c
    JOIN listings l ON c.listing_id = l.listing_id
    JOIN hotels h ON l.hotel_id = h.hotel_id
    WHERE c.customer_user_id = ?
  `;
  const params = [userId];

  if (orderId) {
    sql += ` AND (c.claim_id = ? OR c.claim_token = ?)`;
    params.push(orderId, orderId);
  } else if (claimToken) {
    sql += ` AND c.claim_token = ?`;
    params.push(claimToken);
  } else {
    // Return latest active order first, else latest order
    sql += ` ORDER BY (c.status IN ('ORDER_PLACED', 'ORDER_CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'CUSTOMER_ON_THE_WAY', 'pending')) DESC, c.claimed_at DESC`;
  }

  sql += ` LIMIT 1`;

  const [rows] = await pool.query(sql, params);

  if (rows.length === 0) {
    return {
      authenticated: true,
      found: false,
      message: "You have no active orders on FoodSaver right now. Would you like to discover available surplus food near you?",
    };
  }

  const r = rows[0];

  let humanStatus = "Confirmed";
  let statusEmoji = "🟢";
  let nextAction = "Visit the merchant counter during the pickup window.";

  switch (r.status) {
    case "ORDER_PLACED":
    case "pending":
      humanStatus = "Order Placed (Waiting for restaurant confirmation)";
      statusEmoji = "⏳";
      nextAction = "The restaurant is reviewing your order.";
      break;
    case "ORDER_CONFIRMED":
      humanStatus = "Confirmed by Restaurant";
      statusEmoji = "🟢";
      nextAction = "Merchant is preparing your food bundle.";
      break;
    case "PREPARING":
      humanStatus = "Food is being prepared";
      statusEmoji = "🍳";
      nextAction = "Almost ready for packaging.";
      break;
    case "READY_FOR_PICKUP":
      humanStatus = "Ready for Pickup at Counter";
      statusEmoji = "📦";
      nextAction = `Head to ${r.hotel_name} and show your Claim Token #${r.claim_token}.`;
      break;
    case "CUSTOMER_ON_THE_WAY":
      humanStatus = "You are on the way";
      statusEmoji = "🚶";
      nextAction = "Show your digital token at the counter when you arrive.";
      break;
    case "PICKED_UP":
    case "COMPLETED":
    case "collected":
      humanStatus = "Completed / Picked Up";
      statusEmoji = "✅";
      nextAction = "Meal rescued successfully! Thank you for reducing food waste.";
      break;
    case "CANCELLED":
      humanStatus = "Cancelled";
      statusEmoji = "❌";
      nextAction = "This order was cancelled.";
      break;
  }

  return {
    authenticated: true,
    found: true,
    orderId: r.claim_id,
    claimToken: r.claim_token,
    status: r.status,
    humanStatus,
    statusEmoji,
    nextAction,
    item: r.item_name,
    quantity: r.quantity,
    amountPaid: Number(r.price_paid),
    merchant: r.hotel_name,
    pickupAddress: r.pickup_address,
    pickupWindow: `${String(r.pickup_window_start).slice(0, 5)} - ${String(r.pickup_window_end).slice(0, 5)}`,
    merchantPhone: r.merchant_phone,
    claimedAt: r.claimed_at,
  };
}

/**
 * cancelOrder
 * Controlled order cancellation respecting business rules.
 */
async function cancelOrder({ userId, orderId, reason = "Customer request" }) {
  if (!userId || userId === "guest") {
    return {
      success: false,
      error: "UNAUTHORIZED",
      message: "Please log in to cancel an order.",
    };
  }

  if (!orderId) {
    return {
      success: false,
      error: "MISSING_ORDER_ID",
      message: "Please specify the order ID or claim token you wish to cancel.",
    };
  }

  const [orders] = await pool.query(
    `SELECT c.claim_id, c.status, c.quantity, c.listing_id
     FROM claims c
     WHERE (c.claim_id = ? OR c.claim_token = ?) AND c.customer_user_id = ?
     LIMIT 1`,
    [orderId, orderId, userId]
  );

  if (orders.length === 0) {
    return {
      success: false,
      error: "ORDER_NOT_FOUND",
      message: `No order found with ID #${orderId} under your account.`,
    };
  }

  const order = orders[0];

  // Business rule: Only ORDER_PLACED or pending orders can be cancelled automatically
  const cancellableStatuses = ["ORDER_PLACED", "pending"];
  if (!cancellableStatuses.includes(order.status)) {
    return {
      success: false,
      error: "CANNOT_CANCEL",
      message: `Order #${order.claim_id} is already ${order.status} and cannot be cancelled automatically. Please contact the merchant directly.`,
    };
  }

  // Update order status to CANCELLED and restore quantity
  await pool.query(
    `UPDATE claims SET status = 'CANCELLED' WHERE claim_id = ?`,
    [order.claim_id]
  );

  await pool.query(
    `UPDATE listings SET quantity_available = quantity_available + ? WHERE listing_id = ?`,
    [order.quantity, order.listing_id]
  );

  return {
    success: true,
    message: `Order #${order.claim_id} has been cancelled successfully. Any payment hold will be released.`,
    orderId: order.claim_id,
  };
}

/**
 * getFoodSaverHelp
 * Authoritative system knowledge about FoodSaver operations.
 */
function getFoodSaverHelp(topic = "general") {
  const guides = {
    general: "FoodSaver is an urban surplus food rescue platform connecting local restaurants, bakeries, and cafes with nearby customers and NGOs to purchase freshly prepared surplus food at 30% - 70% discount.",
    how_it_works: "1. Discover nearby restaurants posting surplus food batches. 2. Reserve your meal bundle in the app. 3. Receive a digital Claim Token. 4. Pick up your fresh food at the merchant counter before closing time.",
    claim: "To claim food on FoodSaver: 1. Browse nearby surplus deals on the feed or map. 2. Tap 'Claim Now' or add items to your cart. 3. Select your payment method. 4. You will instantly receive a digital Claim Token (e.g., #FS-1234) and pickup window. 5. Show this token at the counter to collect your meal!",
    pickup: "All FoodSaver orders are self-pickup from the restaurant counter. Simply arrive during the designated pickup window shown on your order, and show your digital Claim Token (e.g., #FS-1234).",
    payment: "FoodSaver supports UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Cash on Pickup at the restaurant counter.",
    merchant: "Restaurants and bakeries can join FoodSaver by clicking Partner Onboarding. Complete the 8-step wizard with your FSSAI license to start listing surplus meals and earn extra revenue.",
    ngo: "Unsold food approaching closing deadlines is automatically rerouted for NGO rescue. Registered non-profit organizations can claim free batches to distribute to community shelters.",
    safety: "FoodSaver only lists freshly prepared, wholesome meals from certified kitchens—never expired or leftover food. Each item displays a strict pickup deadline.",
  };

  const cleanTopic = String(topic).toLowerCase().replace(/[^a-z_]/g, "");
  return guides[cleanTopic] || guides.general;
}

module.exports = {
  getUserOrders,
  getOrderStatus,
  cancelOrder,
  getFoodSaverHelp,
};
