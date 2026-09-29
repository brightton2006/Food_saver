const assert = require("assert");
const store = require("../src/data/store");
const { pool } = require("../src/config/database");

async function runTests() {
  console.log("=== RUNNING TOKEN VERIFICATION & ORDER COMPLETION TEST SUITE ===");

  try {
    // 1. Create unique test merchant, hotel, listing and claim
    const testId = Date.now();
    const merchantUserId = `merchant_test_${testId}`;
    const otherMerchantUserId = `other_merchant_${testId}`;
    const customerUserId = `customer_test_${testId}`;
    const hotelId = `h_test_${testId}`;
    const listingId = `l_test_${testId}`;
    const claimId = `claim_test_${testId}`;
    const pickupToken = `FS-TEST-${Math.floor(100000 + Math.random() * 900000)}`;

    console.log(`Setting up test data: Token=${pickupToken}, ClaimID=${claimId}...`);

    // Insert merchant user
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, status)
       VALUES (?, 'merchant', ?, 'hash', 'Test Restaurant Kitchen', 'APPROVED')`,
      [merchantUserId, `test_kitchen_${testId}@foodsaver.local`]
    );

    // Insert other merchant user
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, status)
       VALUES (?, 'merchant', ?, 'hash', 'Other Restaurant Kitchen', 'APPROVED')`,
      [otherMerchantUserId, `other_kitchen_${testId}@foodsaver.local`]
    );

    // Insert customer user
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, status)
       VALUES (?, 'customer', ?, 'hash', 'Test Customer', 'ACTIVE')`,
      [customerUserId, `customer_${testId}@foodsaver.local`]
    );

    // Insert hotel
    await pool.query(
      `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, latitude, longitude, verification_status, status)
       VALUES (?, ?, 'Test Cafe Deluxe', '123 Test Street', '9876543210', 9.1724, 77.8694, 'approved', 'APPROVED')`,
      [hotelId, merchantUserId]
    );

    // Insert listing
    await pool.query(
      `INSERT INTO fact_listings (listing_id, hotel_id, item_name, address, original_price, discount_price, quantity_available, quantity_total, pickup_window_start, pickup_window_end, status, expires_at)
       VALUES (?, ?, 'Test Sambar Rice Meal', '123 Test Street', 150.00, 49.00, 5, 5, '18:00', '22:00', 'active', NOW() + INTERVAL 2 HOUR)`,
      [listingId, hotelId]
    );

    // Insert claim order in READY_FOR_PICKUP state
    await pool.query(
      `INSERT INTO fact_claims (claim_id, listing_id, customer_user_id, quantity, status, claim_token, price_paid, claimed_at)
       VALUES (?, ?, ?, 2, 'READY_FOR_PICKUP', ?, 98.00, NOW())`,
      [claimId, listingId, customerUserId, pickupToken]
    );

    console.log("✓ Test records successfully created.");

    // TEST 1: CORE RULE - Direct handover/delivered attempt WITHOUT token verification MUST FAIL
    console.log("\n[TEST 1] Core Rule: Attempting direct completion without token verification...");
    const directCompleteAttempt = await store.completeOrderHandover(claimId, merchantUserId);
    assert.strictEqual(
      directCompleteAttempt.error,
      "token_verification_required",
      "Should block completion if token has not been verified"
    );
    console.log("✓ Core Rule enforced: Direct handover blocked with 'token_verification_required'.");

    // Also verify markCollected is blocked
    const directCollectAttempt = await store.markCollected(pickupToken, merchantUserId);
    assert.strictEqual(
      directCollectAttempt.error,
      "token_verification_required",
      "markCollected should also enforce token verification"
    );
    console.log("✓ markCollected blocked with 'token_verification_required'.");

    // TEST 2: Attempt verification with invalid token
    console.log("\n[TEST 2] Invalid Token validation...");
    const invalidVerif = await store.verifyPickupToken({
      token: "FS-WRONG-9999",
      merchantUserId,
    });
    assert.strictEqual(invalidVerif.error, "invalid_token");
    console.log("✓ Invalid token rejected with 'invalid_token'.");

    // TEST 3: Cross-merchant security - other merchant cannot verify this order
    console.log("\n[TEST 3] Merchant Authorization Check: Unauthorized merchant verification attempt...");
    const crossMerchantVerif = await store.verifyPickupToken({
      token: pickupToken,
      merchantUserId: otherMerchantUserId,
    });
    assert.strictEqual(
      crossMerchantVerif.error,
      "forbidden",
      "Other merchant cannot verify this order"
    );
    console.log("✓ Unauthorized merchant blocked with 'forbidden'.");

    // TEST 4: Successful Token Verification (Method: QR or TOKEN)
    console.log("\n[TEST 4] Successful Token Verification...");
    const validVerif = await store.verifyPickupToken({
      token: pickupToken,
      orderId: claimId,
      merchantUserId,
      method: "QR",
    });
    assert.strictEqual(validVerif.ok, true);
    assert.strictEqual(validVerif.verified, true);
    assert.strictEqual(validVerif.order.status, "TOKEN_VERIFIED");
    console.log(`✓ Verification successful: Order #${validVerif.order.token} status transitioned to TOKEN_VERIFIED.`);

    // Check DB row has verified audit data
    const [auditRows] = await pool.query(
      `SELECT status, verified_at, verified_by, verification_method FROM fact_claims WHERE claim_id = ?`,
      [claimId]
    );
    assert.strictEqual(auditRows[0].status, "TOKEN_VERIFIED");
    assert.ok(auditRows[0].verified_at, "verified_at timestamp must be recorded");
    assert.strictEqual(auditRows[0].verification_method, "QR", "verification_method must be recorded");
    console.log("✓ DB audit check passed: verified_at, verified_by, and method recorded in fact_claims.");

    // TEST 5: Complete Order Handover AFTER verification
    console.log("\n[TEST 5] Order Handover Completion (after verification)...");
    const handoverRes = await store.completeOrderHandover(claimId, merchantUserId);
    assert.strictEqual(handoverRes.ok, true);
    assert.strictEqual(handoverRes.completed, true);
    assert.strictEqual(handoverRes.order.status, "PICKED_UP");
    console.log("✓ Handover completed: Status transitioned to PICKED_UP.");

    // Check DB row has collected_at timestamp
    const [finalRows] = await pool.query(
      `SELECT status, collected_at FROM fact_claims WHERE claim_id = ?`,
      [claimId]
    );
    assert.strictEqual(finalRows[0].status, "PICKED_UP");
    assert.ok(finalRows[0].collected_at, "collected_at timestamp must be set");
    console.log("✓ DB final check passed: collected_at timestamp recorded.");

    // TEST 6: Prevent duplicate token reuse / already used token check
    console.log("\n[TEST 6] Already Used Token Protection...");
    const reusedVerif = await store.verifyPickupToken({
      token: pickupToken,
      merchantUserId,
    });
    assert.strictEqual(reusedVerif.error, "already_used");
    console.log("✓ Duplicate verification rejected with 'already_used'.");

    const duplicateComplete = await store.completeOrderHandover(claimId, merchantUserId);
    assert.strictEqual(duplicateComplete.alreadyCompleted, true);
    console.log("✓ Duplicate completion blocked safely.");

    console.log("\n=======================================================");
    console.log("ALL TOKEN VERIFICATION & ORDER COMPLETION TESTS PASSED!");
    console.log("=======================================================\n");

    // Clean up test data
    await pool.query(`DELETE FROM fact_order_status_history WHERE claim_id = ?`, [claimId]);
    await pool.query(`DELETE FROM fact_claims WHERE claim_id = ?`, [claimId]);
    await pool.query(`DELETE FROM fact_listings WHERE listing_id = ?`, [listingId]);
    await pool.query(`DELETE FROM dim_hotels WHERE hotel_id = ?`, [hotelId]);
    await pool.query(`DELETE FROM dim_users WHERE user_id IN (?, ?, ?)`, [
      merchantUserId,
      otherMerchantUserId,
      customerUserId,
    ]);
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runTests();
