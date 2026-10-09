const express = require("express");
const store = require("../data/store");
const locationService = require("../services/locationService");
const {
  notifyNearbyCustomersForListing,
  notifyNearbyCustomersForNightSale,
} = require("../services/notificationService");

module.exports = function listingsRouter(io) {
  const router = express.Router();

  // GET /api/listings/night-sales — dedicated Night-Time Surplus Flash Sales Feed
  router.get("/night-sales", async (req, res) => {
    try {
      const { lat, lng, radius = 2.0, category = "All", searchQuery = "", city = "Kovilpatti" } = req.query;
      const data = await store.getNightSaleListings({
        lat: Number(lat) || 9.1724,
        lng: Number(lng) || 77.8694,
        radiusKm: Number(radius) || 2.0,
        category,
        searchQuery,
        city,
      });
      res.json({ success: true, ...data });
    } catch (err) {
      console.error("Error fetching night sales:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/listings/merchant-summary/:merchantIdentifier — merchant night-sales dashboard breakdown
  router.get("/merchant-summary/:merchantIdentifier", async (req, res) => {
    try {
      const summary = await store.getMerchantNightSalesSummary(req.params.merchantIdentifier);
      if (!summary) return res.status(404).json({ error: "Merchant not found" });
      res.json({ success: true, ...summary });
    } catch (err) {
      console.error("Error fetching merchant night sales summary:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/listings/hotels — list all APPROVED merchant hotels for customers (location-aware if lat/lng supplied)
  router.get("/hotels", async (req, res) => {
    try {
      const { lat, lng, latitude, longitude, radius = 5.0 } = req.query;
      const uLat = parseFloat(lat || latitude);
      const uLng = parseFloat(lng || longitude);

      if (!isNaN(uLat) && !isNaN(uLng)) {
        const merchants = await locationService.getNearbyMerchants({
          lat: uLat,
          lng: uLng,
          radiusKm: parseFloat(radius) || 5.0,
        });
        return res.json({ hotels: merchants, count: merchants.length });
      }

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

  // GET /api/listings — active flash-sale feed for customers (location-aware if lat/lng supplied)
  router.get("/", async (req, res) => {
    try {
      const { lat, lng, latitude, longitude, radius = 5.0, category = "All", searchQuery = "", sortBy = "distance" } = req.query;
      const uLat = parseFloat(lat || latitude);
      const uLng = parseFloat(lng || longitude);

      if (!isNaN(uLat) && !isNaN(uLng)) {
        const items = await locationService.getNearbyListings({
          lat: uLat,
          lng: uLng,
          radiusKm: parseFloat(radius) || 5.0,
          category,
          searchQuery,
          sortBy,
        });
        return res.json({ listings: items });
      }

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

  // POST /api/listings & /api/listings/night-sale — merchant posts new surplus stock
  const handlePostListing = async (req, res, isNightSaleEndpoint = false) => {
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

      const { itemName, quantityTotal, discountPrice, originalPrice } = payload;
      if (!itemName || !quantityTotal || discountPrice === undefined) {
        return res.status(400).json({
          error: "itemName, quantityTotal and discountPrice are required",
        });
      }

      // Pricing validation
      const dPrice = Number(discountPrice);
      const oPrice = Number(originalPrice || dPrice);
      if (dPrice < 0 || oPrice < 0) {
        return res.status(400).json({ error: "Prices cannot be negative." });
      }
      if (dPrice > oPrice) {
        return res.status(400).json({ error: "Discounted selling price cannot be higher than original price." });
      }

      // Food safety validation for night sales
      const isNight = Boolean(isNightSaleEndpoint || payload.isNightSale || payload.is_night_sale);
      if (isNight && payload.foodSafetyApproved === false) {
        return res.status(400).json({
          error: "food_safety_required",
          message: "Merchant food safety and hygiene declaration is mandatory before publishing night-time surplus offers.",
        });
      }

      const listing = await store.createListing({
        ...payload,
        isNightSale: isNight,
      });

      // DISPATCH PROXIMITY NOTIFICATIONS ACCORDING TO RADIUS
      if (isNight) {
        const radius = Number(payload.notificationRadius || payload.radius || 2.0);
        notifyNearbyCustomersForNightSale(listing, io, radius).catch((e) => console.error(e));
        io.emit("night_sale:created", listing);
      } else {
        notifyNearbyCustomersForListing(listing, io).catch((e) => console.error(e));
      }

      io.emit("listing:created", listing);
      res.status(201).json({ success: true, listing });
    } catch (err) {
      console.error("Error creating listing:", err);
      res.status(500).json({ error: err.message });
    }
  };

  router.post("/night-sale", (req, res) => handlePostListing(req, res, true));
  router.post("/", (req, res) => handlePostListing(req, res, false));

  // POST /api/listings/:id/pause — Pause night offer
  router.post("/:id/pause", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || payload.hotelName || payload.merchantUsername;
      const result = await store.pauseListing(req.params.id, merchantIdentifier);
      if (result.error) return res.status(result.error === "not_found" ? 404 : 403).json(result);
      io.emit("listing:updated", result.listing);
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/:id/resume — Resume paused offer
  router.post("/:id/resume", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || payload.hotelName || payload.merchantUsername;
      const result = await store.resumeListing(req.params.id, merchantIdentifier);
      if (result.error) return res.status(result.error === "not_found" ? 404 : 403).json(result);
      io.emit("listing:updated", result.listing);
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/:id/sold-out — Mark item as sold out
  router.post("/:id/sold-out", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || payload.hotelName || payload.merchantUsername;
      const result = await store.markListingSoldOut(req.params.id, merchantIdentifier);
      if (result.error) return res.status(result.error === "not_found" ? 404 : 403).json(result);
      io.emit("listing:updated", result.listing);
      res.json({ success: true, listing: result.listing });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/:id/remove-unsafe — Immediately withdraw unsafe food for food safety
  router.post("/:id/remove-unsafe", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || payload.hotelName || payload.merchantUsername;
      const reason = payload.reason || "Removed for food safety precaution";
      const result = await store.removeUnsafeListing(req.params.id, merchantIdentifier, reason);
      if (result.error) return res.status(result.error === "not_found" ? 404 : 403).json(result);
      io.emit("listing:updated", result.listing);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/listings/:id/donate-to-ngo — Redirect remaining unsold food to NGO
  router.post("/:id/donate-to-ngo", async (req, res) => {
    try {
      const payload = req.body || {};
      const merchantIdentifier = payload.merchantName || payload.hotelName || payload.merchantUsername;
      const result = await store.donateListingToNgo(req.params.id, merchantIdentifier);
      if (result.error) return res.status(result.error === "not_found" ? 404 : 400).json(result);
      io.emit("listing:updated", result.listing);
      io.emit("donation:created", { donationId: result.donationId, listing: result.listing });
      res.json({ success: true, ...result });
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
