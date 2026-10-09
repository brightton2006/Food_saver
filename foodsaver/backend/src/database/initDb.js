const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

async function seedDateDimension(connection) {
  const [rows] = await connection.query("SELECT COUNT(*) as count FROM dim_date");
  if (rows[0].count > 0) return;

  console.log("🌱 Populating dim_date dimension table...");
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const startDate = new Date("2025-01-01");
  const endDate = new Date("2027-12-31");

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dayOfWeek = d.getDay() + 1;
    const dayName = dayNames[d.getDay()];
    const monthName = monthNames[d.getMonth()];
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    const dateKey = year * 10000 + month * 100 + day;
    const fullDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    await connection.query(
      `INSERT INTO dim_date (date_key, full_date, day_of_week, day_name, day_of_month, month, month_name, quarter, year, is_weekend)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE full_date = VALUES(full_date)`,
      [dateKey, fullDate, dayOfWeek, dayName, day, month, monthName, quarter, year, isWeekend]
    );
  }
}

async function seedTimeDimension(connection) {
  const [rows] = await connection.query("SELECT COUNT(*) as count FROM dim_time");
  if (rows[0].count > 0) return;

  console.log("🌱 Populating dim_time dimension table...");
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute++) {
      const timeKey = hour * 100 + minute;
      const fullTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
      const timeOfDay =
        hour < 6 ? "Night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 22 ? "Evening" : "Night";

      await connection.query(
        `INSERT INTO dim_time (time_key, full_time, hour, minute, second, time_of_day)
         VALUES (?, ?, ?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE full_time = VALUES(full_time)`,
        [timeKey, fullTime, hour, minute, timeOfDay]
      );
    }
  }
}

