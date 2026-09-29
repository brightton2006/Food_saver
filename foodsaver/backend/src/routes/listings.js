const express = require("express");
const store = require("../data/store");
const { notifyNearbyCustomersForListing } = require("../services/notificationService");

module.exports = function listingsRouter(io) {
  const router = express.Router();

  // GET /api/listings/hotels — list all APPROVED merchant hotels for customers
  router.get("/hotels", async (req, res) => {
    try {
      const hotels = await store.listHotelsForCustomers();
      res.json({ hotels });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/hotels — merchant creates a new hotel
  router.post("/hotels", async (req, res) => {
    try {
      const payload = req.body || {};
      if (!payload.hotelName && !payload.merchantName) {
        return res.status(400).json({ error: "hotelName or merchantName is required." });
      }
      const result = await store.createHotel(payload);
      io.emit("admin:notification", result.notification);
      io.emit("hotel:created", result.hotel);
      res.status(201).json({ ok: true, hotel: result.hotel, notification: result.notification });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/listings/hotels/merchant/:merchantId — get specific merchant's hotel profile
  router.get("/hotels/merchant/:merchantId", async (req, res) => {
    try {
      const hotel = await store.getHotelByMerchant(req.params.merchantId);
      res.json({ ok: true, hotel });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/listings/hotels/:hotelId — get specific hotel details and menu
  router.get("/hotels/:hotelId", async (req, res) => {
    try {
      const hotelData = await store.getHotelWithListings(req.params.hotelId);
      if (!hotelData) {
        return res.status(404).json({ error: "Hotel not found" });
      }
      res.json({ hotel: hotelData });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/listings/hotel-profile — update merchant hotel profile
  router.put("/hotel-profile", async (req, res) => {
    try {
      const { merchantId, hotelName, description, address, location, contactNumber, cuisine, logo, coverImage } = req.body || {};
      if (!merchantId) {
        return res.status(400).json({ error: "merchantId is required to update hotel profile." });
      }
      const updated = await store.updateHotelProfile(merchantId, {
        hotelName,
        description,
        address,
        location,
        contactNumber,
        cuisine,
        logo,
        coverImage,
      });
      res.json({ ok: true, hotel: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/listings — active flash-sale feed for customers
  router.get("/", async (req, res) => {
    try {
      const listings = await store.listActiveListings();
      res.json({ listings });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/listings/all — every listing, any status
  router.get("/all", async (req, res) => {
    try {
      const listings = await store.listAllListings();
      res.json({ listings });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/listings/merchant/:merchantName — food listings published by a specific merchant
  router.get("/merchant/:merchantName", async (req, res) => {
    try {
      const list = await store.listByMerchant(req.params.merchantName);
      res.json({ listings: list });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/clear — wipe all listings
  router.post("/clear", async (req, res) => {
    try {
      await store.clearAllListings();
      io.emit("sync:snapshot", { listings: [] });
      res.json({ ok: true, message: "All default and existing listings cleared." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings — merchant posts new surplus stock
  router.post("/", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantName = payload.merchantName || payload.hotelName || payload.merchantUsername;

      if (!merchantName || merchantName === "Unregistered") {
        return res.status(403).json({
          error: "Initial merchant profile setup and admin approval are required before posting food listings.",
        });
      }

      // MANDATORY ADMIN DOCUMENT VERIFICATION CHECK
      const isApproved = (await store.isMerchantApproved(merchantName)) || (await store.isMerchantApproved(payload.email));
      if (!isApproved) {
        return res.status(403).json({
          success: false,
          error: "Merchant verification is required before you can sell food on FoodSaver.",
          message: "Merchant verification is required before you can sell food on FoodSaver.",
          code: "VERIFICATION_PENDING",
        });
      }

      const { itemName, quantityTotal, discountPrice } = payload;
      if (!itemName || !quantityTotal || discountPrice === undefined) {
        return res.status(400).json({
          error: "itemName, quantityTotal and discountPrice are required",
        });
      }

      const listing = await store.createListing(payload);

      // AUTOMATIC 2 KM CUSTOMER PROXIMITY NOTIFICATION DISPATCH
      notifyNearbyCustomersForListing(listing, io).catch((e) => console.error(e));

      io.emit("listing:created", listing);
      res.status(201).json({ listing });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/listings/:id — merchant edits surplus stock details
  router.put("/:id", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || payload.hotelName || payload.merchantUsername;
      const result = await store.updateListing(req.params.id, payload, merchantIdentifier);

      if (result.error) {
        const code = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return res.status(code).json({ error: result.error });
      }

      io.emit("listing:updated", result.listing);
      res.json({ listing: result.listing });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/listings/:id — merchant removes listing
  router.delete("/:id", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || req.query.merchantName || payload.hotelName;
      const result = await store.deleteListing(req.params.id, merchantIdentifier);

      if (result.error) {
        const code = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return res.status(code).json({ error: result.error });
      }

      io.emit("listing:updated", { id: req.params.id, status: "deleted" });
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/:id/claim — customer claims a bundle
  router.post("/:id/claim", async (req, res) => {
    try {
      const result = await store.claimListing(req.params.id, req.body || {});
      if (result.error) {
        const code = result.error === "not_found" ? 404 : 409;
        return res.status(code).json({ error: result.error });
      }
      io.emit("listing:updated", result.listing);
      io.emit("claim:created", result.claim);
      io.emit("order:created", result.claim);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
