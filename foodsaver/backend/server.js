require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const { testConnection, pool } = require("./src/config/database");
const { initializeDatabase } = require("./src/database/initDb");
const store = require("./src/data/store");
const listingsRouter = require("./src/routes/listings");
const claimsRouter = require("./src/routes/claims");
const ngoRouter = require("./src/routes/ngo.routes");
const foodImageRouter = require("./src/routes/foodImage");
const { router: authRouter } = require("./src/routes/auth");
const adminRouter = require("./src/routes/admin");
const merchantRouter = require("./src/routes/merchant.routes");
const locationRouter = require("./src/routes/location.routes");
const notificationRouter = require("./src/routes/notification.routes");
const donationRouter = require("./src/routes/donation.routes");
const ordersRouter = require("./src/routes/orders.routes");
const recentlyAccessedRouter = require("./src/routes/recentlyAccessed.routes");
const intelligenceRouter = require("./src/routes/intelligence.routes");
const chatRouter = require("./src/routes/chatRoutes");
const hotelsRouter = require("./src/routes/hotels.routes");
const setupOrderSockets = require("./src/sockets/orderSocket");
const { startExpirySweeper } = require("./src/sockets/expirySweeper");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Database Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await testConnection();
    res.json({
      success: true,
      server: "ok",
      database: "connected",
      service: "foodsaver-backend",
      time: Date.now(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      server: "ok",
      database: "disconnected",
      error: err.message,
    });
  }
});

// Database Test endpoint (Dev verification)
app.get("/api/test-db", async (req, res) => {
  try {
    const [roles] = await pool.query("SELECT * FROM roles");
    const [users] = await pool.query("SELECT user_id, role_id, email, full_name FROM users");
    const [hotels] = await pool.query("SELECT hotel_id, hotel_name, verification_status FROM hotels");
    const [settings] = await pool.query("SELECT * FROM app_settings");
    res.json({
      success: true,
      tables: { roles, users, hotels, settings },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/merchant", merchantRouter);
app.use("/api/hotels", hotelsRouter);
app.use("/api/food-image", foodImageRouter);
app.use("/api/food", locationRouter);
app.use("/api/foods", locationRouter);
app.use("/api/location", locationRouter);
app.use("/api/locations", locationRouter);
app.use("/api/users", locationRouter);
app.use("/api/merchants", locationRouter);
app.use("/api", locationRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/donations", donationRouter(io));
app.use("/api/listings", listingsRouter(io));
app.use("/api/claims", claimsRouter(io));
app.use("/api/orders", ordersRouter(io));
app.use("/api/ngo", ngoRouter(io));
app.use("/api/recently-accessed", recentlyAccessedRouter);
app.use("/api/intelligence", intelligenceRouter);
app.use("/api/chat", chatRouter);
app.use("/api/chatbot", chatRouter);

setupOrderSockets(io);

startExpirySweeper(io);

async function startServer() {
  try {
    console.log("⏳ Initializing MySQL database connection & schema...");
    await testConnection();
    await initializeDatabase();

    server.listen(PORT, () => {
      console.log(`🚀 FoodSaver API running on port ${PORT}`);
      console.log(`✅ MySQL connected successfully & location routes enabled`);
    });
  } catch (err) {
    console.error("❌ MySQL connection or initialization failed:", err.message);
    process.exit(1);
  }
}

startServer();
