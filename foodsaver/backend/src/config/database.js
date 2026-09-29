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

async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query("SELECT 1");
    console.log("✅ MySQL connected successfully");
    return true;
  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  pool,
  testConnection,
};
