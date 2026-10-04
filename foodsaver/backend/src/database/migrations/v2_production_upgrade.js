/**
 * V2 Production Upgrade Migration
 * Safe & Idempotent Migration: Alters existing tables non-destructively
 * and creates new required tables/indexes for Day/Night Mode, Razorpay, Reviews, Addresses & PWA.
 */
const { pool } = require("../../config/database");

async function runMigration() {
  console.log("🚀 Starting V2 Production Database Migration...");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Add must_change_password to dim_users
    const [userCols] = await connection.query("SHOW COLUMNS FROM dim_users LIKE 'must_change_password'");
    if (userCols.length === 0) {
      console.log("➕ Adding `must_change_password` to dim_users");
      await connection.query(
        "ALTER TABLE dim_users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE NOT NULL"
      );
    }

    // Flag demo hotel owners with default password so they get forced reset
    await connection.query(
      `UPDATE dim_users SET must_change_password = TRUE WHERE role_id = 'merchant'`
    );

    // 2. Add Day/Night mode settings to dim_hotels
    const [hotelCols] = await connection.query("SHOW COLUMNS FROM dim_hotels LIKE 'night_sale_start_time'");
    if (hotelCols.length === 0) {
      console.log("➕ Adding Day/Night mode columns to dim_hotels");
      await connection.query(`
        ALTER TABLE dim_hotels 
        ADD COLUMN night_sale_start_time TIME DEFAULT '18:00:00',
        ADD COLUMN night_sale_end_time TIME DEFAULT '23:00:00',
        ADD COLUMN auto_rescue_enabled BOOLEAN DEFAULT TRUE NOT NULL
      `);
    }

    // 3. Upgrade fact_claims to support Day Mode orders & Razorpay
    const [claimCols] = await connection.query("SHOW COLUMNS FROM fact_claims LIKE 'order_mode'");
    if (claimCols.length === 0) {
      console.log("➕ Upgrading `fact_claims` table with order_mode, payment & token fields");
      await connection.query(`
        ALTER TABLE fact_claims
        ADD COLUMN order_mode ENUM('DAY', 'NIGHT') DEFAULT 'NIGHT' NOT NULL,
        ADD COLUMN payment_method ENUM('RAZORPAY', 'PAY_AT_COUNTER') DEFAULT 'PAY_AT_COUNTER' NOT NULL,
        ADD COLUMN payment_status ENUM('PENDING', 'PAID', 'PAY_AT_COUNTER', 'FAILED') DEFAULT 'PENDING' NOT NULL,
        ADD COLUMN razorpay_order_id VARCHAR(100) NULL,
        ADD COLUMN razorpay_payment_id VARCHAR(100) NULL,
        ADD COLUMN pickup_token VARCHAR(20) NULL,
        ADD COLUMN qr_code_url TEXT NULL,
        ADD COLUMN hotel_id VARCHAR(50) NULL,
        ADD COLUMN menu_item_id VARCHAR(50) NULL
      `);
    }

    // 4. Create dim_user_addresses
    console.log("➕ Ensuring `dim_user_addresses` table exists");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS dim_user_addresses (
        address_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        label VARCHAR(50) DEFAULT 'Home',
        address_line TEXT NOT NULL,
        city VARCHAR(100) DEFAULT 'Kovilpatti',
        district VARCHAR(100) DEFAULT 'Thoothukudi',
        pincode VARCHAR(20),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
        INDEX idx_addr_user (user_id)
      )
    `);

    // 5. Create fact_reviews
    console.log("➕ Ensuring `fact_reviews` table exists");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS fact_reviews (
        review_id VARCHAR(50) PRIMARY KEY,
        claim_id VARCHAR(50) NOT NULL,
        hotel_id VARCHAR(50) NOT NULL,
        customer_user_id VARCHAR(50) NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claim_id) REFERENCES fact_claims(claim_id) ON DELETE CASCADE,
        FOREIGN KEY (hotel_id) REFERENCES dim_hotels(hotel_id) ON DELETE CASCADE,
        FOREIGN KEY (customer_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
        INDEX idx_rev_hotel (hotel_id),
        INDEX idx_rev_user (customer_user_id)
      )
    `);

    // 6. Create push_subscriptions for PWA Web Push
    console.log("➕ Ensuring `push_subscriptions` table exists");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        sub_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
        INDEX idx_push_user (user_id)
      )
    `);

    // 7. Add key performance indexes safely
    console.log("➕ Creating performance indexes...");
    const tryCreateIndex = async (tableName, indexName, sql) => {
      const [indexes] = await connection.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = '${indexName}'`);
      if (indexes.length === 0) {
        await connection.query(sql);
      }
    };

    await tryCreateIndex('dim_hotels', 'idx_dh_city', 'CREATE INDEX idx_dh_city ON dim_hotels(location_city)');
    await tryCreateIndex('fact_listings', 'idx_fl_status_exp', 'CREATE INDEX idx_fl_status_exp ON fact_listings(status, expires_at)');
    await tryCreateIndex('fact_claims', 'idx_fc_status_user', 'CREATE INDEX idx_fc_status_user ON fact_claims(status, customer_user_id)');
    await tryCreateIndex('dim_menu_items', 'idx_dmi_hotel_veg', 'CREATE INDEX idx_dmi_hotel_veg ON dim_menu_items(hotel_id, is_veg)');

    await connection.commit();
    console.log("✅ V2 Migration completed successfully with ZERO data loss!");
  } catch (err) {
    await connection.rollback();
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
