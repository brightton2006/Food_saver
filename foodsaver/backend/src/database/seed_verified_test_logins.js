const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

const TEST_ACCOUNTS = [
  {
    role: "admin",
    email: "test_admin@foodsaver.com",
    password: "TestAdmin_Secure2026!",
    name: "Platform Test Admin",
    userId: "usr_test_admin",
  },
  {
    role: "merchant",
    email: "test_merchant@foodsaver.com",
    password: "TestMerchant_Secure2026!",
    name: "Test Hotel Owner",
    userId: "usr_test_merchant",
    hotelId: "htl_test_merchant_01",
    hotelName: "Hotel Sri Ganesh Bhavan",
  },
  {
    role: "customer",
    email: "test_customer@foodsaver.com",
    password: "TestCustomer_Secure2026!",
    name: "Test Customer User",
    userId: "usr_test_customer",
  },
  {
    role: "ngo",
    email: "test_ngo@foodsaver.com",
    password: "TestNgo_Secure2026!",
    name: "FoodSaver Rescue NGO",
    userId: "usr_test_ngo",
    ngoId: "ngo_test_01",
    ngoName: "FoodSaver Relief Foundation",
  },
];

async function seedVerifiedTestLogins() {
  console.log("=================================================");
  console.log("🔑 CREATING DEDICATED VERIFIED TEST ACCOUNTS");
  console.log("=================================================\n");

  let connection;
  try {
    connection = await pool.getConnection();

    for (const acc of TEST_ACCOUNTS) {
      const passwordHash = await bcrypt.hash(acc.password, 10);

      // 1. Insert or Update User in dim_users
      await connection.query(
        `INSERT INTO dim_users (
          user_id, role_id, email, password_hash, full_name, phone_number,
          is_active, status, latitude, longitude, approved_at
        ) VALUES (?, ?, ?, ?, ?, '+91 9876543210', TRUE, 'APPROVED', 9.1724, 77.8694, NOW())
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          role_id = VALUES(role_id),
          full_name = VALUES(full_name),
          status = 'APPROVED',
          is_active = TRUE`,
        [acc.userId, acc.role, acc.email, passwordHash, acc.name]
      );

      console.log(`✅ Account configured: ${acc.role.toUpperCase()} -> ${acc.email}`);

      // 2. If Merchant, ensure Hotel is linked and APPROVED
      if (acc.role === "merchant" && acc.hotelId) {
        await connection.query(
          `INSERT INTO dim_hotels (
            hotel_id, merchant_user_id, hotel_name, description, address,
            contact_number, cuisine, opening_hours, rating, verification_status, status,
            latitude, longitude, delivery_available, takeaway_available
          ) VALUES (
            ?, ?, ?, 'Premier vegetarian food partner in Kovilpatti', '124 Main Road, Kovilpatti',
            '+91 4632 220101', 'South Indian Vegetarian • Meals', '10:00 - 22:00', 4.5,
            'approved', 'APPROVED', 9.1748868, 77.8658213, TRUE, TRUE
          )
          ON DUPLICATE KEY UPDATE
            merchant_user_id = VALUES(merchant_user_id),
            verification_status = 'approved',
            status = 'APPROVED'`,
          [acc.hotelId, acc.userId, acc.hotelName]
        );
        console.log(`   └─ Linked Hotel: ${acc.hotelName} (${acc.hotelId}) [APPROVED]`);
      }

      // 3. If NGO, ensure NGO record is linked and APPROVED
      if (acc.role === "ngo" && acc.ngoId) {
        await connection.query(
          `INSERT INTO dim_ngos (
            ngo_id, ngo_user_id, ngo_name, organization_type, registration_number,
            description, address, contact_number, service_radius_km, verification_status, status,
            latitude, longitude
          ) VALUES (
            ?, ?, ?, 'Trust', 'REG-NGO-KOV-2026',
            'Community food rescue and distribution non-profit', '45 Temple Road, Kovilpatti',
            '+91 4632 220999', 10.0, 'approved', 'APPROVED', 9.1724, 77.8694
          )
          ON DUPLICATE KEY UPDATE
            ngo_user_id = VALUES(ngo_user_id),
            verification_status = 'approved',
            status = 'APPROVED'`,
          [acc.ngoId, acc.userId, acc.ngoName]
        );
        console.log(`   └─ Linked NGO: ${acc.ngoName} (${acc.ngoId}) [APPROVED]`);
      }
    }

    console.log("\n=================================================");
    console.log("🎉 ALL TEST ACCOUNTS CREATED & APPROVED SUCCESSFULLY!");
    console.log("=================================================\n");

    return TEST_ACCOUNTS;
  } catch (err) {
    console.error("❌ Error seeding test logins:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  seedVerifiedTestLogins()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedVerifiedTestLogins, TEST_ACCOUNTS };