async function initializeDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Read & Execute Schema SQL
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    const sqlStatements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of sqlStatements) {
      try {
        await connection.query(statement);
      } catch (stmtErr) {
        if (stmtErr.code !== "ER_DUP_KEYNAME" && stmtErr.code !== "ER_DUP_FIELDNAME") {
          console.warn("Schema statement note:", stmtErr.message);
        }
      }
    }

    // Dynamic Schema Alteration check for status columns on dim_users
    const [cols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dim_users' AND COLUMN_NAME = 'status'"
    );
    await connection.query(`
      ALTER TABLE dim_users
      MODIFY COLUMN status ENUM('DRAFT', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'PENDING' NOT NULL
    `);

    // Dynamic Schema Alteration check for extended merchant columns on dim_hotels
    const [hCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dim_hotels' AND COLUMN_NAME = 'business_type'"
    );
    if (hCols.length === 0) {
      console.log("🛠️ Migrating dim_hotels schema to include merchant onboarding profile columns...");
      await connection.query(`
        ALTER TABLE dim_hotels
        ADD COLUMN business_type ENUM('Restaurant', 'Hotel', 'Café', 'Bakery', 'Cloud Kitchen', 'Bar', 'Other') DEFAULT 'Restaurant',
        ADD COLUMN year_established INT NULL,
        ADD COLUMN seating_capacity INT DEFAULT 0,
        ADD COLUMN food_type ENUM('Vegetarian', 'Non-Vegetarian', 'Both') DEFAULT 'Both',
        ADD COLUMN delivery_available BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN takeaway_available BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN dine_in_available BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN weekly_closed_day VARCHAR(20) DEFAULT 'None',
        ADD COLUMN average_preparation_time INT DEFAULT 20,
        ADD COLUMN minimum_order_amount DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN delivery_radius DECIMAL(5,2) DEFAULT 5.00,
        ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN facilities_amenities TEXT,
        ADD COLUMN status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'APPROVED' NOT NULL
      `);
    }

    // Dynamic Schema Alteration check for extended NGO columns on dim_ngos
    const [ngoCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dim_ngos' AND COLUMN_NAME = 'organization_type'"
    );
    if (ngoCols.length === 0) {
      console.log("🛠️ Migrating dim_ngos schema to include NGO onboarding profile columns...");
      await connection.query(`
        ALTER TABLE dim_ngos
        ADD COLUMN organization_type ENUM('Trust', 'Society', 'Section 8 Company', 'Non-Profit', 'Other') DEFAULT 'Trust',
        ADD COLUMN registration_number VARCHAR(100) NULL,
        ADD COLUMN year_established INT NULL,
        ADD COLUMN description TEXT NULL,
        ADD COLUMN website VARCHAR(255) NULL,
        ADD COLUMN rejection_reason TEXT NULL,
        ADD COLUMN status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'APPROVED' NOT NULL
      `);
    }

    // Dynamic Schema Alteration check for status column on fact_claims to support verification lifecycle
    await connection.query(`
      ALTER TABLE fact_claims
      MODIFY COLUMN status ENUM(
        'PENDING', 'ORDER_PLACED', 'CONFIRMED', 'ORDER_CONFIRMED',
        'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP',
        'TOKEN_VERIFIED', 'CUSTOMER_ON_THE_WAY', 'CUSTOMER_ARRIVED', 'PICKED_UP',
        'COMPLETED', 'DELIVERED', 'CANCELLED', 'collected', 'rerouted_to_ngo'
      ) DEFAULT 'PENDING' NOT NULL
    `);

    // Dynamic Schema Alteration check for verification audit columns on fact_claims
    const [vCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fact_claims' AND COLUMN_NAME = 'verified_at'"
    );
    if (vCols.length === 0) {
      console.log("🛠️ Migrating fact_claims schema to include verification audit columns...");
      await connection.query(`
        ALTER TABLE fact_claims
        ADD COLUMN verified_at TIMESTAMP NULL,
        ADD COLUMN verified_by VARCHAR(50) NULL,
        ADD COLUMN verification_method ENUM('TOKEN', 'QR') NULL
      `);
    }

    // Dynamic Schema Alteration check for live tracking columns on fact_claims
    const [cCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fact_claims' AND COLUMN_NAME = 'tracking_active'"
    );
    if (cCols.length === 0) {
      console.log("🛠️ Migrating fact_claims schema to include real-time tracking columns...");
      await connection.query(`
        ALTER TABLE fact_claims
        ADD COLUMN tracking_active BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN tracking_started_at TIMESTAMP NULL,
        ADD COLUMN tracking_ended_at TIMESTAMP NULL,
        ADD COLUMN last_latitude DECIMAL(10,8) NULL,
        ADD COLUMN last_longitude DECIMAL(11,8) NULL,
        ADD COLUMN last_location_updated_at TIMESTAMP NULL
      `);
    }

    // Dynamic Schema Alteration check for tracking_sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tracking_sessions (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL UNIQUE,
        merchant_id VARCHAR(50) NOT NULL,
        customer_id VARCHAR(50) NULL,
        status ENUM('ACTIVE', 'STOPPED') DEFAULT 'STOPPED' NOT NULL,
        started_at TIMESTAMP NULL,
        ended_at TIMESTAMP NULL,
        last_latitude DECIMAL(10,8) NULL,
        last_longitude DECIMAL(11,8) NULL,
        last_accuracy DECIMAL(8,2) NULL,
        last_updated_at TIMESTAMP NULL,
        INDEX idx_ts_order (order_id),
        INDEX idx_ts_merchant (merchant_id),
        INDEX idx_ts_status (status)
      )
    `);

    // Dynamic Schema Alteration check for image_url column on fact_listings
    const [lImgCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fact_listings' AND COLUMN_NAME = 'image_url'"
    );
    if (lImgCols.length === 0) {
      console.log("🛠️ Migrating fact_listings schema to include image_url column...");
      await connection.query(`
        ALTER TABLE fact_listings
        ADD COLUMN image_url TEXT NULL
      `);
    }

    // Dynamic Schema Alteration check for Night-Time Flash Sale columns on fact_listings
    const [nightCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fact_listings' AND COLUMN_NAME = 'is_night_sale'"
    );
    if (nightCols.length === 0) {
      console.log("🛠️ Migrating fact_listings schema to include Night-Time Flash Sale columns...");
      await connection.query(`
        ALTER TABLE fact_listings
        ADD COLUMN is_night_sale BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN sale_window_start TIME DEFAULT '18:00:00',
        ADD COLUMN sale_window_end TIME DEFAULT '23:00:00',
        ADD COLUMN collection_deadline TIMESTAMP NULL,
        ADD COLUMN delivery_supported BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN safe_storage_info VARCHAR(255) DEFAULT 'Temperature-controlled counter',
        ADD COLUMN food_prep_time VARCHAR(100) DEFAULT 'Fresh daily surplus',
        ADD COLUMN food_safety_approved BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN eligible_for_ngo BOOLEAN DEFAULT TRUE NOT NULL
      `);
    }

    // Ensure status on fact_listings includes 'paused'
    await connection.query(`
      ALTER TABLE fact_listings
      MODIFY COLUMN status ENUM('draft', 'active', 'paused', 'soldout', 'expired_donatable', 'rescued', 'cancelled') DEFAULT 'active' NOT NULL
    `).catch(() => {});

    // Re-create backward compatibility listings VIEW to include image_url and Night-Sale columns
    await connection.query(
      `CREATE OR REPLACE VIEW listings AS SELECT 
        listing_fact_id, listing_id, hotel_id, hotel_key, menu_item_id, menu_item_key, item_name, description, 
        category_id, category_key, is_veg, original_price, discount_price, quantity_total, quantity_available, 
        address, latitude, longitude, image_url, pickup_window_start, pickup_window_end, status, notified_ngo, 
        date_key, time_key, created_at, expires_at,
        is_night_sale, sale_window_start, sale_window_end, collection_deadline, delivery_supported, 
        safe_storage_info, food_prep_time, food_safety_approved, eligible_for_ngo 
       FROM fact_listings`
    );

    // Populate missing images on existing listings using curated food photos
    await connection.query(`
      UPDATE fact_listings SET image_url = CASE
        WHEN LOWER(item_name) LIKE '%idli%' OR LOWER(item_name) LIKE '%idly%' THEN 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%dosa%' OR LOWER(item_name) LIKE '%dosai%' THEN 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%biryani%' OR LOWER(item_name) LIKE '%biriyani%' THEN 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%vada%' OR LOWER(item_name) LIKE '%vadai%' THEN 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%parotta%' OR LOWER(item_name) LIKE '%kothu%' THEN 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%paneer%' THEN 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%chicken%' THEN 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%meal%' OR LOWER(item_name) LIKE '%thali%' THEN 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%pastry%' OR LOWER(item_name) LIKE '%cake%' OR LOWER(item_name) LIKE '%dessert%' THEN 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1000&q=80'
        WHEN LOWER(item_name) LIKE '%coffee%' OR LOWER(item_name) LIKE '%tea%' THEN 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1000&q=80'
        ELSE 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80'
      END
      WHERE image_url IS NULL OR image_url = ''
    `).catch(() => {});

    // Re-create backward compatibility claims VIEW to include verification & tracking fields
    await connection.query(
      `CREATE OR REPLACE VIEW claims AS SELECT claim_fact_id, claim_id, claim_token, listing_id, listing_fact_id, customer_user_id, customer_user_key, claim_method, quantity, unit_price, price_paid, status, verified_at, verified_by, verification_method, tracking_active, tracking_started_at, tracking_ended_at, last_latitude, last_longitude, last_location_updated_at, date_key, time_key, claimed_at, collected_at, rerouted_at FROM fact_claims`
    );

    // Dynamic Schema Alteration check for communication, multilingual & theme preferences on dim_users
    const [uPrefCols] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dim_users' AND COLUMN_NAME = 'preferred_language'"
    );
    if (uPrefCols.length === 0) {
      console.log("🛠️ Migrating dim_users schema to include language, theme and notification preferences...");
      await connection.query(`
        ALTER TABLE dim_users
        ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN phone_verified_at TIMESTAMP NULL,
        ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL,
        ADD COLUMN preferred_theme VARCHAR(50) DEFAULT 'forest_green' NOT NULL,
        ADD COLUMN custom_theme_config JSON NULL,
        ADD COLUMN notification_preferences JSON NULL
      `);
    }

    // Dynamic Schema creation for communication_events table (idempotency, retry tracking, email/sms delivery logs)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS communication_events (
        event_id VARCHAR(100) PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(50) NULL,
        recipient VARCHAR(255) NOT NULL,
        channel ENUM('EMAIL', 'SMS', 'IN_APP') NOT NULL,
        status ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') DEFAULT 'PENDING' NOT NULL,
        attempts INT DEFAULT 1 NOT NULL,
        last_error TEXT NULL,
        payload JSON NULL,
        sent_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_comm_ref (reference_id),
        INDEX idx_comm_status (status),
        INDEX idx_comm_type (event_type)
      )
    `);

    // Dynamic Schema creation for otp_verifications table (SMS OTP verification)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id VARCHAR(50) PRIMARY KEY,
        phone_number VARCHAR(30) NOT NULL,
        user_id VARCHAR(50) NULL,
        otp_hash VARCHAR(255) NOT NULL,
        purpose VARCHAR(50) DEFAULT 'PHONE_VERIFICATION' NOT NULL,
        attempts INT DEFAULT 0 NOT NULL,
        max_attempts INT DEFAULT 3 NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_otp_phone (phone_number, is_verified, expires_at)
      )
    `);

    // Re-create backward compatibility users VIEW to include new preference and verification columns
    await connection.query(
      `CREATE OR REPLACE VIEW users AS SELECT user_key, user_id, role_id, email, password_hash, full_name, phone_number, phone_verified, phone_verified_at, preferred_language, preferred_theme, custom_theme_config, notification_preferences, latitude, longitude, location_updated_at, is_active, status, approved_at, rejected_at, approved_by, rejected_by, created_at, updated_at FROM dim_users`
    );

    console.log("✅ Star Schema database DDL, Views & Live Tracking tables verified successfully");

    // 2. Populate Date and Time Dimensions
    await seedDateDimension(connection);
    await seedTimeDimension(connection);

    // 3. Seed Initial Roles if missing
    const roles = [
      ["admin", "Platform Administrator"],
      ["user", "Normal User"],
      ["shop_owner", "Shop Owner"],
      ["merchant", "Hotel and Restaurant Merchant"],
      ["customer", "End Consumer"],
      ["ngo", "Non-Governmental Organization / Food Bank"],
    ];

    for (const [roleId, desc] of roles) {
      await connection.query(
        "INSERT INTO dim_roles (role_id, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description)",
        [roleId, desc]
      );
    }

    // 4. Seed App Settings
    const defaultSettings = [
      ["nearby_food_radius_km", "2.0", "Radius in km for customer nearby food discovery and notifications"],
      ["ngo_donation_radius_km", "5.0", "Radius in km for NGO unsold food donation discovery"],
      ["tracking_interval_sec", "5", "Interval in seconds for live order location tracking"],
    ];

    for (const [key, val, desc] of defaultSettings) {
      await connection.query(
        "INSERT INTO dim_app_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [key, val, desc]
      );
    }

    // 5. Seed Categories
    const categories = [
      "Indian",
      "South Indian",
      "North Indian",
      "Biryani",
      "Breakfast",
      "Meals",
      "Snacks",
      "Beverages",
      "Desserts",
      "Fast Food",
      "Main Course",
      "Starters",
    ];

    let catId = 1;
    for (const cat of categories) {
      await connection.query(
        "INSERT INTO dim_categories (category_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)",
        [catId++, cat]
      );
    }

    // 6. Seed Default Administrator Account
    const adminPasswordHash = await bcrypt.hash("Admin@12345", 10);

    await connection.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, latitude, longitude, is_active, status, approved_at)
       VALUES (?, 'admin', 'admin@foodsaver.com', ?, 'System Administrator', '+91 98765 00000', 9.1724, 77.8694, TRUE, 'APPROVED', NOW())
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         status = 'APPROVED',
         role_id = 'admin',
         full_name = VALUES(full_name),
         latitude = VALUES(latitude),
         longitude = VALUES(longitude),
         is_active = TRUE`,
      ["admin-1", adminPasswordHash]
    );

    // 9. Ensure recently_accessed and audit_logs tables exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS recently_accessed (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        entity_type ENUM('food', 'merchant', 'order', 'donation', 'page', 'admin_tool') NOT NULL,
        entity_id VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        url VARCHAR(255) NOT NULL,
        metadata JSON NULL,
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ra_user (user_id, accessed_at),
        UNIQUE KEY uk_user_entity (user_id, entity_type, entity_id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100) NULL,
        metadata JSON NULL,
        ip_address VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_action (action),
        INDEX idx_audit_created (created_at)
      )
    `);

    console.log("✅ Star Schema database initialization completed successfully.");
    const { runMigration } = require("./migrations/v2_production_upgrade");
    await runMigration();
    const { migrateDirectorySchema } = require("./migrate_directory_schema");
    await migrateDirectorySchema();
    const { seedRealKovilpattiBusinesses } = require("./seed_kovilpatti_directory_20");
    await seedRealKovilpattiBusinesses();
    const { integrateAllDistrictHotels } = require("./integrate_all_district_hotels");
    await integrateAllDistrictHotels();
    const { setHotelCredentials } = require("./set_all_hotel_credentials");
    await setHotelCredentials();
    const { addFoodsToAllHotels } = require("./add_foods_to_all_hotels");
    await addFoodsToAllHotels();
    const { addNightSaleSpecialToAllHotels } = require("./add_night_sale_special_to_all_hotels");
    await addNightSaleSpecialToAllHotels();
    const { completeAndApproveAllHotels } = require("./complete_all_hotel_verifications");
    await completeAndApproveAllHotels();
    const { seedAllNgos } = require("./seed_all_ngos");
    await seedAllNgos();
  } catch (error) {
    console.error("❌ Error initializing Star Schema MySQL database:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { initializeDatabase };

