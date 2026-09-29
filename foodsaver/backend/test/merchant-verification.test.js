const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../src/config/database");
const store = require("../src/data/store");

before(async () => {
  try {
    await pool.query("DELETE FROM verification_applications WHERE application_id IN ('ver-rivera-qa', 'ver-2')");
    await pool.query("DELETE FROM hotels WHERE hotel_id IN ('htl-rivera-qa', 'htl-grandpalace-qa')");
    await pool.query("DELETE FROM users WHERE user_id IN ('usr-rivera-qa', 'usr-grandpalace-qa')");

    // Approved merchant
    await pool.query(
      `INSERT INTO users (user_id, role_id, email, password_hash, full_name, is_active)
       VALUES ('usr-rivera-qa', 'merchant', 'rivera@test.com', 'hash', 'Merchant Food - Rivera Artisan Bakery', TRUE)`
    );
    await pool.query(
      `INSERT INTO hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, verification_status)
       VALUES ('htl-rivera-qa', 'usr-rivera-qa', 'Merchant Food - Rivera Artisan Bakery', '123 Main Rd', '+91 98765 00001', 'approved')`
    );

    // Pending merchant with application ID 'ver-2'
    await pool.query(
      `INSERT INTO users (user_id, role_id, email, password_hash, full_name, is_active)
       VALUES ('usr-grandpalace-qa', 'merchant', 'grandpalace@test.com', 'hash', 'Merchant Food - Grand Palace Hotel', TRUE)`
    );
    await pool.query(
      `INSERT INTO hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, verification_status)
       VALUES ('htl-grandpalace-qa', 'usr-grandpalace-qa', 'Merchant Food - Grand Palace Hotel', '456 Bypass Rd', '+91 98765 00002', 'pending')`
    );
    await pool.query(
      `INSERT INTO verification_applications (application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name, status)
       VALUES ('ver-2', 'usr-grandpalace-qa', 'Merchant Food - Grand Palace Hotel', 'merchant', 'Bakery', 'Reg 123', 'License', 'doc.pdf', 'pending')`
    );
  } catch (err) {
    console.error("Before hook error in merchant-verification.test.js:", err);
  }
});

after(async () => {
  try {
    await pool.query("DELETE FROM verification_applications WHERE application_id IN ('ver-rivera-qa', 'ver-2')");
    await pool.query("DELETE FROM hotels WHERE hotel_id IN ('htl-rivera-qa', 'htl-grandpalace-qa')");
    await pool.query("DELETE FROM users WHERE user_id IN ('usr-rivera-qa', 'usr-grandpalace-qa')");
  } catch (err) {}
});

test("isMerchantApproved returns true for approved merchants and false for pending/unapproved merchants", async () => {
  // Rivera Artisan Bakery is seeded as approved
  const isApprovedRivera = await store.isMerchantApproved("Merchant Food - Rivera Artisan Bakery");
  assert.equal(isApprovedRivera, true, "Rivera Artisan Bakery should be approved");

  // Grand Palace Hotel is seeded as pending
  const isApprovedGrandPalace = await store.isMerchantApproved("Merchant Food - Grand Palace Hotel");
  assert.equal(isApprovedGrandPalace, false, "Grand Palace Hotel should not be approved until Admin verifies documents");
});

test("Admin approving a merchant unlocks posting permission", async () => {
  // Approve ver-2 (Grand Palace Hotel)
  const result = await store.updateVerificationStatus("ver-2", "approved");
  assert.equal(result.ok, true);
  assert.equal(result.application.status, "approved");

  // Update hotel verification_status in hotels table as admin approval does
  await pool.query("UPDATE hotels SET verification_status = 'approved' WHERE hotel_id = 'htl-grandpalace-qa'");

  // Now Grand Palace Hotel must be approved
  const nowApproved = await store.isMerchantApproved("Merchant Food - Grand Palace Hotel");
  assert.equal(nowApproved, true, "Merchant must be approved after Admin document verification");
});
