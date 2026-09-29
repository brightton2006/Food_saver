const express = require("express");
const {
  createDonation,
  getDonationById,
  getNearbyDonations,
  claimDonation,
  updateDonationStatus,
} = require("../services/donationService");
const { getNearbyNgos } = require("../services/locationService");
const { createNotification } = require("../services/notificationService");

module.exports = function donationRouter(io) {
  const router = express.Router();

  // POST /api/donations — merchant creates unsold food donation
  router.post("/", async (req, res) => {
    try {
      const { merchantUserId, hotelId, listingId, itemName, quantity, description, address, latitude, longitude, lat, lng, pickupDeadlineMinutes } = req.body || {};

      if (!merchantUserId || !hotelId || !itemName || !quantity) {
        return res.status(400).json({ success: false, error: "merchantUserId, hotelId, itemName and quantity are required." });
      }

      const donation = await createDonation({
        merchantUserId,
        hotelId,
        listingId,
        itemName,
        quantity,
        description,
        address,
        lat: latitude || lat,
        lng: longitude || lng,
        pickupDeadlineMinutes,
      });

      // Find nearby NGOs (5 km default radius) and send proximity alerts
      const nearbyNgos = await getNearbyNgos({
        lat: donation.lat,
        lng: donation.lng,
        radiusKm: 5.0,
      });

      for (const ngo of nearbyNgos) {
        const notif = await createNotification({
          userId: ngo.ngoUserId,
          type: "DONATION_AVAILABLE",
          title: "🍱 Unsold Food Donation Available!",
          message: `${donation.quantity}x ${donation.itemName} available at ${donation.merchantName} (${ngo.distanceKm} km away).`,
        });

        if (io) {
          io.to(`user:${ngo.ngoUserId}`).emit("notification:new", notif);
          io.to(`user:${ngo.ngoUserId}`).emit("donation:available", { donation, distanceKm: ngo.distanceKm });
        }
      }

      if (io) {
        io.emit("donation:created", donation);
      }

      return res.status(201).json({
        success: true,
        donation,
        notifiedNgosCount: nearbyNgos.length,
      });
    } catch (err) {
      console.error("Error creating donation:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/donations/nearby — NGO discovers donations within 5 km
  router.get("/nearby", async (req, res) => {
    try {
      const { latitude, longitude, lat, lng, radius = 5.0 } = req.query;
      const searchLat = latitude || lat || 9.1724;
      const searchLng = longitude || lng || 77.8694;

      const donations = await getNearbyDonations({
        lat: searchLat,
        lng: searchLng,
        radiusKm: Number(radius) || 5.0,
      });

      return res.json({
        success: true,
        count: donations.length,
        donations,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/donations/:id — get specific donation details & live tracking info
  router.get("/:id", async (req, res) => {
    try {
      const donation = await getDonationById(req.params.id);
      if (!donation) {
        return res.status(404).json({ success: false, error: "Donation not found" });
      }
      return res.json({ success: true, donation });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/donations/:id/claim — NGO accepts donation (transactional)
  router.post("/:id/claim", async (req, res) => {
    try {
      const { ngoUserId } = req.body || {};
      if (!ngoUserId) {
        return res.status(400).json({ success: false, error: "ngoUserId is required to claim donation" });
      }

      const result = await claimDonation({ donationId: req.params.id, ngoUserId });
      if (result.error) {
        return res.status(409).json({ success: false, error: result.error });
      }

      // Notify merchant
      const notif = await createNotification({
        userId: result.donation.merchantUserId,
        type: "NGO_CLAIMED",
        title: "🤝 NGO Accepted Food Donation!",
        message: `${result.donation.ngoName || "Partner NGO"} accepted your donation of ${result.donation.quantity}x ${result.donation.itemName}.`,
      });

      if (io) {
        io.to(`user:${result.donation.merchantUserId}`).emit("notification:new", notif);
        io.emit("donation:updated", result.donation);
      }

      return res.json({ success: true, donation: result.donation });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // PATCH /api/donations/:id/status — update donation tracking state
  router.patch("/:id/status", async (req, res) => {
    try {
      const { status } = req.body || {};
      if (!status) {
        return res.status(400).json({ success: false, error: "status is required" });
      }

      const result = await updateDonationStatus(req.params.id, status);

      if (io) {
        io.emit("donation:updated", result.donation);
        if (result.donation.merchantUserId) {
          io.to(`user:${result.donation.merchantUserId}`).emit("donation:status_changed", result.donation);
        }
        if (result.donation.ngoUserId) {
          io.to(`user:${result.donation.ngoUserId}`).emit("donation:status_changed", result.donation);
        }
      }

      return res.json({ success: true, donation: result.donation });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
