const { execSync, spawn } = require("child_process");
const net = require("net");
const path = require("path");
const fs = require("fs");

function checkPort(port = 3306, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureMySQLRunning() {
  // Never attempt to start local Windows MySQL server in production or on non-Windows platforms
  if (process.env.NODE_ENV === "production" || process.platform !== "win32") {
    return false;
  }

  const isRunning = await checkPort(3306);
  if (isRunning) {
    console.log("✅ MySQL is already running on port 3306.");
    return true;
  }

  console.log("⚠️ MySQL is not responding on port 3306. Attempting to start local instance...");
  
  const defaultPath = "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqld.exe";
  if (fs.existsSync(defaultPath)) {
    const dataDir = path.join(__dirname, "..", "..", "mysql_data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log("🌱 Initializing local MySQL data directory...");
      try {
        execSync(`"${defaultPath}" --initialize-insecure --datadir="${dataDir}"`, { stdio: "inherit" });
      } catch (e) {
        console.warn("Notice during MySQL initialization:", e.message);
      }
    }

    console.log("🚀 Spawning mysqld daemon on port 3306...");
    const child = spawn(defaultPath, ["--datadir=" + dataDir, "--port=3306"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    // Wait up to 10 seconds for MySQL to respond
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkPort(3306)) {
        console.log("✅ Local MySQL database started successfully on port 3306!");
        return true;
      }
    }
  }

  console.error("❌ Could not automatically start MySQL. Please start the 'MySQL80' Windows service or run MySQL manually.");
  return false;
}

if (require.main === module) {
  ensureMySQLRunning();
}

module.exports = { ensureMySQLRunning };
