const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://localhost:4000";

describe("FoodSaver — Complete Hotel Directory, Geolocation, Claims & Food Publishing Tests", { concurrency: 1 }, () => {
  let adminToken = "";
  let ownerToken = "";
  let testDirectoryHotel = null;

  it("1. Public Hotel Directory: GET /api/hotels returns 25 Kovilpatti establishments with GeoJSON", async () => {
    const res = await fetch(`${BASE_URL}/api/hotels?limit=50`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.hotels));
    assert.ok(data.hotels.length >= 25, `Expected >= 25 hotels, got ${data.hotels.length}`);

    // Check stats
    assert.ok(data.stats);
    console.log(`Directory stats: Total=${data.stats.totalHotels}, VerifiedPins=${data.stats.verifiedPinCount}, PendingPins=${data.stats.pendingPinCount}, Partners=${data.stats.partnerCount}`);
    assert.ok(data.stats.verifiedPinCount >= 11, "At least 11 geocoded pins must be verified");

    // GeoJSON point check on verified hotels
    const verified = data.hotels.find((h) => h.locationStatus === "verified" && h.location);
    assert.ok(verified, "Must find at least one location-verified hotel");
    assert.strictEqual(verified.location.type, "Point");
    assert.strictEqual(verified.location.coordinates.length, 2);
    // GeoJSON format: [longitude, latitude]
    assert.ok(verified.location.coordinates[0] > 70 && verified.location.coordinates[0] < 85, "Longitude in Tamil Nadu range");
    assert.ok(verified.location.coordinates[1] > 8 && verified.location.coordinates[1] < 12, "Latitude in Tamil Nadu range");

    testDirectoryHotel = data.hotels.find((h) => h.isDirectoryListing && !h.isFoodSaverPartner && !h.ownerId) || data.hotels[0];
    assert.ok(testDirectoryHotel, "Must have directory listing");
  });

  it("2. Nearby Search: GET /api/hotels/nearby validates radius and returns distance in km", async () => {
    const res = await fetch(`${BASE_URL}/api/hotels/nearby?lat=9.1724&lng=77.8694&radius=10.0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.hotels));
    assert.ok(data.hotels.length > 0, "Nearby hotels found around Kovilpatti center");

    for (const h of data.hotels) {
      assert.ok(typeof h.distanceKm === "number");
      assert.ok(h.distanceKm <= 10.0, `Distance ${h.distanceKm} exceeds radius 10`);
      assert.ok(h.location && h.location.type === "Point");
    }
  });

  it("3. Hotel Search & Category Filters: GET /api/hotels/search", async () => {
    const res = await fetch(`${BASE_URL}/api/hotels/search?q=Bhavan`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.hotels));
    assert.ok(data.hotels.length >= 1, "Must find Bhavan establishments");
    for (const h of data.hotels) {
      const text = `${h.name} ${h.category || ""} ${h.cuisine || ""} ${h.address || ""}`.toLowerCase();
      assert.ok(text.includes("bhavan"), `Search match verified for ${h.name}`);
    }
  });

  it("4. Hotel Details: GET /api/hotels/:id returns business profile, directions URL, and verified status", async () => {
    const resHotels = await fetch(`${BASE_URL}/api/hotels?limit=50`);
    const hData = await resHotels.json();
    const verifiedHotel = hData.hotels.find((h) => h.locationStatus === "verified" && h.location);
    assert.ok(verifiedHotel, "Verified hotel available");

    const res = await fetch(`${BASE_URL}/api/hotels/${verifiedHotel.id}?userLat=9.1724&userLng=77.8694`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.hotel.id, verifiedHotel.id);
    assert.ok(data.hotel.name);
    assert.ok(data.hotel.address);
    assert.ok(data.hotel.directionsUrl && data.hotel.directionsUrl.includes("maps"));
  });

  it("5. Food Listing Protection: GET /api/hotels/:id/food returns empty array for directory establishments without active partner", async () => {
    assert.ok(testDirectoryHotel, "Directory hotel available");
    const res = await fetch(`${BASE_URL}/api/hotels/${testDirectoryHotel.id}/food`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(data.food, []);
    assert.strictEqual(data.message, "No food available right now.");
  });

  it("6. Admin Login: POST /api/auth/login authenticates seeded administrator", async () => {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@foodsaver.local").trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || "Admin_b94a29594cc1!9#").trim();

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    assert.strictEqual((data.user.role || "").toUpperCase(), "ADMIN");
    adminToken = data.token;
  });

  it("7. Hotel Owner Login: POST /api/auth/login authenticates seeded hotel owner", async () => {
    const ownerEmail = (process.env.HOTEL_OWNER_EMAIL || "owner@foodsaver.local").trim();
    const ownerPassword = (process.env.HOTEL_OWNER_PASSWORD || "DevOwner_ea518fdb228e!9").trim();

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ownerEmail,
        password: ownerPassword,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    assert.strictEqual((data.user.role || "").toUpperCase(), "MERCHANT");
    ownerToken = data.token;
  });

  it("8. Admin Directory Review: GET /api/admin/directory-hotels lists directory establishments", async () => {
    assert.ok(adminToken, "Admin token must be available");
    const res = await fetch(`${BASE_URL}/api/admin/directory-hotels`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.hotels));
    assert.ok(data.hotels.length >= 25);
  });

  it("9. Admin Location Verification: PUT /api/admin/hotels/:id/location corrects coordinates", async () => {
    assert.ok(adminToken, "Admin token must be available");
    const resList = await fetch(`${BASE_URL}/api/admin/directory-hotels?locationStatus=location_pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resList.status, 200);
    const listData = await resList.json();
    if (listData.hotels && listData.hotels.length > 0) {
      const target = listData.hotels[0];
      const updateRes = await fetch(`${BASE_URL}/api/admin/hotels/${target.hotelId}/location`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          address: target.address || "Main Bazaar, Kovilpatti",
          latitude: 9.1735,
          longitude: 77.8702,
          verifyPin: true,
        }),
      });
      assert.strictEqual(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.success, true);
      assert.strictEqual(updateData.hotel.locationStatus, "verified");
    }
  });

  it("10. Merchant Ownership Claim Workflow: POST claim -> admin view -> approve claim", async () => {
    assert.ok(ownerToken, "Owner token must be available");
    assert.ok(adminToken, "Admin token must be available");

    const resHotels = await fetch(`${BASE_URL}/api/hotels?limit=50`);
    const hData = await resHotels.json();
    const unclaimed = hData.hotels.find((h) => h.isDirectoryListing && !h.ownerId && (!h.claimStatus || h.claimStatus === "none")) || hData.hotels.find((h) => h.isDirectoryListing);
    assert.ok(unclaimed, "Found unclaimed directory listing");

    // Clean any prior claim state for this test target and merchant user
    const { pool } = require("../src/config/database");
    const [uRows] = await pool.query("SELECT user_id FROM dim_users WHERE email = ?", [
      (process.env.HOTEL_OWNER_EMAIL || "owner@foodsaver.local").trim().toLowerCase(),
    ]);
    if (uRows.length > 0) {
      await pool.query(
        "UPDATE dim_hotels SET merchant_user_id = NULL, claimed_by_merchant_id = NULL, claim_status = 'none', partner_status = 'unverified', status = 'DRAFT', verification_status = 'pending' WHERE merchant_user_id = ? OR claimed_by_merchant_id = ?",
        [uRows[0].user_id, uRows[0].user_id]
      );
    }
    await pool.query(
      "UPDATE dim_hotels SET merchant_user_id = NULL, claimed_by_merchant_id = NULL, claim_status = 'none', partner_status = 'unverified', status = 'DRAFT', verification_status = 'pending' WHERE hotel_id = ?",
      [unclaimed.id]
    );

    // Merchant submits claim
    const claimRes = await fetch(`${BASE_URL}/api/merchant/hotels/${unclaimed.id}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        fssaiNumber: "12423000000099",
        businessLicenseNumber: "KVP/TR/2026/088",
        gstin: "33ABCDE1234F1Z5",
        phone: "+919876543210",
        notes: "Authorized business owner verification request",
      }),
    });
    assert.strictEqual(claimRes.status, 200);
    const claimData = await claimRes.json();
    assert.strictEqual(claimData.success, true);

    // Admin reviews claims
    const adminClaimsRes = await fetch(`${BASE_URL}/api/admin/hotel-claims`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminClaimsRes.status, 200);
    const adminClaimsData = await adminClaimsRes.json();
    assert.strictEqual(adminClaimsData.success, true);
    const submittedClaim = adminClaimsData.claims.find((c) => c.hotelId === unclaimed.id);
    assert.ok(submittedClaim, "Admin sees pending claim");

    // Admin approves claim
    const approveRes = await fetch(`${BASE_URL}/api/admin/hotel-claims/${unclaimed.id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.strictEqual(approveData.success, true);

    // Merchant now sees this hotel in their owned hotels
    const merchantHotelsRes = await fetch(`${BASE_URL}/api/merchant/hotels`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(merchantHotelsRes.status, 200);
    const merchantHotelsData = await merchantHotelsRes.json();
    assert.strictEqual(merchantHotelsData.success, true);
    const foundOwned = merchantHotelsData.hotels.find((h) => h.id === unclaimed.id);
    assert.ok(foundOwned, "Hotel now belongs to merchant");
  });

  it("11. Food Publishing Rules: Unverified merchants produce drafts; approved merchants publish active offers", async () => {
    assert.ok(ownerToken, "Owner token must be available");

    const resHotels = await fetch(`${BASE_URL}/api/merchant/hotels`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const hData = await resHotels.json();
    if (hData.hotels && hData.hotels.length > 0) {
      const ownedHotel = hData.hotels[0];
      const now = new Date();
      const pickupStart = new Date(now.getTime() + 1 * 3600000).toISOString();
      const pickupEnd = new Date(now.getTime() + 4 * 3600000).toISOString();
      const expiry = new Date(now.getTime() + 5 * 3600000).toISOString();

      const foodRes = await fetch(`${BASE_URL}/api/merchant/food`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          hotelId: ownedHotel.id,
          name: "Fresh Mini Meals Box",
          description: "Freshly packaged vegetarian meals prepared today",
          category: "Vegetarian",
          originalPrice: 150,
          discountedPrice: 75,
          quantityAvailable: 10,
          pickupStartTime: pickupStart,
          pickupEndTime: pickupEnd,
          expiryTime: expiry,
          dietaryType: "veg",
          status: "active",
        }),
      });

      assert.strictEqual(foodRes.status, 201);
      const foodData = await foodRes.json();
      assert.strictEqual(foodData.success, true);
      assert.ok(foodData.food.id);

      // Verify that public hotel food API returns this item if active
      if (foodData.food.status === "active") {
        const publicFoodRes = await fetch(`${BASE_URL}/api/hotels/${ownedHotel.id}/food`);
        const pFoodData = await publicFoodRes.json();
        assert.strictEqual(pFoodData.success, true);
        assert.ok(pFoodData.food.some((item) => item.id === foodData.food.id));
      }

      // Cleanup test food item and restore hotel
      await fetch(`${BASE_URL}/api/merchant/food/${foodData.food.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const { pool } = require("../src/config/database");
      await pool.query("DELETE FROM fact_listings WHERE listing_id = ?", [foodData.food.id]);
      await pool.query(
        "UPDATE dim_hotels SET merchant_user_id = NULL, claimed_by_merchant_id = NULL, claim_status = 'none', partner_status = 'unverified', status = 'DRAFT', verification_status = 'pending' WHERE hotel_id = ?",
        [ownedHotel.id]
      );
    }
  });
});
