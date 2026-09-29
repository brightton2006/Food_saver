const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { pool } = require("../src/config/database");
const store = require("../src/data/store");

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

describe("Inventory Concurrency & Price Security Tests", () => {
  let createdListingId = null;
  const testMerchantId = "mkt_concurrency_qa";

  before(async () => {
    try {
      await pool.query("DELETE FROM hotels WHERE hotel_id = 'htl_concurrency_qa'");
      await pool.query("DELETE FROM users WHERE user_id = ?", [testMerchantId]);

      // Create merchant & approved hotel
      await pool.query(
        `INSERT INTO users (user_id, role_id, email, password_hash, full_name, phone_number, is_active)
         VALUES (?, 'merchant', ?, 'hash', 'Concurrency Merchant', '+91 99999 00004', TRUE)`,
        [testMerchantId, `${testMerchantId}@test.com`]
      );
      await pool.query(
        `INSERT INTO hotels (hotel_id, merchant_user_id, hotel_name, description, address, contact_number, verification_status)
         VALUES ('htl_concurrency_qa', ?, 'Concurrency Merchant', 'Test Hotel', '123 Main Rd, Kovilpatti', '+91 98765 00004', 'approved')`,
        [testMerchantId]
      );

      // Create listing via store with EXACTLY 1 item available
      const created = await store.createListing({
        merchantName: "Concurrency Merchant",
        hotelId: "htl_concurrency_qa",
        itemName: "Exclusive Special Thali",
        description: "Limited 1 left",
        originalPrice: 200,
        discountPrice: 80,
        quantityTotal: 1,
        address: "123 Main Rd, Kovilpatti",
        lat: 9.1724,
        lng: 77.8694,
      });

      createdListingId = created.id;
    } catch (err) {
      console.error("Before Hook Error in Inventory Concurrency Tests:", err);
      throw err;
    }
  });

  after(async () => {
    try {
      if (createdListingId) {
        await pool.query("DELETE FROM claims WHERE listing_id = ?", [createdListingId]);
        await pool.query("DELETE FROM listings WHERE listing_id = ?", [createdListingId]);
      }
      await pool.query("DELETE FROM hotels WHERE hotel_id = 'htl_concurrency_qa'");
      await pool.query("DELETE FROM users WHERE user_id = ?", [testMerchantId]);
    } catch (e) {}
  });

  it("Price Security: Tampered frontend price must be overridden with DB price", async () => {
    const res = await makePost(`/api/listings/${createdListingId}/claim`, {
      customerName: "Alice",
      customerUsername: "alice_qa",
      quantity: 1,
      pricePaid: 1, // Malicious user tries to pay ₹1 for a ₹80 item
    });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.claim.pricePaid, 80); // Server forces ₹80 DB discount price
  });

  it("Inventory Concurrency: Concurrent order attempt on 0 available stock must fail cleanly", async () => {
    // Attempt 2 concurrent purchases when 0 stock is available
    const [res1, res2] = await Promise.all([
      makePost(`/api/listings/${createdListingId}/claim`, {
        customerName: "Bob",
        customerUsername: "bob_qa",
        quantity: 1,
      }),
      makePost(`/api/listings/${createdListingId}/claim`, {
        customerName: "Charlie",
        customerUsername: "charlie_qa",
        quantity: 1,
      }),
    ]);

    // Both should fail because item is sold out
    assert.strictEqual(res1.statusCode, 409);
    assert.strictEqual(res2.statusCode, 409);

    // Check MySQL: quantity_available must remain 0 and never negative
    const [rows] = await pool.query("SELECT quantity_available, status FROM listings WHERE listing_id = ?", [createdListingId]);
    assert.strictEqual(rows[0].quantity_available, 0);
    assert.strictEqual(rows[0].status, "soldout");
  });
});
