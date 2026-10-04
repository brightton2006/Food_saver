const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");

async function backupDatabase() {
  const [tables] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const backup = {};
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    const [rows] = await pool.query("SELECT * FROM `" + tableName + "`");
    backup[tableName] = rows;
  }
  const backupPath = path.join(__dirname, "backup_pre_cleanup.json");
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
  console.log("✅ Full database backup created successfully at:", backupPath);
  console.log("📊 Total tables backed up:", Object.keys(backup).length);
  return backupPath;
}

if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backup failed:", err);
      process.exit(1);
    });
}

module.exports = { backupDatabase };
