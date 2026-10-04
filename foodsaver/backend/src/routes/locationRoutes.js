/**
 * FoodSaver Location Routes
 * REST API for GPS location updates, nearby merchant discovery, road route generation, and geocoding.
 */

const express = require("express");
const locationController = require("../controllers/locationController");

const router = express.Router();

// GET /api/location/route — Calculate road route geometry, distance (km), and travel time (min)
router.get("/route", locationController.getRoute);

// GET /api/locations/nearby & /api/location/nearby — Unified nearby restaurant and FoodSaver partner discovery
router.get("/nearby", locationController.getNearbyLocations);
router.get("/locations/nearby", locationController.getNearbyLocations);

// GET /api/locations/search & /api/location/search — Autocomplete locations, towns, PIN codes, and merchants
router.get("/search", locationController.searchLocations);
router.get("/locations/search", locationController.searchLocations);

// GET /api/location/merchants & /api/location/merchants/nearby — Real SQL nearby merchants
router.get("/merchants/nearby", locationController.getNearbyMerchants);
router.get("/merchants/search", locationController.searchMerchants);
router.get("/merchants", locationController.getNearbyMerchants);

// GET /api/locations/business/:id & /api/merchants/:id — Business details
router.get("/business/:id", locationController.getBusinessById);
router.get("/locations/business/:id", locationController.getBusinessById);
router.get("/merchants/:id", locationController.getBusinessById);

// GET /api/location/food & /api/location/food/nearby & /api/foods/nearby — Surplus food discovery
router.get("/food/nearby", locationController.getNearbyFood);
router.get("/foods/nearby", locationController.getNearbyFood);
router.get("/food", locationController.getNearbyFood);
router.get("/foods", locationController.getNearbyFood);

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
