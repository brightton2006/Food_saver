/**
 * Database connection pool export
 * Re-exports the configured MySQL pool and connection tester
 */
const { pool, testConnection } = require("./database");

module.exports = {
  pool,
  testConnection,
};
