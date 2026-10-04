const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");
const { io: Client } = require("../../frontend/node_modules/socket.io-client");
const jwt = require("jsonwebtoken");

const { pool, testConnection } = require("../src/config/database");
const { initializeDatabase } = require("../src/database/initDb");
const store = require("../src/data/store");
const setupOrderSockets = require("../src/sockets/orderSocket");

const JWT_SECRET = process.env.JWT_SECRET || "foodsaver_merchant_secret_key_2026";
const TEST_PORT = 4099;
const API_BASE = `http://localhost:${TEST_PORT}`;

let server;
let io;

test.before(async () => {
  await testConnection();
  await initializeDatabase();

  const app = express();
  app.use(express.json());
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: "*" } });

  setupOrderSockets(io);

  await new Promise((resolve) => {
    server.listen(TEST_PORT, resolve);
  });
});

test.after(async () => {
  if (io) io.close();
  if (server) server.close();
});

test("Real-Time Order Tracking Full System Integration Test", async (t) => {
  try {
    // 1. Seed test merchant & active listing
  const merchantId = `mkt_test_track_${Date.now()}`;
  const hotelId = `htl_test_track_${Date.now()}`;
  const listingId = `lst_test_track_${Date.now()}`;
  const customerId = `usr_test_cust_${Date.now()}`;

  const merchantToken = jwt.sign(
    { userId: merchantId, email: "merchant_test@foodsaver.com", role: "merchant" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const customerToken = jwt.sign(
    { userId: customerId, email: "customer_test@foodsaver.com", role: "customer" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Insert merchant user and hotel
  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active)
     VALUES (?, 'merchant', ?, 'hash', 'Test Merchant', '+91 99999 11111', TRUE)`,
    [merchantId, `${merchantId}@foodsaver.com`]
  );

  // Insert customer user
  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active)
     VALUES (?, 'customer', ?, 'hash', 'Test Customer', '+91 99999 22222', TRUE)`,
    [customerId, `${customerId}@foodsaver.com`]
  );

  await pool.query(
    `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, verification_status)
     VALUES (?, ?, 'Test Tracking Hotel', '123 Main St, Kovilpatti', '+91 99999 11111', 'approved')`,
    [hotelId, merchantId]
  );

  // Create active listing
  const expiresAt = new Date(Date.now() + 3600000);
  await pool.query(
    `INSERT INTO fact_listings (listing_id, hotel_id, item_name, description, original_price, discount_price, quantity_total, quantity_available, address, latitude, longitude, pickup_window_start, pickup_window_end, status, expires_at)
     VALUES (?, ?, 'Special Biryani', 'Fresh surplus biryani', 200, 150, 10, 10, '123 Main St', 9.1724, 77.8694, '12:00:00', '22:00:00', 'active', ?)`,
    [listingId, hotelId, expiresAt]
  );

  // 2. Customer places food order
  const claimRes = await store.claimListing(listingId, {
    customerId,
    customerName: "Test Customer",
    customerUsername: "test_customer",
    quantity: 1,
  });

  assert.ok(claimRes.claim, "Order/Claim should be created successfully");
  const orderId = claimRes.claim.id;
  assert.equal(claimRes.claim.status.toUpperCase(), "PENDING", "Initial status should be PENDING");
  assert.equal(Boolean(claimRes.claim.trackingActive), false, "Live tracking should NOT be active initially");

  // 3. Merchant confirms order via API
  const confirmRes = await store.confirmOrder(orderId, merchantId);
  assert.ok(confirmRes.ok, "Confirm order should succeed");
  assert.equal(confirmRes.order.status, "CONFIRMED", "Order status should be CONFIRMED");

  // 4. Merchant starts delivery
  const startRes = await store.startOrderDelivery(orderId, merchantId);
  assert.ok(startRes.ok, "Start delivery should succeed");
  assert.equal(startRes.order.status, "OUT_FOR_DELIVERY", "Status should be OUT_FOR_DELIVERY");
  assert.equal(startRes.order.trackingActive, true, "Tracking active should be TRUE");

  // 5. Connect Socket.IO clients for Merchant and Customer
  const merchantSocket = Client(API_BASE, { auth: { token: merchantToken } });
  const customerSocket = Client(API_BASE, { auth: { token: customerToken } });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Customer & Merchant join tracking room
  customerSocket.emit("customer:join-tracking", { orderId });
  merchantSocket.emit("merchant:join-tracking", { orderId });

  await new Promise((resolve) => setTimeout(resolve, 300));

  // 6. Test location update streaming via Socket.IO
  const locationPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for tracking:location-update")), 5000);
    customerSocket.on("tracking:location-update", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  const testLat = 9.1735;
  const testLng = 77.8705;

  merchantSocket.emit("merchant:location-update", {
    orderId,
    merchantId,
    latitude: testLat,
    longitude: testLng,
    accuracy: 12,
    timestamp: Date.now(),
  });

  const locationData = await locationPromise;
  assert.equal(locationData.orderId, orderId, "Location update should match orderId");
  assert.equal(locationData.latitude, testLat, "Latitude should match transmitted coordinate");
  assert.equal(locationData.longitude, testLng, "Longitude should match transmitted coordinate");

  // Verify database record updated
  const trackingState = await store.getOrderTrackingState(orderId);
  assert.equal(trackingState.merchantLocation.latitude, testLat, "DB last_latitude should be updated");

  // 7. Verify token & Merchant marks order as DELIVERED
  const stoppedPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for tracking:stopped")), 5000);
    customerSocket.on("tracking:stopped", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  if (claimRes.claim?.token) {
    await store.verifyPickupToken({ token: claimRes.claim.token, merchantUserId: merchantId });
  }

  const deliveredRes = await store.markOrderDelivered(orderId, merchantId);
  assert.ok(deliveredRes.ok, "Mark delivered should succeed");
  assert.equal(deliveredRes.order.status, "PICKED_UP", "Order status should be PICKED_UP");
  assert.equal(deliveredRes.order.trackingActive, false, "Tracking active should be FALSE");

  // Broadcast stopped event via server room
  io.to(`order_tracking_${orderId}`).emit("tracking:stopped", { orderId, trackingActive: false, reason: "DELIVERED" });

  const stopData = await stoppedPromise;
  assert.equal(stopData.orderId, orderId, "Stop tracking event orderId should match");

  // 8. Server-side Protection: attempt location update AFTER delivery
  const rejectRes = await store.updateOrderTrackingLocation(orderId, merchantId, {
    latitude: 9.1790,
    longitude: 77.8800,
  });

  assert.ok(rejectRes.error, "Backend MUST reject location updates for DELIVERED order");
  assert.equal(rejectRes.error, "tracking_ended", "Error code should be tracking_ended");

  // Cleanup socket connections
  merchantSocket.disconnect();
  customerSocket.disconnect();
  } catch (err) {
    console.error("❌ TEST FAILURE DETAILS:", err);
    throw err;
  }
});
