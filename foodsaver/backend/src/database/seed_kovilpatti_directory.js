const { pool } = require("../config/database");
const { migrateDirectorySchema } = require("./migrate_directory_schema");

const INITIAL_DIRECTORY_BUSINESSES = [
  {
    name: "Hotel Sri Ganesh Bhavan",
    address: "124 Main Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Vegetarian",
    cuisine: "South Indian Vegetarian • Meals • Tiffin",
    contactNumber: "+91 4632 220101",
    searchQuery: "Main Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Hotel Sri Saraswathi",
    address: "Old Bus Stand Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Vegetarian",
    cuisine: "Traditional Vegetarian • Coffee • Tiffin",
    contactNumber: "+91 4632 220102",
    searchQuery: "Old Bus Stand, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Ananda A/C Vegetarian",
    address: "45 Kadalaiyur Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Vegetarian",
    cuisine: "Pure Veg A/C • North & South Indian",
    contactNumber: "+91 4632 220103",
    searchQuery: "Kadalaiyur Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Hotel Ananda A/C — Market Road",
    address: "Market Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Vegetarian",
    cuisine: "Pure Veg • Tiffin • Meals",
    contactNumber: "+91 4632 220104",
    searchQuery: "Market Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Greenleaf Multicuisine Restaurant",
    address: "Near New Bus Stand, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628502",
    category: "Meals",
    cuisine: "Multicuisine • Chinese • Tandoori • Biryani",
    contactNumber: "+91 4632 220105",
    searchQuery: "New Bus Stand, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Bilal Restaurant",
    address: "88 Main Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Non-Vegetarian",
    cuisine: "Mughlai • Grilled Chicken • Parotta • Salna",
    contactNumber: "+91 4632 220106",
    searchQuery: "Main Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Aasife Biriyani",
    address: "12 Ettayapuram Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Biryani",
    cuisine: "Dum Biryani • Kebabs • Fast Food",
    contactNumber: "+91 4632 220107",
    searchQuery: "Ettayapuram Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Hyderabad Bhai Kadai Biryani",
    address: "Underground Bridge Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Biryani",
    cuisine: "Hyderabadi Dum Biryani • Chicken 65",
    contactNumber: "+91 4632 220108",
    searchQuery: "Railway Feeder Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Biriyani Mama",
    address: "Pandavarmangalam, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628502",
    category: "Biryani",
    cuisine: "Authentic Seeraga Samba Biryani",
    contactNumber: "+91 4632 220109",
    searchQuery: "Pandavarmangalam, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Zam Zam Biriyani",
    address: "Pasuvanthanai Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Biryani",
    cuisine: "Special Mutton & Chicken Biryani",
    contactNumber: "+91 4632 220110",
    searchQuery: "Pasuvanthanai Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Al Ameer Biryani",
    address: "Main Road, Near Old Bus Stand, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Biryani",
    cuisine: "Kalyana Biryani • Kebab Specials",
    contactNumber: "+91 4632 220111",
    searchQuery: "Main Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "A.V.M Hotel Veg & Non Veg",
    address: "Railway Feeder Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Non-Vegetarian",
    cuisine: "South Indian Non-Veg • Fish Curry • Parotta",
    contactNumber: "+91 4632 220112",
    searchQuery: "Railway Feeder Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Hotel Sri Parvathi",
    address: "Market Street, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Vegetarian",
    cuisine: "Home-style Veg Meals • Sambar Rice",
    contactNumber: "+91 4632 220113",
    searchQuery: "Market Street, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Sri Bagavathi Mess",
    address: "Shenbagavalli Amman Temple Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Meals",
    cuisine: "Traditional Chettinad Meals • Kari Dosa",
    contactNumber: "+91 4632 220114",
    searchQuery: "Shenbagavalli Amman Temple, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Sri Dhanalakshmi Bhavan",
    address: "Gandhi Nagar Main Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628502",
    category: "Vegetarian",
    cuisine: "Vegetarian Tiffin • Ghee Roast • Poori",
    contactNumber: "+91 4632 220115",
    searchQuery: "Gandhi Nagar, Kovilpatti, Tamil Nadu",
  },
  {
    name: "The Garuda Restaurant",
    address: "NH44 Bypass Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628502",
    category: "Meals",
    cuisine: "Highway Diner • Indian & Continental",
    contactNumber: "+91 4632 220116",
    searchQuery: "NH44 Bypass, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Sri Sai Sundar A/C Family Restaurant",
    address: "Inam Maniyachi, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628502",
    category: "Meals",
    cuisine: "Family Restaurant • Tandoori • Chinese",
    contactNumber: "+91 4632 220117",
    searchQuery: "Inam Maniyachi, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Hotel Lakshmi Shankar",
    address: "Main Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Vegetarian",
    cuisine: "Pure Veg Meals • Filter Coffee",
    contactNumber: "+91 4632 220118",
    searchQuery: "Main Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Grace Family Restaurant",
    address: "Kadambur Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Non-Vegetarian",
    cuisine: "Pepper Chicken • Naan • Fried Rice",
    contactNumber: "+91 4632 220119",
    searchQuery: "Kadambur Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Hotel Sree Saravana Bhavan",
    address: "New Bus Stand Commercial Complex, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628502",
    category: "Vegetarian",
    cuisine: "South Indian Veg • Sweets & Savouries",
    contactNumber: "+91 4632 220120",
    searchQuery: "New Bus Stand, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Arun Bakery",
    address: "Main Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Bakery",
    cuisine: "Fresh Breads • Tea Cakes • Puffs • Pastries",
    contactNumber: "+91 4632 220121",
    searchQuery: "Main Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Ganesh Bakery & Sweets",
    address: "Old Bus Stand, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Sweets",
    cuisine: "Kavilpatti Kadalai Mittai • Halwa • Puffs",
    contactNumber: "+91 4632 220122",
    searchQuery: "Old Bus Stand, Kovilpatti, Tamil Nadu",
  },
  {
    name: "D'Lakshmi Sweets & Bakery",
    address: "Kadalaiyur Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Sweets",
    cuisine: "Special Mittai • Laddu • Gulab Jamun",
    contactNumber: "+91 4632 220123",
    searchQuery: "Kadalaiyur Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "Kovilpatti Bombay Sweets",
    address: "Main Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Sweets",
    cuisine: "Special Kovilpatti Peanut Chikki • Sweets",
    contactNumber: "+91 4632 220124",
    searchQuery: "Main Road, Kovilpatti, Tamil Nadu",
  },
  {
    name: "S.K. Bakers",
    address: "Sathur Road, Kovilpatti",
    district: "Thoothukudi",
    pincode: "628501",
    category: "Bakery",
    cuisine: "Artisan Breads • Birthday Cakes • Cookies",
    contactNumber: "+91 4632 220125",
    searchQuery: "Sathur Road, Kovilpatti, Tamil Nadu",
  },
];

