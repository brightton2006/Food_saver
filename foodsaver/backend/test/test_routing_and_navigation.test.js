const assert = require("assert");
const http = require("http");
const express = require("express");
const locationRoutes = require("../src/routes/locationRoutes");
const routingService = require("../src/services/routingService");
const geocodingService = require("../src/services/geocodingService");
const { pool } = require("../src/config/db");

async function runRoutingTests() {
  console.log("=== Testing FoodSaver Routing, Geocoding & Location APIs ===\n");

  // 1. Direct Service Unit Tests
  console.log("1. Testing routingService.getRoute()...");
  const routeRes = await routingService.getRoute(9.1724, 77.8694, 9.1760, 77.8730);

  assert(routeRes, "routeRes must not be null");
  assert(typeof routeRes.distance === "number" && routeRes.distance > 0, `distance must be positive number, got: ${routeRes.distance}`);
  assert(typeof routeRes.duration === "number" && routeRes.duration > 0, `duration must be positive number, got: ${routeRes.duration}`);
  assert(Array.isArray(routeRes.route) && routeRes.route.length >= 2, `route must have at least 2 road coordinates, got: ${routeRes.route.length}`);
  
  // Verify coordinate format [latitude, longitude]
  const firstCoord = routeRes.route[0];
  assert(Array.isArray(firstCoord) && firstCoord.length === 2, "Coordinate must be [lat, lng]");
  assert(firstCoord[0] >= -90 && firstCoord[0] <= 90, "Latitude must be valid");
  assert(firstCoord[1] >= -180 && firstCoord[1] <= 180, "Longitude must be valid");
  console.log(`✓ Real road route successfully generated: ${routeRes.distance} km, ${routeRes.duration} min, ${routeRes.route.length} road geometry points.`);

  // 2. Direct Geocoding Unit Test
  console.log("\n2. Testing geocodingService.geocodeAddress()...");
  const geoRes = await geocodingService.geocodeAddress("Main Road, Kovilpatti", "Kovilpatti");
  assert(geoRes && geoRes.latitude && geoRes.longitude, "Geocoding must return valid coordinates");
  console.log(`✓ Geocoded address to: [${geoRes.latitude}, ${geoRes.longitude}] via ${geoRes.source}`);

  // 3. Express HTTP Route Integration Test
  console.log("\n3. Testing HTTP GET /api/location/route...");
  const app = express();
  app.use(express.json());
  app.use("/api/location", locationRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/location/route?startLat=9.1724&startLng=77.8694&endLat=9.1760&endLng=77.8730`
    );
    assert.strictEqual(res.status, 200, "HTTP status must be 200");
    const json = await res.json();

    assert(json.distance !== undefined, "Response must include distance");
    assert(json.duration !== undefined, "Response must include duration");
    assert(Array.isArray(json.route), "Response must include route array");
    assert(json.route.length >= 2, "Response route array must have points");
    console.log(`✓ HTTP Route API response verified: distance=${json.distance}, duration=${json.duration}, points=${json.route.length}`);

    // 4. Test Error Handling on Invalid Coordinates
    console.log("\n4. Testing HTTP error handling for invalid coordinates...");
    const badRes = await fetch(`http://127.0.0.1:${port}/api/location/route?startLat=999&startLng=77.8694&endLat=9.1760&endLng=77.8730`);
    assert.strictEqual(badRes.status, 400, "Should return 400 on invalid latitude");
    console.log("✓ Invalid coordinates rejected with 400 Bad Request.");

    // 5. Test Nearby Merchants via SQL
    console.log("\n5. Testing HTTP GET /api/location/merchants/nearby...");
    const merchRes = await fetch(`http://127.0.0.1:${port}/api/location/merchants/nearby?latitude=9.1724&longitude=77.8694&radius=5.0`);
    assert.strictEqual(merchRes.status, 200, "Nearby merchants status must be 200");
    const merchJson = await merchRes.json();
    assert.strictEqual(merchJson.success, true, "Success flag must be true");
    assert(Array.isArray(merchJson.merchants), "merchants must be an array");
    console.log(`✓ Retrieved ${merchJson.merchants.length} nearby merchants from SQL.`);
  } finally {
    server.close();
  }

  console.log("\n🎉 ALL ROUTING, GEOCODING & LOCATION API TESTS PASSED!\n");
  process.exit(0);
}

runRoutingTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
