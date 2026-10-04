const { pool } = require("../config/database");

/**
 * Migration script to support:
 * 1. Unclaimed Directory Businesses
 * 2. Real Location Verification Tracking (location_status, location_source, location_verified_at)
 * 3. Hotel Ownership Claim Lifecycle (claim_status, claimed_by_merchant_id, claim_documents)
 * 4. Partner Status (unverified, pending_approval, verified, rejected, suspended)
 */
async function migrateDirectorySchema() {
  console.log("🛠️ Checking schema for directory hotels and location verification...");
  
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dim_hotels' AND COLUMN_NAME = 'location_status'"
  );

  if (cols.length === 0) {
    console.log("Adding directory, location verification, and claim columns to dim_hotels...");
    await pool.query(`
      ALTER TABLE dim_hotels
      MODIFY COLUMN merchant_user_id VARCHAR(50) NULL,
      ADD COLUMN location_status ENUM('verified', 'location_pending') DEFAULT 'location_pending',
      ADD COLUMN location_source VARCHAR(100) DEFAULT 'nominatim',
      ADD COLUMN location_verified_at TIMESTAMP NULL,
      ADD COLUMN partner_status ENUM('unverified', 'pending_approval', 'verified', 'rejected', 'suspended') DEFAULT 'unverified',
      ADD COLUMN district VARCHAR(100) DEFAULT 'Thoothukudi',
      ADD COLUMN pincode VARCHAR(20) DEFAULT '628501',
      ADD COLUMN is_directory_listing BOOLEAN DEFAULT FALSE,
      ADD COLUMN claimed_by_merchant_id VARCHAR(50) NULL,
      ADD COLUMN claim_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none',
      ADD COLUMN claim_documents TEXT NULL,
      ADD COLUMN claim_requested_at TIMESTAMP NULL
    `);
    console.log("✅ Columns added successfully to dim_hotels!");
  } else {
    console.log("ℹ️ Columns already exist on dim_hotels.");
  }

  // Update existing approved merchants to partner_status = 'verified', location_status = 'verified'
  await pool.query(`
    UPDATE dim_hotels 
    SET partner_status = 'verified', 
        location_status = 'verified',
        location_source = 'verified_onboarding',
        location_verified_at = NOW()
    WHERE status = 'APPROVED' AND verification_status = 'approved' AND (partner_status = 'unverified' OR partner_status IS NULL)
  `);

  // Ensure fact_listings supports 'draft' status
  try {
    await pool.query(`
      ALTER TABLE fact_listings 
      MODIFY COLUMN status ENUM('draft', 'active', 'soldout', 'expired_donatable', 'rescued', 'cancelled') NOT NULL DEFAULT 'active'
    `);
    console.log("✅ fact_listings status enum updated to include 'draft'.");
  } catch (e) {
    console.warn("Notice updating fact_listings status enum:", e.message);
  }

  console.log("✅ Schema migration complete.");
}

if (require.main === module) {
  migrateDirectorySchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}

module.exports = { migrateDirectorySchema };
