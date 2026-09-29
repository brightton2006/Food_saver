const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { pool } = require("../src/config/database");

const API_PORT = 4000;

function makePost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      `http://localhost:${API_PORT}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

describe("Merchant Verification Enforcement Tests", () => {
  const testUnverifiedMerchant = "test_unverified_merchant_qa";
  const testApprovedMerchant = "test_approved_merchant_qa";
  const testRejectedMerchant = "test_rejected_merchant_qa";

  before(async () => {
    try {
      await pool.query("DELETE FROM fact_claims WHERE listing_id IN (SELECT listing_id FROM fact_listings WHERE hotel_id LIKE 'htl_%_qa')").catch(() => {});
      await pool.query("DELETE FROM fact_listings WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM dim_verification_applications WHERE business_name LIKE 'test_%'").catch(() => {});
      await pool.query("DELETE FROM merchant_documents WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM merchant_settlement WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM merchant_approvals WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM dim_hotels WHERE hotel_name LIKE 'test_%' OR hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM dim_users WHERE user_id LIKE 'test_%'").catch(() => {});

      // 1. Pending Unverified Merchant
      await pool.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
         VALUES (?, 'merchant', ?, 'hash', 'Unverified Merchant', '+91 99999 00001', TRUE, 'PENDING')`,
        [testUnverifiedMerchant, `${testUnverifiedMerchant}@test.com`]
      );
      await pool.query(
        `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, description, address, contact_number, status, verification_status)
         VALUES ('htl_unverified_qa', ?, ?, 'Test Hotel', 'Kovilpatti', '+91 98765 00001', 'DRAFT', 'pending')`,
        [testUnverifiedMerchant, testUnverifiedMerchant]
      );

      // 2. Approved Merchant
      await pool.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
         VALUES (?, 'merchant', ?, 'hash', 'Approved Merchant', '+91 99999 00002', TRUE, 'APPROVED')`,
        [testApprovedMerchant, `${testApprovedMerchant}@test.com`]
      );
      await pool.query(
        `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, description, address, contact_number, status, verification_status)
         VALUES ('htl_approved_qa', ?, ?, 'Approved Test Hotel', 'Kovilpatti', '+91 98765 00002', 'APPROVED', 'approved')`,
        [testApprovedMerchant, testApprovedMerchant]
      );

      // 3. Rejected Merchant
      await pool.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
         VALUES (?, 'merchant', ?, 'hash', 'Rejected Merchant', '+91 99999 00003', TRUE, 'REJECTED')`,
        [testRejectedMerchant, `${testRejectedMerchant}@test.com`]
      );
      await pool.query(
        `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, description, address, contact_number, status, verification_status)
         VALUES ('htl_rejected_qa', ?, ?, 'Rejected Test Hotel', 'Kovilpatti', '+91 98765 00003', 'REJECTED', 'rejected')`,
        [testRejectedMerchant, testRejectedMerchant]
      );
    } catch (err) {
      console.error("Before Hook Error in Merchant Verification Tests:", err);
      throw err;
    }
  });

  after(async () => {
    try {
      await pool.query("DELETE FROM fact_claims WHERE listing_id IN (SELECT listing_id FROM fact_listings WHERE hotel_id LIKE 'htl_%_qa')").catch(() => {});
      await pool.query("DELETE FROM fact_listings WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM dim_verification_applications WHERE business_name LIKE 'test_%'").catch(() => {});
      await pool.query("DELETE FROM merchant_documents WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM merchant_settlement WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM merchant_approvals WHERE hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM dim_hotels WHERE hotel_name LIKE 'test_%' OR hotel_id LIKE 'htl_%_qa'").catch(() => {});
      await pool.query("DELETE FROM dim_users WHERE user_id LIKE 'test_%'").catch(() => {});
    } catch (e) {}
  });

  it("Test A: Unverified merchant listing creation MUST return HTTP 403 Forbidden", async () => {
    const res = await makePost("/api/listings", {
      merchantName: testUnverifiedMerchant,
      itemName: "Unverified Surplus Meal",
      quantityTotal: 5,
      originalPrice: 100,
      discountPrice: 40,
    });

    console.log("TEST A RESPONSE:", JSON.stringify(res));

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(
      res.body.message,
      "Merchant verification is required before you can sell food on FoodSaver."
    );
  });

  it("Test B: Approved merchant listing creation MUST return HTTP 201 Created", async () => {
    const res = await makePost("/api/listings", {
      merchantName: testApprovedMerchant,
      hotelId: "htl_approved_qa",
      itemName: "Approved Surplus Meal",
      quantityTotal: 5,
      originalPrice: 100,
      discountPrice: 40,
    });

    console.log("TEST B RESPONSE:", JSON.stringify(res));

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.listing);
    assert.strictEqual(res.body.listing.itemName, "Approved Surplus Meal");
  });

  it("Test C: Rejected merchant listing creation MUST return HTTP 403 Forbidden", async () => {
    const res = await makePost("/api/listings", {
      merchantName: testRejectedMerchant,
      itemName: "Rejected Surplus Meal",
      quantityTotal: 5,
      originalPrice: 100,
      discountPrice: 40,
    });

    console.log("TEST C RESPONSE:", JSON.stringify(res));

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(
      res.body.message,
      "Merchant verification is required before you can sell food on FoodSaver."
    );
  });
});
