const { pool } = require("../config/database");
const { generateId } = require("../utils/generateId");

function getHaversineSql(latParam, lngParam, latCol = "d.latitude", lngCol = "d.longitude") {
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(${latParam})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians(${lngParam})) + sin(radians(${latParam})) * sin(radians(${latCol}))))))`;
}

async function createDonation({ merchantUserId, hotelId, listingId = null, itemName, quantity, description, address, lat, lng, pickupDeadlineMinutes = 120 }) {
  const donationId = generateId("don");
  const now = Date.now();
  const deadlineMs = Math.max(15, Number(pickupDeadlineMinutes) || 120) * 60 * 1000;
  const deadline = new Date(now + deadlineMs);

  await pool.query(
    `INSERT INTO donations (donation_id, merchant_user_id, hotel_id, listing_id, item_name, quantity, description, address, latitude, longitude, pickup_deadline, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DONATION_CREATED')`,
    [
      donationId,
      merchantUserId,
      hotelId,
      listingId,
      itemName,
      Math.max(1, Number(quantity) || 1),
      description || "Fresh unsold food donated to local NGO network.",
      address || "Merchant Storefront",
      Number(lat) || 9.1724,
      Number(lng) || 77.8694,
      deadline,
    ]
  );

  return getDonationById(donationId);
}

async function getDonationById(donationId) {
  const [rows] = await pool.query(
    `SELECT d.*, h.hotel_name, u.full_name as merchant_name, u.phone_number as merchant_phone,
            dc.claim_id, dc.ngo_user_id, ngo_user.full_name as ngo_name, ngo_user.phone_number as ngo_phone
     FROM donations d
     JOIN hotels h ON d.hotel_id = h.hotel_id
     JOIN users u ON d.merchant_user_id = u.user_id
     LEFT JOIN donation_claims dc ON d.donation_id = dc.donation_id
     LEFT JOIN users ngo_user ON dc.ngo_user_id = ngo_user.user_id
     WHERE d.donation_id = ?`,
    [donationId]
  );

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    donationId: r.donation_id,
    merchantUserId: r.merchant_user_id,
    hotelId: r.hotel_id,
    hotelName: r.hotel_name,
    merchantName: r.merchant_name,
    merchantPhone: r.merchant_phone,
    listingId: r.listing_id,
    itemName: r.item_name,
    quantity: Number(r.quantity),
    description: r.description || "",
    address: r.address,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    pickupDeadline: new Date(r.pickup_deadline).getTime(),
    status: r.status,
    ngoUserId: r.ngo_user_id || null,
    ngoName: r.ngo_name || null,
    ngoPhone: r.ngo_phone || null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

async function getNearbyDonations({ lat, lng, radiusKm = 5.0 }) {
  const latitude = Number(lat) || 9.1724;
  const longitude = Number(lng) || 77.8694;
  const radius = Number(radiusKm) || 5.0;

  const haversineFormula = getHaversineSql("?", "?", "d.latitude", "d.longitude");

  const [rows] = await pool.query(
    `SELECT d.*, h.hotel_name, u.full_name as merchant_name,
            ${haversineFormula} AS distance_km
     FROM donations d
     JOIN hotels h ON d.hotel_id = h.hotel_id
     JOIN users u ON d.merchant_user_id = u.user_id
     WHERE d.status IN ('DONATION_CREATED', 'NGO_NOTIFIED', 'NGO_ACCEPTED', 'NGO_ON_THE_WAY')
       AND d.pickup_deadline > NOW()
     HAVING distance_km <= ? ORDER BY distance_km ASC`,
    [latitude, longitude, latitude, radius]
  );

  return rows.map((r) => ({
    donationId: r.donation_id,
    merchantUserId: r.merchant_user_id,
    hotelId: r.hotel_id,
    hotelName: r.hotel_name,
    merchantName: r.merchant_name,
    itemName: r.item_name,
    quantity: Number(r.quantity),
    description: r.description || "",
    address: r.address,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    pickupDeadline: new Date(r.pickup_deadline).getTime(),
    status: r.status,
    distanceKm: Number(Number(r.distance_km).toFixed(2)),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

async function claimDonation({ donationId, ngoUserId }) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM donations WHERE donation_id = ? FOR UPDATE", [donationId]);
    if (rows.length === 0) {
      await connection.rollback();
      return { error: "not_found" };
    }

    const don = rows[0];
    if (don.status !== "DONATION_CREATED" && don.status !== "NGO_NOTIFIED") {
      await connection.rollback();
      return { error: "already_claimed_or_unavailable" };
    }

    const claimId = generateId("don_claim");
    await connection.query(
      `INSERT INTO donation_claims (claim_id, donation_id, ngo_user_id)
       VALUES (?, ?, ?)`,
      [claimId, donationId, ngoUserId]
    );

    await connection.query(
      "UPDATE donations SET status = 'NGO_ACCEPTED' WHERE donation_id = ?",
      [donationId]
    );

    await connection.commit();

    const updated = await getDonationById(donationId);
    return { donation: updated };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error in claimDonation transaction:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

async function updateDonationStatus(donationId, newStatus) {
  await pool.query("UPDATE donations SET status = ? WHERE donation_id = ?", [newStatus, donationId]);
  const updated = await getDonationById(donationId);
  return { donation: updated };
}

module.exports = {
  createDonation,
  getDonationById,
  getNearbyDonations,
  claimDonation,
  updateDonationStatus,
};
