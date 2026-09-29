const test = require("node:test");
const assert = require("node:assert/strict");
const { pool } = require("../src/config/database");
const store = require("../src/data/store");

test("acknowledgeNotification returns a merchant notice when an NGO rescues food", async () => {
  const listing = await store.createListing({
    merchantId: "merchant-1",
    merchantName: "Baker's Box",
    itemName: "Croissants",
    quantityTotal: 6,
    discountPrice: 3,
    originalPrice: 10,
    durationMinutes: 1,
  });

  // Expire listing in MySQL database reliably across timezones
  await pool.query("UPDATE listings SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE listing_id = ?", [listing.id]);

  let notification = null;
  await store.sweepExpiredListings((_, createdNotification) => {
    if (createdNotification && createdNotification.listingId === listing.id) {
      notification = createdNotification;
    }
  });

  assert.ok(notification, "expected an NGO notification to be created");

  const result = await store.acknowledgeNotification(notification.id, "Bright Table");

  assert.equal(result.notification.status, "acknowledged");
  assert.equal(result.merchantNotice?.listingId, listing.id);
  assert.equal(result.merchantNotice?.ngoName, "Bright Table");
  assert.equal(result.merchantNotice?.merchantName, "Baker's Box");
  assert.equal(result.merchantNotice?.type, "ngo-collected");

  // Cleanup test listing & notification
  await pool.query("DELETE FROM ngo_notifications WHERE notification_id = ?", [notification.id]);
  await pool.query("DELETE FROM listings WHERE listing_id = ?", [listing.id]);
});

test("claimListing allows NGO partners to select active food at zero cost", async () => {
  const listing = await store.createListing({
    merchantId: "ver-1",
    merchantName: "Rivera Bakery",
    itemName: "Fresh Parotta",
    quantityTotal: 10,
    discountPrice: 60,
    originalPrice: 120,
  });

  const res = await store.claimListing(listing.id, {
    customerName: "Second Harvest NGO",
    customerUsername: "second_harvest",
    quantity: 3,
    method: "ngo_rescue",
  });

  assert.ok(res.claim, "expected NGO rescue claim to be generated");
  assert.equal(res.claim.pricePaid, 0, "NGO rescue claim should be 100% free (₹0)");
  assert.equal(res.claim.quantity, 3);
  assert.equal(res.listing.quantityAvailable, 7);

  // Cleanup test claim & listing
  await pool.query("DELETE FROM claims WHERE claim_id = ?", [res.claim.id]);
  await pool.query("DELETE FROM listings WHERE listing_id = ?", [listing.id]);
});
