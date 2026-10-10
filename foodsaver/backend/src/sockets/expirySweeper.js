const cron = require("node-cron");
const store = require("../data/store");

// Runs on a short tick and cron schedule so every connected client's countdown UI and the
// "notify nearby NGOs" behaviour stay in lockstep with the server clock
function startExpirySweeper(io, intervalMs = 5000) {
  const runSweep = async () => {
    try {
      await store.sweepExpiredListings((listing, notification) => {
        io.emit("listing:updated", listing);
        if (notification) {
          io.emit("ngo:notification", notification);
        }
      });
    } catch (err) {
      if (err.code !== 'ENOTFOUND' && err.code !== 'ETIMEDOUT' && !err.message?.includes('ENOTFOUND')) {
        console.error("Expiry sweeper notice:", err.message);
      }
    }
  };

  const timer = setInterval(runSweep, intervalMs);

  // Scheduled cron job running every minute for robust background cleanup
  cron.schedule("* * * * *", () => {
    runSweep();
  });

  return () => clearInterval(timer);
}

module.exports = { startExpirySweeper };
