/**
 * FoodSaver Location Routes
 * REST API for GPS location updates, nearby merchant discovery, road route generation, and geocoding.
 */

const express = require("express");
const locationController = require("../controllers/locationController");

const router = express.Router();

// GET /api/location/route — Calculate road route geometry, distance (km), and travel time (min)
router.get("/route", locationController.getRoute);

// GET /api/location/merchants & /api/location/merchants/nearby — Real SQL nearby merchants
router.get("/merchants/nearby", locationController.getNearbyMerchants);
router.get("/merchants/search", locationController.searchMerchants);
router.get("/merchants/:id", locationController.getMerchantById);
router.get("/merchants", locationController.getNearbyMerchants);

// GET /api/location/food & /api/location/food/nearby — Surplus food discovery
router.get("/food/nearby", locationController.getNearbyFood);
router.get("/foods/nearby", locationController.getNearbyFood);
router.get("/food", locationController.getNearbyFood);
router.get("/foods", locationController.getNearbyFood);

// GET /api/location/nearby — Generic nearby dispatcher
router.get("/nearby", (req, res) => {
  if (req.query.type === "merchants" || req.baseUrl.includes("/merchants")) {
    return locationController.getNearbyMerchants(req, res);
  }
  return locationController.getNearbyFood(req, res);
});

// POST /api/location/update & /api/location/users/location — Customer device GPS coordinate update
router.post("/update", locationController.updateUserLocation);
router.post("/users/location", locationController.updateUserLocation);
router.post("/location", locationController.updateUserLocation);

// POST & PUT /api/location/merchants/location — Merchant address & coordinates save
router.post("/merchants/location", locationController.updateMerchantLocation);
router.put("/merchants/location", locationController.updateMerchantLocation);

// POST & GET /api/location/geocode — Address geocoding
router.post("/geocode", locationController.geocode);
router.get("/geocode", locationController.geocode);

module.exports = router;