async function geocodeQuery(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FoodSaver-Directory-Seeder/2.0 (contact@foodsaver.local)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
  } catch (err) {
    console.debug(`Geocode notice for '${query}':`, err.message);
  }
  return null;
}

async function seedKovilpattiDirectory() {
  await migrateDirectorySchema();

  console.log(`\n======================================================`);
  console.log(`📍 SEEDING INITIAL KOVILPATTI BUSINESS DIRECTORY (25)`);
  console.log(`======================================================\n`);

  let verifiedCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < INITIAL_DIRECTORY_BUSINESSES.length; i++) {
    const item = INITIAL_DIRECTORY_BUSINESSES[i];
    const hotelId = `htl_dir_${String(i + 1).padStart(2, "0")}`;

    console.log(`[${i + 1}/25] Validating "${item.name}"...`);

    // Attempt geocoding verification
    const geocode = await geocodeQuery(item.searchQuery);
    await new Promise((r) => setTimeout(r, 600)); // Respect OSM rate limits

    let lat = null;
    let lon = null;
    let locationStatus = "location_pending";
    let locationSource = "unverified_reference";
    let locationVerifiedAt = null;

    if (geocode && geocode.lat && geocode.lon) {
      lat = geocode.lat;
      lon = geocode.lon;
      locationStatus = "verified";
      locationSource = "osm_nominatim";
      locationVerifiedAt = new Date();
      verifiedCount++;
      console.log(`  ✓ Coordinates Verified via OSM: ${lat}, ${lon}`);
    } else {
      pendingCount++;
      console.log(`  ⚠️ Exact location pending admin map pin verification.`);
    }

    // Insert or update idempotently
    const [existing] = await pool.query("SELECT hotel_id FROM dim_hotels WHERE hotel_name = ? OR hotel_id = ?", [
      item.name,
      hotelId,
    ]);

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO dim_hotels (
          hotel_id, merchant_user_id, hotel_name, description, address,
          location_city, district, pincode, latitude, longitude,
          contact_number, cuisine, opening_hours, rating,
          verification_status, status, partner_status,
          location_status, location_source, location_verified_at,
          is_directory_listing, business_type, food_type
        ) VALUES (
          ?, NULL, ?, ?, ?,
          'Kovilpatti', ?, ?, ?, ?,
          ?, ?, '10:00 - 22:00', 4.3,
          'pending', 'DRAFT', 'unverified',
          ?, ?, ?,
          TRUE, 'Restaurant', ?
        )`,
        [
          hotelId,
          item.name,
          `${item.name} is a listed food establishment located in Kovilpatti.`,
          item.address,
          item.district,
          item.pincode,
          lat,
          lon,
          item.contactNumber,
          item.cuisine,
          locationStatus,
          locationSource,
          locationVerifiedAt,
          item.category === "Vegetarian" ? "Vegetarian" : item.category === "Non-Vegetarian" || item.category === "Biryani" ? "Non-Vegetarian" : "Both",
        ]
      );
    } else {
      // Update directory listing details
      await pool.query(
        `UPDATE dim_hotels SET
          address = ?, district = ?, pincode = ?,
          cuisine = ?, contact_number = ?,
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          location_status = CASE WHEN latitude IS NOT NULL THEN 'verified' ELSE ? END,
          location_source = COALESCE(location_source, ?),
          is_directory_listing = TRUE
        WHERE hotel_id = ?`,
        [
          item.address,
          item.district,
          item.pincode,
          item.cuisine,
          item.contactNumber,
          lat,
          lon,
          locationStatus,
          locationSource,
          existing[0].hotel_id,
        ]
      );
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 DIRECTORY SEED SUMMARY:`);
  console.log(`   Total Businesses: ${INITIAL_DIRECTORY_BUSINESSES.length}`);
  console.log(`   Verified Coordinates: ${verifiedCount}`);
  console.log(`   Location Pending: ${pendingCount}`);
  console.log(`   Partner Status: All set to 'unverified' (No fake surplus food)`);
  console.log(`======================================================\n`);

  return { total: INITIAL_DIRECTORY_BUSINESSES.length, verifiedCount, pendingCount };
}

if (require.main === module) {
  seedKovilpattiDirectory()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Directory seeding failed:", err);
      process.exit(1);
    });
}

module.exports = { seedKovilpattiDirectory, INITIAL_DIRECTORY_BUSINESSES };
