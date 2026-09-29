const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../src/config/database");
const store = require("../src/data/store");

const TEST_USER_ID = "usr_e2e_merch_test_99";
const TEST_HOTEL_ID = "htl_e2e_merch_test_99";
const TEST_EMAIL = "e2e_merch_test_99@foodsaver.com";

before(async () => {
  try {
    await pool.query("DELETE FROM fact_admin_notifications WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    await pool.query("DELETE FROM dim_verification_applications WHERE user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_approvals WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_documents WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_settlement WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_addresses WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM dim_menu_items WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    await pool.query("DELETE FROM fact_listings WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    await pool.query("DELETE FROM dim_hotels WHERE hotel_id = ? OR merchant_user_id = ?", [TEST_HOTEL_ID, TEST_USER_ID]);
    await pool.query("DELETE FROM dim_users WHERE user_id = ? OR email = ?", [TEST_USER_ID, TEST_EMAIL]);

    // Insert test draft merchant
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active)
       VALUES (?, 'merchant', ?, 'test_hash', 'Test Chef Kumar', '+91 98765 43210', 'DRAFT', TRUE)`,
      [TEST_USER_ID, TEST_EMAIL]
    );

    await pool.query(
      `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, status, verification_status)
       VALUES (?, ?, 'Kumar Sweets & Bakery', 'Address Pending', '+91 98765 43210', 'DRAFT', 'pending')`,
      [TEST_HOTEL_ID, TEST_USER_ID]
    );
  } catch (err) {
    console.error("Before hook error:", err);
  }
});

after(async () => {
  try {
    await pool.query("DELETE FROM fact_admin_notifications WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    await pool.query("DELETE FROM dim_verification_applications WHERE user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_approvals WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_documents WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_settlement WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM merchant_addresses WHERE merchant_user_id = ?", [TEST_USER_ID]);
    await pool.query("DELETE FROM dim_menu_items WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    await pool.query("DELETE FROM fact_listings WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    await pool.query("DELETE FROM dim_hotels WHERE hotel_id = ? OR merchant_user_id = ?", [TEST_HOTEL_ID, TEST_USER_ID]);
    await pool.query("DELETE FROM dim_users WHERE user_id = ? OR email = ?", [TEST_USER_ID, TEST_EMAIL]);
  } catch (err) {}
});

test("Step 1: Unverified draft merchant is NOT approved", async () => {
  const isApproved = await store.isMerchantApproved(TEST_HOTEL_ID);
  assert.equal(isApproved, false, "Merchant in DRAFT status must not be approved");
});

test("Step 2: Submitting merchant onboarding wizard updates status, creates verification application and admin notification", async () => {
  const wizardData = {
    hotelId: TEST_HOTEL_ID,
    businessName: "Kumar Sweets & Bakery",
    ownerName: "Chef Kumar",
    mobile: "+91 98765 43210",
    fssaiNumber: "12421012000492",
    gstin: "33AAAAA0000A1Z5",
    cuisine: ["South Indian", "Bakery & Desserts"],
    address: "74 South Cotton Road, Kovilpatti",
    city: "Kovilpatti",
    addressDetails: {
      buildingNumber: "74",
      street: "South Cotton Road",
      area: "Main Market",
      city: "Kovilpatti",
      state: "Tamil Nadu",
      pincode: "628501",
      latitude: 9.1724,
      longitude: 77.8694,
    },
    documents: [
      { docType: "FSSAI License", docNumber: "12421012000492", fileRef: "fssai_kumar.pdf" },
      { docType: "GST Certificate", docNumber: "33AAAAA0000A1Z5", fileRef: "gst_kumar.pdf" },
    ],
    settlement: {
      accountHolderName: "Kumar Sweets",
      bankAccount: "98765432101234",
      bankName: "HDFC Bank",
      ifsc: "HDFC0001234",
    },
    menuItems: [
      { name: "Gulab Jamun Pack", description: "Hot syrup sweets", price: 150, discount: 50, finalPrice: 100, isVeg: true },
    ],
    declarationAccepted: true,
  };

  const res = await store.submitMerchantOnboarding(TEST_USER_ID, wizardData);
  assert.equal(res.ok, true);
  assert.equal(res.status, "SUBMITTED");

  // Check dim_hotels
  const [hRows] = await pool.query("SELECT * FROM dim_hotels WHERE hotel_id = ?", [TEST_HOTEL_ID]);
  assert.equal(hRows.length, 1);
  assert.equal(hRows[0].status, "SUBMITTED");
  assert.equal(hRows[0].verification_status, "under_review");

  // Check dim_users
  const [uRows] = await pool.query("SELECT * FROM dim_users WHERE user_id = ?", [TEST_USER_ID]);
  assert.equal(uRows.length, 1);
  assert.equal(uRows[0].status, "PENDING");

  // Check dim_verification_applications
  const [vRows] = await pool.query("SELECT * FROM dim_verification_applications WHERE user_id = ?", [TEST_USER_ID]);
  assert.equal(vRows.length, 1, "Verification application record must be created");
  assert.equal(vRows[0].status, "under_review");
  assert.equal(vRows[0].business_name, "Kumar Sweets & Bakery");

  // Check fact_admin_notifications
  const [nRows] = await pool.query("SELECT * FROM fact_admin_notifications WHERE hotel_id = ?", [TEST_HOTEL_ID]);
  assert.ok(nRows.length >= 1, "Admin notification must be created upon merchant profile submission");
});

test("Step 3: listMerchantsForAdmin with PENDING filter successfully returns submitted merchant", async () => {
  const pendingMerchants = await store.listMerchantsForAdmin("PENDING");
  const found = pendingMerchants.find((m) => m.hotelId === TEST_HOTEL_ID || m.merchantId === TEST_USER_ID);
  assert.ok(found, "Pending merchant must be included in listMerchantsForAdmin('PENDING')");
  assert.equal(found.hotelName, "Kumar Sweets & Bakery");
});

test("Step 4: Admin approves merchant profile, updating all tables synchronously", async () => {
  try {
    const approved = await store.updateMerchantApproval(TEST_HOTEL_ID, "APPROVED", "admin-tester-1");
    assert.ok(approved);
    assert.equal(approved.status, "APPROVED");

    // Verify dim_hotels
    const [hRows] = await pool.query("SELECT * FROM dim_hotels WHERE hotel_id = ?", [TEST_HOTEL_ID]);
    assert.equal(hRows[0].status, "APPROVED");
    assert.equal(hRows[0].verification_status, "approved");

    // Verify dim_users
    const [uRows] = await pool.query("SELECT * FROM dim_users WHERE user_id = ?", [TEST_USER_ID]);
    assert.equal(uRows[0].status, "APPROVED");

    // Verify dim_verification_applications
    const [vRows] = await pool.query("SELECT * FROM dim_verification_applications WHERE user_id = ?", [TEST_USER_ID]);
    assert.equal(vRows[0].status, "approved");

    // Verify merchant_documents
    const [docRows] = await pool.query("SELECT * FROM merchant_documents WHERE merchant_user_id = ?", [TEST_USER_ID]);
    assert.ok(docRows.length > 0);
    assert.equal(docRows[0].verification_status, "VERIFIED");

    // Verify isMerchantApproved
    const isApprovedNow = await store.isMerchantApproved(TEST_HOTEL_ID);
    assert.equal(isApprovedNow, true, "isMerchantApproved must return true after admin verification");
  } catch (err) {
    console.error("DEBUG STEP 4 ERROR:", err);
    throw err;
  }
});
