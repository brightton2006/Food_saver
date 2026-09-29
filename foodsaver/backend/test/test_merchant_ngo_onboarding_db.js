const assert = require("assert");
const { pool } = require("../src/config/database");
const store = require("../src/data/store.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "foodsaver_super_secret_jwt_key_2026";

async function runTests() {
  console.log("=== Testing Merchant & NGO Onboarding DB Storage ===");

  const timestamp = Date.now();

  // 1. Test Merchant Registration & Onboarding
  const merchantEmail = `merchant_test_${timestamp}@foodsaver.com`;
  const merchantUserId = `usr_mkt_${timestamp}`;
  const merchantHotelId = `htl_test_${timestamp}`;
  const passwordHash = await bcrypt.hash("TestPass@123", 10);

  console.log(`\n1. Creating Merchant user: ${merchantUserId}`);
  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active)
     VALUES (?, 'merchant', ?, ?, 'Chef Murugan', '+91 98765 43210', 'DRAFT', TRUE)`,
    [merchantUserId, merchantEmail, passwordHash]
  );

  const merchantWizardData = {
    hotelId: merchantHotelId,
    businessName: "Kovilpatti Delight Bakery & Sweets",
    description: "Famous local bakery for fresh evening bread, puff pastries, and halwa.",
    cuisine: ["Bakery & Desserts", "South Indian", "Fast Food"],
    businessType: "Bakery",
    yearEstablished: "2018",
    seatingCapacity: 25,
    foodType: "Both",
    openingTime: "08:00",
    closingTime: "22:00",
    weeklyClosedDay: "None",
    averagePrepTime: 15,
    minimumOrderAmount: 80,
    deliveryRadius: 4.5,
    deliveryFee: 20,
    amenities: ["Air Conditioned", "Pure Veg Options", "Dedicated Parking"],
    address: "14 Kovilpatti Main Road, Kovilpatti",
    city: "Kovilpatti",
    latitude: 9.1724,
    longitude: 77.8694,
    addressDetails: {
      buildingNumber: "14",
      street: "Main Road",
      area: "Gandhi Nagar",
      city: "Kovilpatti",
      state: "Tamil Nadu",
      pincode: "628501",
      landmark: "Near New Bus Stand",
      latitude: 9.1724,
      longitude: 77.8694,
    },
    documents: [
      { docType: "FSSAI Food Safety License", docNumber: "12421012000342", fileRef: "fssai_bakery.pdf" },
      { docType: "GST Business Registration", docNumber: "33AAAAA1234A1Z5", fileRef: "gst_certificate.pdf" }
    ],
    settlement: {
      accountHolderName: "Kovilpatti Delight Bakery",
      bankAccount: "98765432109876",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank Kovilpatti"
    },
    menuItems: [
      { name: "Fresh Butter Puff", description: "Crispy layers with spiced vegetable filling", price: 30, finalPrice: 20, isVeg: true, image: "puff.jpg" },
      { name: "Tirunelveli Ghee Halwa Box", description: "Hot wheat halwa made in pure cow ghee", price: 150, finalPrice: 99, isVeg: true, image: "halwa.jpg" }
    ]
  };

  console.log("Submitting merchant onboarding to database via store.submitMerchantOnboarding...");
  const merchantResult = await store.submitMerchantOnboarding(merchantUserId, merchantWizardData);
  assert.strictEqual(merchantResult.ok, true, "Merchant submission should succeed");
  console.log("Merchant submitted successfully. Result:", merchantResult);

  // Verify rows in MySQL
  const [hotelRows] = await pool.query("SELECT * FROM dim_hotels WHERE merchant_user_id = ?", [merchantUserId]);
  assert(hotelRows.length > 0, "dim_hotels row must exist");
  assert.strictEqual(hotelRows[0].hotel_name, "Kovilpatti Delight Bakery & Sweets");
  assert.strictEqual(hotelRows[0].status, "SUBMITTED");
  console.log("✓ Verified dim_hotels row:", hotelRows[0].hotel_name, hotelRows[0].status);

  const [addrRows] = await pool.query("SELECT * FROM merchant_addresses WHERE merchant_user_id = ?", [merchantUserId]);
  assert(addrRows.length > 0, "merchant_addresses row must exist");
  assert.strictEqual(addrRows[0].street, "Main Road");
  console.log("✓ Verified merchant_addresses row:", addrRows[0].street, addrRows[0].city);

  const [docRows] = await pool.query("SELECT * FROM merchant_documents WHERE merchant_user_id = ?", [merchantUserId]);
  assert(docRows.length >= 2, "merchant_documents rows must exist");
  console.log("✓ Verified merchant_documents count:", docRows.length);

  const [settlementRows] = await pool.query("SELECT * FROM merchant_settlement WHERE merchant_user_id = ?", [merchantUserId]);
  assert(settlementRows.length > 0, "merchant_settlement row must exist");
  console.log("✓ Verified merchant_settlement row:", settlementRows[0].account_holder_name, settlementRows[0].bank_reference);

  const [menuRows] = await pool.query("SELECT * FROM dim_menu_items WHERE hotel_id = ?", [hotelRows[0].hotel_id]);
  assert(menuRows.length >= 2, "dim_menu_items rows must exist");
  console.log("✓ Verified dim_menu_items count:", menuRows.length);

  const [verRows] = await pool.query("SELECT * FROM dim_verification_applications WHERE user_id = ?", [merchantUserId]);
  assert(verRows.length > 0, "dim_verification_applications row must exist for merchant");
  assert.strictEqual(verRows[0].target_role, "merchant");
  console.log("✓ Verified dim_verification_applications for merchant:", verRows[0].application_id, verRows[0].business_name);


  // 2. Test NGO Registration & Onboarding
  const ngoEmail = `ngo_test_${timestamp}@foodsaver.com`;
  const ngoUserId = `usr_ngo_${timestamp}`;

  console.log(`\n2. Creating NGO user: ${ngoUserId}`);
  await pool.query(
    `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active)
     VALUES (?, 'ngo', ?, ?, 'Anitha Raman', '+91 94433 22110', 'DRAFT', TRUE)`,
    [ngoUserId, ngoEmail, passwordHash]
  );

  const ngoWizardData = {
    ngoName: "Kovilpatti Food Relief Trust",
    organizationType: "Trust",
    registrationNumber: "TR-2019-KV-0442",
    yearEstablished: "2019",
    description: "Dedicated to collecting surplus food from local restaurants and redistributing to homeless shelters and orphanages.",
    website: "https://kovilpattirelief.org",
    address: "28 Station Road, Kovilpatti",
    latitude: 9.1750,
    longitude: 77.8720,
    contactNumber: "+91 94433 22110",
    serviceRadiusKm: 8.0,
    addressDetails: {
      buildingNumber: "28",
      street: "Station Road",
      area: "Railway Colony",
      city: "Kovilpatti",
      state: "Tamil Nadu",
      pincode: "628501",
      landmark: "Opposite Post Office",
      latitude: 9.1750,
      longitude: 77.8720,
    },
    foodCapabilities: {
      dailyRequirementServings: 250,
      maxPickupCapacityKg: 120.0,
      vehicleTypes: ["Mini Van", "Two Wheeler"],
      coldStorageAvailable: true,
      rawFoodAccepted: true,
      cookedFoodAccepted: true,
      packagedFoodAccepted: true,
      targetBeneficiaries: "Elderly homes, child care centers, and daily-wage colonies"
    },
    documents: [
      { type: "NGO 80G Tax Exemption Certificate", number: "80G-AAACT9999M", file: "80g_certificate.pdf" },
      { type: "Trust Deed / Society Registration Cert", number: "TRUST-2019-94", file: "trust_deed.pdf" }
    ],
    operatingHours: [
      { dayOfWeek: "Monday", openingTime: "07:00:00", closingTime: "22:00:00", isClosed: false },
      { dayOfWeek: "Tuesday", openingTime: "07:00:00", closingTime: "22:00:00", isClosed: false },
      { dayOfWeek: "Wednesday", openingTime: "07:00:00", closingTime: "22:00:00", isClosed: false }
    ]
  };

  console.log("Submitting NGO onboarding to database via store.submitNgoOnboarding...");
  const ngoResult = await store.submitNgoOnboarding(ngoUserId, ngoWizardData);
  assert.strictEqual(ngoResult.success, true, "NGO submission should succeed");
  console.log("NGO submitted successfully. Result:", ngoResult);

  // Verify rows in MySQL
  const [ngoDbRows] = await pool.query("SELECT * FROM dim_ngos WHERE ngo_user_id = ?", [ngoUserId]);
  assert(ngoDbRows.length > 0, "dim_ngos row must exist");
  assert.strictEqual(ngoDbRows[0].ngo_name, "Kovilpatti Food Relief Trust");
  assert.strictEqual(ngoDbRows[0].status, "SUBMITTED");
  console.log("✓ Verified dim_ngos row:", ngoDbRows[0].ngo_name, ngoDbRows[0].status);

  const [ngoAddrRows] = await pool.query("SELECT * FROM ngo_addresses WHERE ngo_user_id = ?", [ngoUserId]);
  assert(ngoAddrRows.length > 0, "ngo_addresses row must exist");
  assert.strictEqual(ngoAddrRows[0].street, "Station Road");
  console.log("✓ Verified ngo_addresses row:", ngoAddrRows[0].street, ngoAddrRows[0].city);

  const [ngoDocRows] = await pool.query("SELECT * FROM ngo_documents WHERE ngo_user_id = ?", [ngoUserId]);
  assert(ngoDocRows.length >= 2, "ngo_documents rows must exist");
  console.log("✓ Verified ngo_documents count:", ngoDocRows.length);

  const [ngoCapRows] = await pool.query("SELECT * FROM ngo_food_capabilities WHERE ngo_user_id = ?", [ngoUserId]);
  assert(ngoCapRows.length > 0, "ngo_food_capabilities row must exist");
  assert.strictEqual(ngoCapRows[0].daily_food_requirement_servings, 250);
  console.log("✓ Verified ngo_food_capabilities row:", ngoCapRows[0].daily_food_requirement_servings, "servings, capacity:", ngoCapRows[0].max_pickup_capacity_kg, "kg");

  const [ngoHourRows] = await pool.query("SELECT * FROM ngo_operating_hours WHERE ngo_user_id = ?", [ngoUserId]);
  assert(ngoHourRows.length >= 3, "ngo_operating_hours rows must exist");
  console.log("✓ Verified ngo_operating_hours count:", ngoHourRows.length);

  const [ngoVerRows] = await pool.query("SELECT * FROM dim_verification_applications WHERE user_id = ?", [ngoUserId]);
  assert(ngoVerRows.length > 0, "dim_verification_applications row must exist for NGO");
  assert.strictEqual(ngoVerRows[0].target_role, "ngo");
  console.log("✓ Verified dim_verification_applications for NGO:", ngoVerRows[0].application_id, ngoVerRows[0].business_name);

  console.log("\n ALL MERCHANT & NGO ONBOARDING DATABASE TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
