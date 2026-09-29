const { pool } = require("../config/database");
const { initializeDatabase } = require("./initDb");

async function resetDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("🧹 Dropping and recreating clean Star Schema database...");

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    const viewsAndTablesToDrop = [
      // Views
      "app_settings",
      "admin_notifications",
      "ngo_notifications",
      "donation_claims",
      "donations",
      "notifications",
      "order_locations",
      "order_status_history",
      "claims",
      "listings",
      "menu_items",
      "categories",
      "ngos",
      "hotels",
      "verification_applications",
      "user_locations",
      "users",
      "roles",
      // Secondary & Child Tables
      "tracking_sessions",
      "recently_accessed",
      "audit_logs",
      "merchant_documents",
      "merchant_approvals",
      "merchant_addresses",
      "merchant_hours",
      "merchant_media",
      "merchant_settings",
      "merchant_settlement",
      "ngo_documents",
      "ngo_approvals",
      "ngo_addresses",
      "ngo_food_capabilities",
      "ngo_operating_hours",
      "claim_locations",
      "claim_status_history",
      "menu_item_addons",
      "menu_item_variants",
      // Fact Tables
      "fact_admin_notifications",
      "fact_ngo_notifications",
      "fact_donation_claims",
      "fact_donations",
      "fact_notifications",
      "fact_user_locations",
      "fact_order_locations",
      "fact_order_status_history",
      "fact_claims",
      "fact_listings",
      // Dimension Tables
      "dim_app_settings",
      "dim_time",
      "dim_date",
      "dim_menu_items",
      "dim_categories",
      "dim_ngos",
      "dim_hotels",
      "dim_verification_applications",
      "dim_users",
      "dim_roles",
    ];

    for (const item of viewsAndTablesToDrop) {
      try {
        await connection.query(`DROP VIEW IF EXISTS ${item}`);
      } catch (e) {}
      try {
        await connection.query(`DROP TABLE IF EXISTS ${item}`);
      } catch (e) {}
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("✨ All views and tables dropped. Running fresh Star Schema database initialization...");
    await initializeDatabase();
    console.log("🎉 Star Schema database reset & clean seed completed!");
  } catch (err) {
    console.error("❌ Error resetting database:", err);
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  resetDatabase().then(() => process.exit(0));
}

module.exports = { resetDatabase };
