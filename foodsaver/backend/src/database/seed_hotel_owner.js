const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

/**
 * Module 5: Secure Initial Hotel Owner Account Seeder
 * Idempotent, safe environment variable reading, password hashing with bcryptjs.
 */
async function seedHotelOwner() {
  const envPath = path.resolve(__dirname, "../../.env");
  
  const ownerName = process.env.HOTEL_OWNER_NAME || "FoodSaver Owner (Dev)";
  const ownerEmail = (process.env.HOTEL_OWNER_EMAIL || "owner@foodsaver.local").trim().toLowerCase();
  let ownerPassword = process.env.HOTEL_OWNER_PASSWORD;

  // If no password in env, generate a cryptographically strong local development password
  if (!ownerPassword || !ownerPassword.trim()) {
    ownerPassword = `DevOwner_${crypto.randomBytes(6).toString("hex")}!9`;
    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        if (!envContent.includes("HOTEL_OWNER_PASSWORD")) {
          fs.appendFileSync(
            envPath,
            `\nHOTEL_OWNER_NAME="${ownerName}"\nHOTEL_OWNER_EMAIL="${ownerEmail}"\nHOTEL_OWNER_PASSWORD="${ownerPassword}"\n`
          );
        }
      }
    } catch (e) {
      console.warn("Notice updating .env with generated owner password:", e.message);
    }
  }

  // Check if account already exists
  const [existing] = await pool.query(
    "SELECT user_id, email, role_id, status FROM dim_users WHERE email = ?",
    [ownerEmail]
  );

  if (existing.length > 0) {
    console.log(`ℹ️ Hotel Owner account already exists for configured email: ${ownerEmail}`);
    console.log(`   User ID: ${existing[0].user_id} | Status: ${existing[0].status} | Role: ${existing[0].role_id}`);
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    await pool.query(
      "UPDATE dim_users SET password_hash = ?, status = 'APPROVED', is_active = TRUE WHERE user_id = ?",
      [passwordHash, existing[0].user_id]
    );
    return {
      userId: existing[0].user_id,
      email: ownerEmail,
      isNew: false,
    };
  }

  // Hash password securely
  const passwordHash = await bcrypt.hash(ownerPassword, 10);
  const userId = `usr_own_${Date.now()}`;

  await pool.query(
    `INSERT INTO dim_users (
      user_id, role_id, email, password_hash, full_name, phone_number,
      is_active, status, latitude, longitude
    ) VALUES (?, 'merchant', ?, ?, ?, '+91 9876543210', TRUE, 'APPROVED', 9.1724, 77.8694)`,
    [userId, ownerEmail, passwordHash, ownerName]
  );

  console.log(`\n======================================================`);
  console.log(`✅ INITIAL HOTEL OWNER ACCOUNT CREATED`);
  console.log(`   Configured Email: ${ownerEmail}`);
  console.log(`   Role: merchant`);
  console.log(`   Status: APPROVED (Ready for hotel management)`);
  console.log(`   Notice: Password stored in local .env; never exposed in logs.`);
  console.log(`======================================================\n`);

  return {
    userId,
    email: ownerEmail,
    isNew: true,
  };
}

if (require.main === module) {
  seedHotelOwner()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Hotel owner seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedHotelOwner };
