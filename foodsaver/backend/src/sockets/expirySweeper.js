const store = require("../data/store");

// Runs on a short tick so every connected client's countdown UI and the
// "notify nearby NGOs" behaviour stay in lockstep with the server clock
function startExpirySweeper(io, intervalMs = 5000) {
  const timer = setInterval(async () => {
    try {
      await store.sweepExpiredListings((listing, notification) => {
        io.emit("listing:updated", listing);
        if (notification) {
          io.emit("ngo:notification", notification);
        }
      });
    } catch (err) {
      console.error("Expiry sweeper error:", err.message);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

module.exports = { startExpirySweeper };
