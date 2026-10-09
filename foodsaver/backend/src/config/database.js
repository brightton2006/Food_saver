require("dotenv").config();
const mysql = require("mysql2/promise");

const isProduction = process.env.NODE_ENV === "production";

// Build database configuration from environment variables or connection string
function getDbConfig() {
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (dbUrl) {
    return { uri: dbUrl };
  }

  const host = process.env.DB_HOST || process.env.MYSQL_HOST;
  if (isProduction && !host) {
    throw new Error(
      "Missing required database environment variable: DB_HOST or DATABASE_URL must be configured on Render."
    );
  }

  return {
    host: host || "127.0.0.1",
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || "root",
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQL_PASSWORD || ""),
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || "foodsaver",
  };
}

const config = getDbConfig();

// SSL configuration for Cloud MySQL providers (Render, Aiven, PlanetScale, Railway, AWS RDS, DigitalOcean, etc.)
let sslConfig = undefined;
const enableSSL = process.env.DB_SSL === "true" || (isProduction && process.env.DB_SSL !== "false");

if (enableSSL) {
  sslConfig = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
  };
  if (process.env.DB_SSL_CA) {
    sslConfig.ca = process.env.DB_SSL_CA;
  }
}

const pool = mysql.createPool({
  ...config,
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  multipleStatements: true,
});

let ensureMySQLRunning;
try {
  ensureMySQLRunning = require("../database/start_mysql").ensureMySQLRunning;
} catch (e) {
  ensureMySQLRunning = null;
}

async function testConnection(retries = 3) {
  let connection;
  const isLocalHost = config.host === "127.0.0.1" || config.host === "localhost";

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connection = await pool.getConnection();
      await connection.query("SELECT 1");
      console.log("✅ MySQL connected successfully");
      return true;
    } catch (error) {
      // Attempt local MySQL service startup ONLY when in non-production, on Windows, targeting localhost
      if (
        attempt === 1 &&
        !isProduction &&
        isLocalHost &&
        process.platform === "win32" &&
        (error.code === "ECONNREFUSED" || error.code === "PROTOCOL_CONNECTION_LOST") &&
        typeof ensureMySQLRunning === "function"
      ) {
        console.warn(`⚠️ Connection failed (${error.code}). Attempting to start local MySQL server...`);
        await ensureMySQLRunning();
      }

      if (attempt < retries) {
        console.warn(`⚠️ MySQL connection attempt ${attempt}/${retries} failed (${error.code || error.message}). Retrying in 1.5s...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        console.error(`❌ MySQL connection failed after ${retries} attempts:`, error.code || error.message);
        if (!isProduction && isLocalHost) {
          console.error("👉 Local development notice: Ensure your local MySQL service (e.g. MySQL80) is running or run: npm run db:start");
        } else {
          console.error("👉 Production notice: Verify DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT, and DB_SSL environment variables in Render.");
        }
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

