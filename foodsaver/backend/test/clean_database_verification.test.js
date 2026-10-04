const assert = require("assert");
const http = require("http");
const { pool } = require("../src/config/database");
const store = require("../src/data/store");

async function runCleanVerification() {
  console.log("==================================================");
  console.log("🧪 VERIFYING CLEAN APPLICATION & AUTHENTIC DB STATE");
  console.log("==================================================\n");

  // 1. Verify Users & Hotels
  const [users] = await pool.query("SELECT user_id, email, role_id, full_name, phone_number FROM dim_users");
  console.log(`✅ 1. Dim_users contains only genuine accounts (${users.length}):`);
  console.table(users);
  assert.strictEqual(users.length, 5, "Expected exactly 5 preserved genuine accounts");

  // Verify none have dummy emails
  for (const u of users) {
    assert(!u.email.includes("foodsaver.local"), `Found test email: ${u.email}`);
    assert(!u.user_id.includes("test"), `Found test user ID: ${u.user_id}`);
  }

  // 2. Verify Hotels
  const [hotels] = await pool.query("SELECT hotel_id, hotel_name, merchant_user_id, status FROM dim_hotels");
  console.log(`✅ 2. Dim_hotels contains only genuine hotels (${hotels.length}):`);
  console.table(hotels);
  assert.strictEqual(hotels.length, 2, "Expected exactly 2 preserved genuine hotels");

  // 3. Verify Clean Fact Tables
  const [listingsCount] = await pool.query("SELECT COUNT(*) as cnt FROM fact_listings");
  assert.strictEqual(listingsCount[0].cnt, 0, "fact_listings should have 0 records");

  const [claimsCount] = await pool.query("SELECT COUNT(*) as cnt FROM fact_claims");
  assert.strictEqual(claimsCount[0].cnt, 0, "fact_claims should have 0 records");

  const [donationsCount] = await pool.query("SELECT COUNT(*) as cnt FROM fact_donations");
  assert.strictEqual(donationsCount[0].cnt, 0, "fact_donations should have 0 records");
  console.log("✅ 3. All fact tables (listings, claims, donations) are verified 100% clean.");

  // 4. Test Customer Feed & Listings API
  const activeListings = await store.listActiveListings();
  assert.strictEqual(activeListings.length, 0, "listActiveListings should return empty array");
  console.log("✅ 4. Customer feed queries return clean empty state without crashing.");

  // 5. Test Merchant Today Sales
  const sales = await store.getTodaySalesForMerchant("Aarthi Hotel");
  assert.strictEqual(sales.todaySales, 0, "Today sales should be 0");
  assert.strictEqual(sales.todayOrders, 0, "Today orders should be 0");
  assert.deepStrictEqual(sales.hourlySales, [], "Hourly sales should be empty array");
  console.log("✅ 5. Merchant Dashboard sales & metrics handle clean zero-state gracefully.");

  // 6. Test Admin Metrics
  const adminMetrics = await store.getAdminMetrics();
  assert.strictEqual(adminMetrics.totalListings, 0);
  assert.strictEqual(adminMetrics.totalOrders, 0);
  assert.strictEqual(adminMetrics.totalMerchants, 2);
  console.log("✅ 6. Admin metrics reflect authentic database state (2 verified merchants, 0 ghost orders).");

  // 7. Test Lifecycle: Create Listing -> Claim -> Counter Pickup -> Complete
  console.log("🔹 7. Testing real CRUD lifecycle on clean database...");
  const merchantHotel = hotels.find((h) => h.hotel_name === "Aarthi Hotel");
  const customerUser = users.find((u) => u.email === "mercy@gmail.com");

  const newListing = await store.createListing({
    merchantName: "Aarthi Hotel",
    itemName: "Fresh Ghee Pongal",
    originalPrice: 90,
    discountPrice: 45,
    quantity: 3,
    address: "14 Kovilpatti Main Road",
    latitude: 9.1724,
    longitude: 77.8694,
    category: "South Indian",
    pickupWindowStart: "19:00",
    pickupWindowEnd: "21:30",
  });
  assert(newListing && newListing.id, "Listing should be created");
  console.log(`   - Created genuine listing: "${newListing.itemName}" (ID: ${newListing.id})`);

  // Verify listing shows in active listings
  const feedAfterCreate = await store.listActiveListings();
  assert.strictEqual(feedAfterCreate.length, 1);
  assert.strictEqual(feedAfterCreate[0].itemName, "Fresh Ghee Pongal");

  // Customer claims 1 portion
  const claimResult = await store.claimListing(newListing.id, {
    customerId: customerUser.user_id,
    customerName: customerUser.full_name,
    quantity: 1,
    method: "customer_pickup",
  });
  const claim = claimResult.claim;
  assert(claim && claim.token, "Claim should return a claim token");
  console.log(`   - Customer placed claim: Token ${claim.token}`);

  // Merchant verifies counter token
  const verifyResult = await store.verifyPickupToken({
    token: claim.token,
    merchantUserId: merchantHotel.merchant_user_id,
  });
  assert(verifyResult && verifyResult.ok, "Pickup token should verify successfully");
  console.log(`   - Counter token verified successfully.`);

  // Merchant completes handover
  const handoverResult = await store.completeOrderHandover(claim.id, merchantHotel.merchant_user_id);
  assert(handoverResult && handoverResult.ok, "Handover should complete successfully");
  console.log(`   - Handover completed and marked PICKED_UP.`);

  // Verify Today Sales updated with actual genuine order
  const salesAfter = await store.getTodaySalesForMerchant("Aarthi Hotel");
  assert.strictEqual(salesAfter.todaySales, 45);
  assert.strictEqual(salesAfter.todayOrders, 1);
  console.log(`   - Merchant Today Sales updated accurately to ₹${salesAfter.todaySales} (1 order).`);

  // Clean the verification lifecycle test listing and claim to leave DB in pristine zero state
  await pool.query("DELETE FROM fact_claims WHERE claim_id = ?", [claim.id]);
  await pool.query("DELETE FROM fact_listings WHERE listing_id = ?", [newListing.id]);
  console.log("   - Verification lifecycle completed and test entry cleaned.");

  // Final check
  const [finalListings] = await pool.query("SELECT COUNT(*) as cnt FROM fact_listings");
  const [finalClaims] = await pool.query("SELECT COUNT(*) as cnt FROM fact_claims");
  assert.strictEqual(finalListings[0].cnt, 0);
  assert.strictEqual(finalClaims[0].cnt, 0);

  console.log("\n==================================================");
  console.log("🎉 ALL SYSTEM & AUTHENTIC STATE VERIFICATIONS PASSED!");
  console.log("==================================================\n");
}

if (require.main === module) {
  runCleanVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Verification failed:", err);
      process.exit(1);
    });
}

module.exports = { runCleanVerification };
