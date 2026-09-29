const { verifyToken } = require("../routes/auth");
const store = require("../data/store");

/**
 * Socket.IO Handler
 * Manages active listing synchronization and notification broadcasts.
 * NOTE: Live order tracking, delivery tracking, and driver location features have been completely removed.
 */
module.exports = function setupOrderSockets(io) {
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          socket.user = {
            userId: decoded.userId || decoded.id,
            email: decoded.email,
            role: (decoded.role || "customer").toLowerCase(),
          };
        }
      }
    } catch (err) {
      console.warn("[SOCKET AUTH] Note:", err.message);
    }
    next();
  });

  io.on("connection", async (socket) => {
    // Send initial listings snapshot on connection
    try {
      const listings = await store.listActiveListings();
      const notifications = await store.listNgoNotifications();
      socket.emit("sync:snapshot", { listings, notifications });
    } catch (err) {
      console.error("[SOCKET] Sync error:", err.message);
    }

    // User personal notification room
    socket.on("join:user", (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on("disconnect", () => {});
  });
};
