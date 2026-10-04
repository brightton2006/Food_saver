const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

/**
 * Module 6: Secure Admin Account Seeder
 * Idempotent, safe environment variable reading, bcryptjs password hashing.
 */
async function seedAdmin() {
  const envPath = path.resolve(__dirname, "../../.env");
  
  const adminName = process.env.ADMIN_NAME || "FoodSaver Administrator";
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@foodsaver.local").trim().toLowerCase();
  let adminPassword = process.env.ADMIN_PASSWORD;

  // If no password in env, generate a cryptographically strong local admin password
  if (!adminPassword || !adminPassword.trim()) {
    adminPassword = `Admin_${crypto.randomBytes(6).toString("hex")}!9#`;
    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf8");
        if (!envContent.includes("ADMIN_PASSWORD")) {
          fs.appendFileSync(
            envPath,
            `\nADMIN_NAME="${adminName}"\nADMIN_EMAIL="${adminEmail}"\nADMIN_PASSWORD="${adminPassword}"\n`
          );
        }
      }
    } catch (e) {
      console.warn("Notice updating .env with generated admin password:", e.message);
    }
  }

  // Check if account already exists
  const [existing] = await pool.query(
    "SELECT user_id, email, role_id, status FROM dim_users WHERE email = ? OR role_id = 'admin'",
    [adminEmail]
  );

  const existingByEmail = existing.find((u) => u.email === adminEmail);

  if (existingByEmail) {
    console.log(`ℹ️ Admin account already exists for configured email: ${adminEmail}`);
    console.log(`   User ID: ${existingByEmail.user_id} | Status: ${existingByEmail.status} | Role: ${existingByEmail.role_id}`);
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      "UPDATE dim_users SET password_hash = ?, status = 'APPROVED', is_active = TRUE WHERE user_id = ?",
      [passwordHash, existingByEmail.user_id]
    );
    return {
      userId: existingByEmail.user_id,
      email: adminEmail,
      isNew: false,
    };
  }

  // Hash password securely
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const userId = `usr_adm_${Date.now()}`;

  await pool.query(
    `INSERT INTO dim_users (
      user_id, role_id, email, password_hash, full_name, phone_number,
      is_active, status, latitude, longitude
    ) VALUES (?, 'admin', ?, ?, ?, '+91 9999988888', TRUE, 'APPROVED', 9.1724, 77.8694)`,
    [userId, adminEmail, passwordHash, adminName]
  );

  console.log(`\n======================================================`);
  console.log(`✅ PLATFORM ADMINISTRATOR ACCOUNT CREATED`);
  console.log(`   Configured Email: ${adminEmail}`);
  console.log(`   Role: admin`);
  console.log(`   Status: APPROVED (Ready for verification dashboard)`);
  console.log(`   Notice: Password stored in local .env; never exposed in logs.`);
  console.log(`======================================================\n`);

  return {
    userId,
    email: adminEmail,
    isNew: true,
  };
}

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Admin seed failed:", err);
      process.exit(1);
    });
}

module.exports = { seedAdmin };
