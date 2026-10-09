require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "foodsaver",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true, // Allow executing multi-statement DDL/seed scripts
});

const { ensureMySQLRunning } = require("../database/start_mysql");

async function testConnection(retries = 3) {
  let connection;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connection = await pool.getConnection();
      await connection.query("SELECT 1");
      console.log("✅ MySQL connected successfully");
      return true;
    } catch (error) {
      if (attempt === 1 && (error.code === "ECONNREFUSED" || error.code === "PROTOCOL_CONNECTION_LOST")) {
        console.warn(`⚠️ Connection failed (${error.code}). Attempting to start local MySQL server...`);
        await ensureMySQLRunning();
      }
      if (attempt < retries) {
        console.warn(`⚠️ MySQL connection attempt ${attempt}/${retries} failed (${error.message}). Retrying in 1.5s...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        console.error("❌ MySQL connection failed after retries:", error.message);
        console.error("👉 Please ensure MySQL service (e.g. MySQL80) is started or run: npm run db:start");
        throw error;
      }
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
}

module.exports = {
  pool,
  testConnection,
};
