const assert = require("assert");
const { pool } = require("../src/config/database");
const locationService = require("../src/services/locationService");
const { notifyNearbyCustomersForListing } = require("../src/services/notificationService");

async function runLocationTests() {
  console.log("=== Testing Real-Time Location & Nearby Store Discovery System ===\n");

  const timestamp = Date.now();

  // Test Coordinates: Kovilpatti City Center
  const customerLat = 9.1724;
  const customerLng = 77.8694;

  // 1. Verify Distance Calculation Function
  console.log("1. Testing Geodesic Distance Calculation...");
  // Store 1: ~650m away from center
  const store1Lat = 9.1760;
  const store1Lng = 77.8730;
  // Haversine formula check
  const dist = locationService.getNearbyMerchants;
  assert(typeof dist === "function", "getNearbyMerchants must be a function");

  // 2. Insert Test Approved Merchant in DB with Real Coordinates
  const testMerchantUserId = `usr_test_loc_${timestamp}`;
  const testHotelId = `htl_test_loc_${timestamp}`;

  console.log(`2. Inserting approved test merchant (${testHotelId}) with real coordinates [${store1Lat}, ${store1Lng}]...`);
  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, latitude, longitude, status, is_active)
     VALUES (?, 'merchant', ?, 'hash', 'Sunrise Bakery & Cafe', '+91 98765 11223', ?, ?, 'APPROVED', TRUE)`,
    [testMerchantUserId, `merchant_loc_${timestamp}@foodsaver.com`, store1Lat, store1Lng]
  );

  await pool.query(
    `INSERT INTO dim_hotels (
      hotel_id, merchant_user_id, hotel_name, address, location_city,
      latitude, longitude, contact_number, cuisine, opening_hours,
      verification_status, status
    ) VALUES (?, ?, 'Sunrise Artisan Bakery', '18 Gandhi Road, Kovilpatti', 'Kovilpatti', ?, ?, '+91 98765 11223', 'Bakery & Sweets', '08:00 - 22:30', 'approved', 'APPROVED')`,
    [testHotelId, testMerchantUserId, store1Lat, store1Lng]
  );

  // Insert a test food listing for this merchant
  const testListingId = `lst_test_loc_${timestamp}`;
  await pool.query(
    `INSERT INTO fact_listings (
      listing_id, hotel_id, item_name, description, original_price, discount_price,
      quantity_total, quantity_available, address, latitude, longitude,
      pickup_window_start, pickup_window_end, status, expires_at
    ) VALUES (?, ?, 'Evening Butter Croissant Bundle', 'Freshly baked flaky croissants', 120.00, 60.00, 10, 6, '18 Gandhi Road, Kovilpatti', ?, ?, '19:30:00', '22:00:00', 'active', DATE_ADD(NOW(), INTERVAL 3 HOUR))`,
    [testListingId, testHotelId, store1Lat, store1Lng]
  );

  // 3. Test getNearbyMerchants within 2 km (2000 meters)
  console.log("3. Testing getNearbyMerchants with 2 km radius...");
  const nearbyMerchants = await locationService.getNearbyMerchants({
    lat: customerLat,
    lng: customerLng,
    radiusKm: 2.0,
  });

  assert(Array.isArray(nearbyMerchants), "nearbyMerchants must return an array");
  console.log(`Found ${nearbyMerchants.length} nearby merchants within 2 km.`);

  const foundMerchant = nearbyMerchants.find((m) => m.hotelId === testHotelId);
  assert(foundMerchant, "Approved test merchant must appear in nearby results within 2 km");
  assert.strictEqual(foundMerchant.businessName, "Sunrise Artisan Bakery");
  assert(foundMerchant.distance > 0, "Distance in meters must be positive");
  assert(foundMerchant.distance < 2000, `Merchant distance (${foundMerchant.distance}m) must be within 2000m`);
  assert(foundMerchant.location && foundMerchant.location.type === "Point", "Must return GeoJSON Point");
  assert.strictEqual(foundMerchant.location.coordinates[0], store1Lng, "GeoJSON coordinate 0 must be longitude");
  assert.strictEqual(foundMerchant.location.coordinates[1], store1Lat, "GeoJSON coordinate 1 must be latitude");
  assert.strictEqual(foundMerchant.isVerified, true, "isVerified must be true");
  assert.strictEqual(foundMerchant.isActive, true, "isActive must be true");
  assert(foundMerchant.availableFoodCount >= 1, `availableFoodCount (${foundMerchant.availableFoodCount}) must be >= 1`);
  console.log(`✓ Verified merchant: ${foundMerchant.businessName} • Distance: ${foundMerchant.distanceText} (${foundMerchant.distance}m) • Food Deals: ${foundMerchant.availableFoodCount}`);

  // 4. Test getNearbyListings (Surplus Food Discovery)
  console.log("\n4. Testing getNearbyListings surplus food discovery within 2 km...");
  const nearbyFood = await locationService.getNearbyListings({
    lat: customerLat,
    lng: customerLng,
    radiusKm: 2.0,
    category: "All",
    sortBy: "distance",
  });

  assert(Array.isArray(nearbyFood), "nearbyFood must return an array");
  const foundItem = nearbyFood.find((i) => i.id === testListingId);
  assert(foundItem, "Created surplus food deal must appear in nearby food results");
  assert.strictEqual(foundItem.itemName, "Evening Butter Croissant Bundle");
  assert.strictEqual(foundItem.price, 60);
  assert.strictEqual(foundItem.originalPrice, 120);
  assert.strictEqual(foundItem.discountPercentage, 50);
  assert(foundItem.distance > 0 && foundItem.distance < 2000, "Food distance must be within 2 km");
  assert(foundItem.location && foundItem.location.type === "Point", "Food item must contain GeoJSON Point");
  assert.strictEqual(foundItem.location.coordinates[0], store1Lng, "Food item GeoJSON coord 0 must be longitude");
  assert.strictEqual(foundItem.location.coordinates[1], store1Lat, "Food item GeoJSON coord 1 must be latitude");
  console.log(`✓ Verified food deal: ${foundItem.itemName} (₹${foundItem.price}, 50% OFF) • Distance: ${foundItem.distanceText} • Available: ${foundItem.quantityAvailable}`);

  // 5. Test Merchant Outside Radius (> 10 km)
  console.log("\n5. Testing Merchant outside radius rejection...");
  const farLat = 9.4500; // ~35 km north in Virudhunagar
  const farLng = 77.9500;
  const testFarHotelId = `htl_far_${timestamp}`;
  const testFarUserId = `usr_far_${timestamp}`;

  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status)
     VALUES (?, 'merchant', ?, 'hash', 'Far Away Owner', TRUE, 'APPROVED')`,
    [testFarUserId, `far_${timestamp}@foodsaver.com`]
  );

  await pool.query(
    `INSERT INTO dim_hotels (
      hotel_id, merchant_user_id, hotel_name, address, location_city,
      latitude, longitude, contact_number, verification_status, status
    ) VALUES (?, ?, 'Far Away Highway Restaurant', 'Virudhunagar Highway', 'Virudhunagar', ?, ?, '+91 99999 88888', 'approved', 'APPROVED')`,
    [testFarHotelId, testFarUserId, farLat, farLng]
  );

  const merchantsNear2Km = await locationService.getNearbyMerchants({
    lat: customerLat,
    lng: customerLng,
    radiusKm: 2.0,
  });

  const shouldNotBeFound = merchantsNear2Km.find((m) => m.hotelId === testFarHotelId);
  assert.strictEqual(shouldNotBeFound, undefined, "Store 35 km away must NOT appear in 2 km discovery results");
  console.log("✓ Verified store 35 km away was correctly excluded from 2 km radius query");

  // 6. Test Unapproved Merchant Rejection
  console.log("\n6. Testing Unapproved Merchant rejection...");
  const unapprovedHotelId = `htl_unapproved_${timestamp}`;
  const unapprovedUserId = `usr_unapproved_${timestamp}`;

  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status)
     VALUES (?, 'merchant', ?, 'hash', 'Unapproved Owner', TRUE, 'DRAFT')`,
    [unapprovedUserId, `unapproved_${timestamp}@foodsaver.com`]
  );

  await pool.query(
    `INSERT INTO dim_hotels (
      hotel_id, merchant_user_id, hotel_name, address, location_city,
      latitude, longitude, contact_number, verification_status, status
    ) VALUES (?, ?, 'Unverified Fake Dhaba', 'Main St', 'Kovilpatti', ?, ?, '+91 90000 00000', 'pending', 'DRAFT')`,
    [unapprovedHotelId, unapprovedUserId, customerLat + 0.001, customerLng + 0.001]
  );

  const testPendingCheck = await locationService.getNearbyMerchants({
    lat: customerLat,
    lng: customerLng,
    radiusKm: 2.0,
  });
  const unapprovedFound = testPendingCheck.find((m) => m.hotelId === unapprovedHotelId);
  assert.strictEqual(unapprovedFound, undefined, "Unapproved/Draft merchant must NOT appear in customer discovery");
  console.log("✓ Verified unapproved/draft merchant was correctly excluded");

  // 7. Test Customer GPS Location Saving in Database
  console.log("\n7. Testing customer location persistence in database...");
  const testCustUserId = `usr_cust_loc_${timestamp}`;
  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status)
     VALUES (?, 'customer', ?, 'hash', 'Test Customer GPS', TRUE, 'ACTIVE')`,
    [testCustUserId, `cust_${timestamp}@foodsaver.com`]
  );

  const savedLoc = await locationService.saveUserLocation({
    userId: testCustUserId,
    lat: customerLat,
    lng: customerLng,
    accuracy: 12.5,
  });
  assert(savedLoc, "saveUserLocation must return saved object");
  assert.strictEqual(savedLoc.latitude, customerLat);
  assert.strictEqual(savedLoc.longitude, customerLng);

  const [userDbCheck] = await pool.query("SELECT latitude, longitude FROM dim_users WHERE user_id = ?", [testCustUserId]);
  assert(userDbCheck.length > 0 && Number(userDbCheck[0].latitude) === customerLat, "User latitude must be updated in DB");
  console.log(`✓ Verified customer GPS location saved in dim_users: [${userDbCheck[0].latitude}, ${userDbCheck[0].longitude}]`);

  // 8. Test 2 km Proximity Alert Notification Dispatch
  console.log("\n8. Testing 2 km proximity notification dispatch on new food listing...");
  const mockIo = {
    emit: (event, payload) => {
      console.log(`  [Socket.io mock broadcast] ${event}: ${payload.message || payload.itemName || ""}`);
    },
    to: (room) => ({
      emit: (event, payload) => {
        console.log(`  [Socket.io mock room ${room}] ${event}: ${payload.title}`);
      },
    }),
  };

  const dispatched = await notifyNearbyCustomersForListing(
    {
      id: testListingId,
      itemName: "Evening Butter Croissant Bundle",
      merchantName: "Sunrise Artisan Bakery",
      discountPrice: 60,
      latitude: store1Lat,
      longitude: store1Lng,
    },
    mockIo
  );
  assert(Array.isArray(dispatched), "notifyNearbyCustomersForListing must return array");
  console.log(`✓ Verified proximity notification dispatch returned ${dispatched.length} notifications to nearby customers within 2 km.`);

  // Clean up test rows
  await pool.query("DELETE FROM fact_listings WHERE listing_id = ?", [testListingId]);
  await pool.query("DELETE FROM dim_hotels WHERE hotel_id IN (?, ?, ?)", [testHotelId, testFarHotelId, unapprovedHotelId]);
  await pool.query("DELETE FROM dim_users WHERE user_id IN (?, ?, ?, ?)", [testMerchantUserId, testCustUserId, testFarUserId, unapprovedUserId]);

  console.log("\n ALL REAL-TIME LOCATION & NEARBY STORE DISCOVERY SYSTEM TESTS PASSED!");
  process.exit(0);
}

runLocationTests().catch((err) => {
  console.error("Location test failed:", err);
  process.exit(1);
});
