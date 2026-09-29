const { describe, it } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

const API_PORT = 4000;

function makeGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${API_PORT}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    }).on("error", reject);
  });
}

function makePost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      `http://localhost:${API_PORT}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

describe("Location & 2 km Radius Haversine Engine Tests", () => {
  it("GET /api/food/nearby: Should return active food listings with exact Haversine distance in km", async () => {
    const res = await makeGet("/api/food/nearby?lat=9.1724&lng=77.8694&radius=2.0");

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    
    const items = res.body.items || res.body.listings;
    assert.ok(Array.isArray(items));

    // Every item returned MUST be within 2.0 km radius
    items.forEach((item) => {
      assert.ok(item.distanceKm <= 2.0, `Item ${item.id} distance ${item.distanceKm} exceeds 2.0 km radius`);
    });
  });

  it("POST /api/users/location: Should update customer location coordinates", async () => {
    const res = await makePost("/api/users/location", {
      userId: "usr_1b7fa44e",
      latitude: 9.1730,
      longitude: 77.8700,
      accuracy: 5.0,
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.location.userId, "usr_1b7fa44e");
    assert.strictEqual(res.body.location.latitude, 9.1730);
    assert.strictEqual(res.body.location.longitude, 77.8700);
  });

  it("locationService & notificationService: getNearbyCustomers and dispatch 2km notifications", async () => {
    const { getNearbyCustomers } = require("../src/services/locationService");
    const { notifyNearbyCustomersForListing } = require("../src/services/notificationService");

    const customers = await getNearbyCustomers({ lat: 9.1724, lng: 77.8694, radiusKm: 2.0 });
    assert.ok(Array.isArray(customers));

    const testListing = {
      id: "lst_test_2km",
      itemName: "Test 2km Samosa Box",
      merchantName: "Kovilpatti Sweets",
      discountPrice: 50,
      lat: 9.1724,
      lng: 77.8694,
    };

    const dispatched = await notifyNearbyCustomersForListing(testListing, null);
    assert.ok(Array.isArray(dispatched));
    assert.strictEqual(dispatched.length, customers.length);
  });
});

