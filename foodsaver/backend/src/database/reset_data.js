const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

const PRESERVED_LOOKUP_TABLES = [
  "dim_roles",
  "dim_app_settings",
  "dim_categories",
  "dim_date",
  "dim_time",
];

const APPLICATION_DATA_TABLES = [
  "claim_locations",
  "claim_status_history",
  "fact_admin_notifications",
  "fact_claims",
  "fact_donation_claims",
  "fact_donations",
  "fact_ngo_notifications",
  "fact_notifications",
  "fact_order_locations",
  "fact_order_status_history",
  "fact_user_locations",
  "fact_listings",
  "menu_item_addons",
  "menu_item_variants",
  "dim_menu_items",
  "merchant_addresses",
  "merchant_approvals",
  "merchant_documents",
  "merchant_hours",
  "merchant_media",
  "merchant_settings",
  "merchant_settlement",
  "dim_hotels",
  "ngo_addresses",
  "ngo_approvals",
  "ngo_documents",
  "ngo_food_capabilities",
  "ngo_operating_hours",
  "dim_ngos",
  "dim_verification_applications",
  "dim_users",
];

async function runResetData() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("=================================================");
    console.log("🧹 STARTING PRODUCTION-GRADE DATABASE RESET");
    console.log("=================================================\n");

    // 1. Pre-reset inspection
    console.log("🔹 1. Inspecting Pre-Reset Record Counts...");
    const preResetStats = [];
    const [allTables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableNameKey = Object.keys(allTables[0])[0];

    for (const row of allTables) {
      const name = row[tableNameKey];
      const [cnt] = await connection.query(`SELECT COUNT(*) as count FROM \`${name}\``);
      const [auto] = await connection.query(
        "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [name]
      );
      preResetStats.push({
        table: name,
        rowsBefore: cnt[0].count,
        autoIncrementBefore: auto[0]?.AUTO_INCREMENT ?? null,
      });
    }

    console.table(preResetStats);

    // 2. Disable FK checks
    console.log("\n🔹 2. Temporarily Disabling Foreign Key Checks...");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

    // 3. Truncate application data tables and reset AUTO_INCREMENT
    console.log("\n🔹 3. Truncating Application Data Tables & Resetting Auto-Increments...");
    const resetResults = [];
    for (const tableName of APPLICATION_DATA_TABLES) {
      const [beforeCnt] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      await connection.query(`TRUNCATE TABLE \`${tableName}\``);
      await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
      
      const [afterCnt] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
      const [autoVal] = await connection.query(
        "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [tableName]
      );
      
      resetResults.push({
        table: tableName,
        deletedRows: beforeCnt[0].count,
        rowsRemaining: afterCnt[0].count,
        autoIncrementNext: autoVal[0]?.AUTO_INCREMENT ?? 1,
      });
    }
    console.table(resetResults);

    // 4. Reset AUTO_INCREMENT on lookup tables where appropriate
    console.log("\n🔹 4. Normalizing Auto-Increment Counters on Lookup Tables...");
    await connection.query("ALTER TABLE dim_categories AUTO_INCREMENT = 13");
    await connection.query("ALTER TABLE dim_roles AUTO_INCREMENT = 7");

    // 5. Restore FK checks
    console.log("\n🔹 5. Restoring Foreign Key Enforcement...");
    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

    // 6. Re-seed required System Administrator accounts
    console.log("\n🔹 6. Re-seeding System Administrator Accounts...");
    const adminPasswordHash = await bcrypt.hash("Admin@12345", 10);
    
    await connection.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, latitude, longitude, is_active, status, approved_at)
       VALUES (?, 'admin', 'admin@foodsaver.com', ?, 'System Admin', '+91 98765 00000', 9.1724, 77.8694, TRUE, 'APPROVED', NOW())
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'APPROVED', role_id = 'admin'`,
      ["admin-1", adminPasswordHash]
    );

    // 7. Verify preserved tables and final state
    console.log("\n🔹 7. Post-Reset Inspection & Verification...");
    const postResetStats = [];
    for (const row of allTables) {
      const name = row[tableNameKey];
      const [cnt] = await connection.query(`SELECT COUNT(*) as count FROM \`${name}\``);
      const [auto] = await connection.query(
        "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [name]
      );
      postResetStats.push({
        table: name,
        category: PRESERVED_LOOKUP_TABLES.includes(name) ? "PRESERVED LOOKUP" : (name === "dim_users" ? "ADMIN ONLY" : "APPLICATION DATA"),
        rowsAfter: cnt[0].count,
        autoIncrement: auto[0]?.AUTO_INCREMENT ?? "N/A",
      });
    }
    console.table(postResetStats);

    // 8. Foreign Key Integrity Check
    console.log("\n🔹 8. Verifying Foreign Key Enforcement...");
    let fkVerificationPassed = false;
    try {
      // Attempt invalid insert referencing non-existent user_id
      await connection.query(
        `INSERT INTO dim_verification_applications (application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name)
         VALUES ('invalid_app', 'non_existent_user_9999', 'Fake Business', 'merchant', 'Food', 'REG123', 'PDF', 'doc.pdf')`
      );
    } catch (fkErr) {
      if (fkErr.code === "ER_NO_REFERENCED_ROW_2" || fkErr.code === "ER_NO_REFERENCED_ROW") {
        fkVerificationPassed = true;
        console.log("✅ Foreign key enforcement verified: Invalid child insertion blocked as expected (ER_NO_REFERENCED_ROW_2).");
      } else {
        console.warn("Unexpected FK test error:", fkErr);
      }
    }

    if (!fkVerificationPassed) {
      throw new Error("Foreign Key enforcement verification failed!");
    }

    console.log("\n=================================================");
    console.log("🎉 DATABASE DATA RESET SUCCESSFULLY COMPLETED!");
    console.log("=================================================\n");

    return {
      success: true,
      preResetStats,
      postResetStats,
      resetResults,
    };
  } catch (error) {
    console.error("❌ Error during database data reset:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  runResetData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runResetData };
