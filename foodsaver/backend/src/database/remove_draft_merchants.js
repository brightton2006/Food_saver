const { pool } = require("../config/database");

async function removeDraftMerchants() {
  const targetHotelIds = [
    "htl_wgg0N9_62n",
    "htl_hIPUEo3Wy9",
    "htl_test_track_1790606116284",
    "htl_2NWdk8hz5h"
  ];

  const targetUserEmails = [
    "ver-1@foodsaver.com",
    "mkt_test_track_1790606116284@foodsaver.com",
    "mkt_test_approved_merchant_qa@foodsaver.com",
    "merchant-1@foodsaver.com",
    "usr_test_cust_1790606116284@foodsaver.com"
  ];

  const conn = await pool.getConnection();
  try {
    console.log("Beginning deletion of draft merchants...");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // 1. Get user IDs matching emails
    const [users] = await conn.query("SELECT user_id, email, full_name FROM dim_users WHERE email IN (?)", [targetUserEmails]);
    const userIds = users.map(u => u.user_id);
    console.log("Target Users to remove:", users);

    // 2. Secondary merchant tables
    const secTables = [
      "merchant_addresses",
      "merchant_approvals",
      "merchant_documents",
      "merchant_hours",
      "merchant_media",
      "merchant_settings",
      "merchant_settlement",
      "dim_menu_items",
      "fact_listings",
      "dim_hotels"
    ];
    for (const tbl of secTables) {
      try {
        const [res] = await conn.query(`DELETE FROM \`${tbl}\` WHERE hotel_id IN (?)`, [targetHotelIds]);
        console.log(`Deleted from ${tbl}: ${res.affectedRows} rows`);
      } catch (err) {
        console.warn(`Skipping ${tbl}:`, err.message);
      }
    }

    // 3. Verification applications
    if (userIds.length > 0) {
      const [verifRes] = await conn.query("DELETE FROM dim_verification_applications WHERE user_id IN (?)", [userIds]);
      console.log("Deleted from dim_verification_applications:", verifRes.affectedRows);

      // 4. dim_users
      const [userRes] = await conn.query("DELETE FROM dim_users WHERE user_id IN (?)", [userIds]);
      console.log("Deleted from dim_users:", userRes.affectedRows);
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅ Successfully removed all requested draft merchants and their records!");

    // Show remaining hotels and users
    const [remHotels] = await conn.query("SELECT hotel_id, hotel_name, status, merchant_user_id FROM dim_hotels");
    console.log("Remaining hotels:", remHotels);
    const [remUsers] = await conn.query("SELECT user_id, full_name, email, role_id, status FROM dim_users");
    console.log("Remaining users:", remUsers);

  } catch (err) {
    console.error("Error deleting merchants:", err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

removeDraftMerchants();
