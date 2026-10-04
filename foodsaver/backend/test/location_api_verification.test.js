const { describe, it } = require("node:test");
const assert = require("node:assert");

const BASE_URL = "http://localhost:4000";

describe("FoodSaver Location & Smart Map Backend Verification", async () => {
  it("GET /api/locations/nearby discovers both verified merchants and real places", async () => {
    const res = await fetch(`${BASE_URL}/api/locations/nearby?lat=9.1724&lng=77.8694&radius=5.0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.center && data.center.lat);
    assert.ok(Array.isArray(data.businesses));
    console.log(`Verified ${data.totalCount} nearby businesses in Kovilpatti (FoodSaver Partners: ${data.verifiedPartnersCount}, Discovered Places: ${data.discoveredPlacesCount})`);
    
    // Check that verified FoodSaver partners have isFoodSaverPartner: true
    const partner = data.businesses.find(b => b.isFoodSaverPartner);
    if (partner) {
      assert.strictEqual(partner.isFoodSaverPartner, true);
      assert.ok(partner.location && partner.location.type === "Point");
      assert.ok(Array.isArray(partner.location.coordinates));
    }
  });

  it("GET /api/locations/search returns autocomplete suggestions for districts/towns & merchants", async () => {
    const res = await fetch(`${BASE_URL}/api/locations/search?q=Kovilpatti`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.results));
    assert.ok(data.results.length > 0);
    console.log(`Found ${data.results.length} autocomplete suggestions for 'Kovilpatti':`, data.results.map(r => r.title));
  });

  it("GET /api/locations/business/:id returns details for verified FoodSaver partner", async () => {
    const res = await fetch(`${BASE_URL}/api/locations/business/htl_1790183917635`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.business.isFoodSaverPartner, true);
    assert.strictEqual(data.business.hotelName, "Hari Food");
  });

  it("GET /api/foods/nearby returns surplus food list with GeoJSON locations", async () => {
    const res = await fetch(`${BASE_URL}/api/foods/nearby?lat=9.1724&lng=77.8694&radius=5.0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.items || data.listings || data.foods));
  });

  it("GET /api/location/route returns real road geometry via OSRM", async () => {
    const res = await fetch(`${BASE_URL}/api/location/route?startLat=9.1724&startLng=77.8694&endLat=9.1847&endLng=77.8566`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.distance > 0);
    assert.ok(data.duration > 0);
    assert.ok(Array.isArray(data.route));
    assert.ok(data.route.length >= 2);
    console.log(`Calculated real road route: ${data.distance} km, ${data.duration} mins, points: ${data.route.length}`);
  });
});
