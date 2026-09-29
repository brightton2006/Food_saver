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

describe("NGO Surplus Donation & Claim Concurrency Tests", () => {
  const testMerchantId = "usr_mkt_donation_qa";
  const testHotelId = "htl_donation_qa";
  const testNgo1 = "usr_ngo_1_qa";
  const testNgo2 = "usr_ngo_2_qa";
  let createdDonationId = null;

  before(async () => {
    // Setup prerequisite merchant & NGO user rows
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
       VALUES (?, 'merchant', 'donation_qa_mkt@test.com', 'hash', 'Donation QA Merchant', '+91 99999 11111', TRUE, 'APPROVED')
       ON DUPLICATE KEY UPDATE status = 'APPROVED'`,
      [testMerchantId]
    );

    await pool.query(
      `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, verification_status, status)
       VALUES (?, ?, 'Donation QA Hotel', '123 Main Road, Kovilpatti', '+91 99999 11111', 'approved', 'ACTIVE')
       ON DUPLICATE KEY UPDATE verification_status = 'approved'`,
      [testHotelId, testMerchantId]
    );

    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
       VALUES (?, 'ngo', 'donation_qa_ngo1@test.com', 'hash', 'Donation QA NGO 1', '+91 99999 22221', TRUE, 'APPROVED')
       ON DUPLICATE KEY UPDATE status = 'APPROVED'`,
      [testNgo1]
    );

    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
       VALUES (?, 'ngo', 'donation_qa_ngo2@test.com', 'hash', 'Donation QA NGO 2', '+91 99999 22222', TRUE, 'APPROVED')
       ON DUPLICATE KEY UPDATE status = 'APPROVED'`,
      [testNgo2]
    );

    // Create surplus donation
    const res = await makePost("/api/donations", {
      merchantUserId: testMerchantId,
      hotelId: testHotelId,
      itemName: "QA NGO Test Meal Package",
      quantity: 10,
      lat: 9.1724,
      lng: 77.8694,
    });

    assert.strictEqual(res.statusCode, 201);
    createdDonationId = res.body.donation.donationId;
  });

  after(async () => {
    if (createdDonationId) {
      await pool.query("DELETE FROM donation_claims WHERE donation_id = ?", [createdDonationId]);
      await pool.query("DELETE FROM donations WHERE donation_id = ?", [createdDonationId]);
    }
    await pool.query("DELETE FROM dim_hotels WHERE hotel_id = ?", [testHotelId]);
    await pool.query("DELETE FROM dim_users WHERE user_id IN (?, ?, ?)", [testMerchantId, testNgo1, testNgo2]);
  });

  it("NGO Claim Concurrency: Only first NGO claim must succeed, second must fail cleanly", async () => {
    const [claim1, claim2] = await Promise.all([
      makePost(`/api/donations/${createdDonationId}/claim`, { ngoUserId: testNgo1 }),
      makePost(`/api/donations/${createdDonationId}/claim`, { ngoUserId: testNgo2 }),
    ]);

    // One must be 200/201 OK, the other must be 400/409 error
    const successes = [claim1, claim2].filter((c) => c.statusCode === 200 || c.statusCode === 201);
    const failures = [claim1, claim2].filter((c) => c.statusCode === 400 || c.statusCode === 409);

    assert.strictEqual(successes.length, 1, "Exactly 1 NGO claim must succeed");
    assert.strictEqual(failures.length, 1, "Subsequent concurrent NGO claims must fail");

    // Check status in MySQL: Status must be NGO_ACCEPTED
    const [rows] = await pool.query("SELECT status FROM donations WHERE donation_id = ?", [createdDonationId]);
    assert.strictEqual(rows[0].status, "NGO_ACCEPTED");
  });
});
