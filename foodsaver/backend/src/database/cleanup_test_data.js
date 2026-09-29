const { pool } = require("../config/database");

async function cleanupTestData() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("=================================================");
    console.log("🧹 REMOVING ALL TEST DATA & TEST ACCOUNTS");
    console.log("=================================================\n");

    // Disable foreign key checks during cleanup
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

    // 1. Identify real user accounts to preserve:
    // - System Admin (admin-1)
    // - Real users with registered domains (e.g. gmail.com)
    const [realUsers] = await connection.query(`
      SELECT user_id, role_id, email, full_name 
      FROM dim_users 
      WHERE user_id = 'admin-1'
         OR (email NOT LIKE '%@foodsaver.com' 
             AND email NOT LIKE '%@foodsaver.local'
             AND email NOT LIKE '%@test.com' 
             AND email NOT LIKE '%@ngo.org'
             AND email NOT LIKE '%test%'
             AND email NOT LIKE '%qa%'
             AND email NOT LIKE '%other_kitchen%'
             AND user_id NOT LIKE '%test%'
             AND user_id NOT LIKE 'other_merchant_%')
    `);

    const preservedUserIds = realUsers.map((u) => u.user_id);
    console.log("✅ Preserved Real User Accounts (" + preservedUserIds.length + "):");
    console.table(realUsers);

    // 2. Identify preserved hotels owned by preserved real users
    const [preservedHotels] = await connection.query(
      `SELECT hotel_id, hotel_name, merchant_user_id 
       FROM dim_hotels 
       WHERE merchant_user_id IN (?)
         AND hotel_id NOT LIKE 'h_test_%'`,
      [preservedUserIds.length > 0 ? preservedUserIds : ["__none__"]]
    );
    const preservedHotelIds = preservedHotels.map((h) => h.hotel_id);
    console.log("✅ Preserved Real Merchant Hotels (" + preservedHotelIds.length + "):");
    console.table(preservedHotels);

    // Helper functions
    async function safeTruncate(tbl) {
      try {
        const [rows] = await connection.query(
          "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND TABLE_TYPE = 'BASE TABLE'",
          [tbl]
        );
        if (rows.length > 0) {
          await connection.query(`TRUNCATE TABLE \`${tbl}\``);
        }
      } catch (err) {
        console.warn(`Note on truncating ${tbl}:`, err.message);
      }
    }

    async function safeQuery(sql, params = []) {
      try {
        await connection.query(sql, params);
      } catch (err) {
        console.warn(`Note on query:`, err.message);
      }
    }

    // 3. Delete all test tracking sessions
    console.log("🔹 Deleting test tracking sessions...");
    await safeTruncate("tracking_sessions");

    // 4. Delete all test claim locations & history
    console.log("🔹 Cleaning claim locations & history...");
    await safeTruncate("claim_locations");
    await safeTruncate("claim_status_history");
    await safeTruncate("fact_order_locations");
    await safeTruncate("fact_order_status_history");

    // 5. Delete all test claims / orders
    console.log("🔹 Cleaning test claims & orders...");
    await safeTruncate("fact_claims");

    // 6. Delete all test donations & donation claims
    console.log("🔹 Cleaning donation fact tables...");
    await safeTruncate("fact_donation_claims");
    await safeTruncate("fact_donations");

    // 7. Delete all test listings & expired test items
    console.log("🔹 Cleaning test food listings...");
    await safeTruncate("fact_listings");

    // 8. Delete test menu items (keep only menu items for preserved hotels if any exist)
    console.log("🔹 Cleaning menu items...");
    if (preservedHotelIds.length > 0) {
      await safeQuery(
        "DELETE FROM dim_menu_items WHERE hotel_id NOT IN (?)",
        [preservedHotelIds]
      );
    } else {
      await safeTruncate("dim_menu_items");
    }

    // 9. Delete test hotels
    console.log("🔹 Cleaning test hotels...");
    if (preservedHotelIds.length > 0) {
      await safeQuery(
        "DELETE FROM dim_hotels WHERE hotel_id NOT IN (?) OR hotel_id LIKE 'h_test_%'",
        [preservedHotelIds]
      );
    } else {
      await safeTruncate("dim_hotels");
    }

    // 10. Delete test NGOs
    console.log("🔹 Cleaning test NGO tables...");
    await safeTruncate("ngo_addresses");
    await safeTruncate("ngo_approvals");
    await safeTruncate("ngo_documents");
    await safeTruncate("ngo_food_capabilities");
    await safeTruncate("ngo_operating_hours");
    await safeTruncate("dim_ngos");

    // 11. Clean merchant secondary tables for deleted hotels
    console.log("🔹 Cleaning merchant detail tables...");
    if (preservedHotelIds.length > 0) {
      await safeQuery("DELETE FROM merchant_addresses WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
      await safeQuery("DELETE FROM merchant_approvals WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
      await safeQuery("DELETE FROM merchant_documents WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
      await safeQuery("DELETE FROM merchant_hours WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
      await safeQuery("DELETE FROM merchant_media WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
      await safeQuery("DELETE FROM merchant_settings WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
      await safeQuery("DELETE FROM merchant_settlement WHERE hotel_id NOT IN (?)", [preservedHotelIds]);
    } else {
      await safeTruncate("merchant_addresses");
      await safeTruncate("merchant_approvals");
      await safeTruncate("merchant_documents");
      await safeTruncate("merchant_hours");
      await safeTruncate("merchant_media");
      await safeTruncate("merchant_settings");
      await safeTruncate("merchant_settlement");
    }

    // 12. Clean test verification applications
    console.log("🔹 Cleaning verification applications...");
    if (preservedUserIds.length > 0) {
      await safeQuery("DELETE FROM dim_verification_applications WHERE user_id NOT IN (?)", [preservedUserIds]);
    } else {
      await safeTruncate("dim_verification_applications");
    }

    // 13. Clean notifications, user locations, recently accessed, and audit logs
    console.log("🔹 Cleaning notifications & session caches...");
    await safeTruncate("fact_admin_notifications");
    await safeTruncate("fact_ngo_notifications");
    await safeTruncate("fact_notifications");
    await safeTruncate("fact_user_locations");
    await safeTruncate("recently_accessed");
    await safeTruncate("audit_logs");

    // 14. Delete all automated test users from dim_users (preserve only preservedUserIds)
    console.log("🔹 Removing test accounts from dim_users...");
    if (preservedUserIds.length > 0) {
      await safeQuery("DELETE FROM dim_users WHERE user_id NOT IN (?)", [preservedUserIds]);
    }

    // Re-enable foreign key checks
    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("\n=================================================");
    console.log("🎉 ALL TEST DATA REMOVED SUCCESSFULLY!");
    console.log("=================================================\n");

    // Verify remaining data
    const [finalUsers] = await connection.query("SELECT user_id, role_id, email, full_name FROM dim_users");
    console.log("🔹 Remaining Active Real Users in dim_users:");
    console.table(finalUsers);

    const [finalHotels] = await connection.query("SELECT hotel_id, hotel_name, merchant_user_id, status FROM dim_hotels");
    console.log("🔹 Remaining Real Hotels in dim_hotels:");
    console.table(finalHotels);

    const [finalListings] = await connection.query("SELECT listing_id, item_name, hotel_id, status FROM fact_listings");
    console.log("🔹 Remaining Listings in fact_listings (" + finalListings.length + ")");

    const [finalClaims] = await connection.query("SELECT claim_id, listing_id, customer_user_id, status FROM fact_claims");
    console.log("🔹 Remaining Claims in fact_claims (" + finalClaims.length + ")");

    const [finalNgos] = await connection.query("SELECT ngo_id, ngo_name FROM dim_ngos");
    console.log("🔹 Remaining NGOs in dim_ngos (" + finalNgos.length + ")");

    return {
      success: true,
      users: finalUsers,
      hotels: finalHotels,
      listings: finalListings,
      claims: finalClaims,
      ngos: finalNgos,
    };
  } catch (error) {
    console.error("❌ Error during test data cleanup:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  cleanupTestData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { cleanupTestData };
