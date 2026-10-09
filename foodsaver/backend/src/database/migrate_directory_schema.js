const { pool } = require("../config/database");

/**
 * Migration script to support:
 * 1. Unclaimed Directory Businesses across all Tamil Nadu Districts
 * 2. Real Location Verification Tracking (location_status, location_source, location_verified_at)
 * 3. Hotel Ownership Claim Lifecycle (claim_status, claimed_by_merchant_id, claim_documents)
 * 4. Partner Status (unverified, pending_approval, verified, rejected, suspended)
 */
async function addColumnIfNotExists(table, column, definition) {
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  if (cols.length === 0) {
    console.log(`➕ Adding missing column ${column} to ${table}...`);
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function migrateDirectorySchema() {
  console.log("🛠️ Checking schema for directory hotels and location verification...");
  
  // Make merchant_user_id nullable for directory hotels
  try {
    await pool.query("ALTER TABLE dim_hotels MODIFY COLUMN merchant_user_id VARCHAR(50) NULL");
  } catch (e) {
    console.warn("Notice updating merchant_user_id nullability:", e.message);
  }

  await addColumnIfNotExists("dim_hotels", "location_status", "ENUM('verified', 'location_pending') DEFAULT 'location_pending'");
  await addColumnIfNotExists("dim_hotels", "location_source", "VARCHAR(100) DEFAULT 'nominatim'");
  await addColumnIfNotExists("dim_hotels", "location_verified_at", "TIMESTAMP NULL");
  await addColumnIfNotExists("dim_hotels", "partner_status", "ENUM('unverified', 'pending_approval', 'verified', 'rejected', 'suspended') DEFAULT 'unverified'");
  await addColumnIfNotExists("dim_hotels", "district", "VARCHAR(100) DEFAULT 'Thoothukudi'");
  await addColumnIfNotExists("dim_hotels", "pincode", "VARCHAR(20) DEFAULT '628501'");
  await addColumnIfNotExists("dim_hotels", "is_directory_listing", "BOOLEAN DEFAULT FALSE");
  await addColumnIfNotExists("dim_hotels", "claimed_by_merchant_id", "VARCHAR(50) NULL");
  await addColumnIfNotExists("dim_hotels", "claim_status", "ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none'");
  await addColumnIfNotExists("dim_hotels", "claim_documents", "TEXT NULL");
  await addColumnIfNotExists("dim_hotels", "claim_requested_at", "TIMESTAMP NULL");
  await addColumnIfNotExists("dim_hotels", "delivery_available", "BOOLEAN DEFAULT TRUE");
  await addColumnIfNotExists("dim_hotels", "takeaway_available", "BOOLEAN DEFAULT TRUE");

  // Re-create views so they include the new columns
  try {
    await pool.query(`
      CREATE OR REPLACE VIEW hotels AS
      SELECT 
        hotel_id, merchant_user_id, hotel_name, description, address, location_city, district, pincode,
        contact_number, cuisine, opening_hours, logo_url, cover_image_url, rating, verification_status,
        status, rejection_reason, latitude, longitude, created_at, updated_at,
        partner_status, is_directory_listing, location_status, location_source, location_verified_at,
        claimed_by_merchant_id, claim_status, claim_documents, claim_requested_at, delivery_available, takeaway_available
      FROM dim_hotels
    `);
    console.log("✅ hotels view re-created successfully with district column.");
  } catch (e) {
    console.warn("Notice updating hotels view:", e.message);
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
