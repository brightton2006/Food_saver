const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function initAdminDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  });

  try {
    console.log("⏳ Initializing separate Admin Database (foodsaver_admin_db)...");
    const sqlPath = path.join(__dirname, "admin_database_schema.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    await connection.query(sqlContent);
    console.log("✅ Separate Admin Database and tables created successfully!");

    const [tables] = await connection.query("SHOW TABLES FROM `foodsaver_admin_db`");
    console.log("\n📊 Tables in foodsaver_admin_db:");
    console.table(tables);
  } catch (error) {
    console.error("❌ Error initializing admin database:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initAdminDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initAdminDatabase };
