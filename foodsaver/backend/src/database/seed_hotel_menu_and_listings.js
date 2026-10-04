const { pool } = require("../config/database");

const MENU_ITEMS = [
  {
    itemId: "menu_001",
    hotelId: "htl_test_merchant_01",
    name: "South Indian Special Thali / Meals",
    description: "Authentic Kovilpatti style meals with Rice, Sambar, Rasam, Kara Kuzhambu, Poriyal, Kootu, Appalam & Payasam.",
    originalPrice: 140.00,
    discountPrice: 70.00,
    isVeg: true,
    imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=1000&q=80",
    rating: 4.8,
    categoryName: "Meals",
  },
  {
    itemId: "menu_002",
    hotelId: "htl_test_merchant_01",
    name: "Special Ghee Roast Dosa Set",
    description: "Crispy Golden Ghee Dosa served with 3 varieties of Chutney (Coconut, Tomato, Mint) and piping hot Sambar.",
    originalPrice: 90.00,
    discountPrice: 45.00,
    isVeg: true,
    imageUrl: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    rating: 4.7,
    categoryName: "South Indian",
  },
  {
    itemId: "menu_003",
    hotelId: "htl_test_merchant_01",
    name: "Medu Vada Combo (4 Pcs)",
    description: "Crispy fried lentil vadas infused with pepper and curry leaves, served with Coconut Chutney.",
    originalPrice: 60.00,
    discountPrice: 30.00,
    isVeg: true,
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=80",
    rating: 4.6,
    categoryName: "Snacks",
  },
  {
    itemId: "menu_004",
    hotelId: "htl_test_merchant_01",
    name: "Kovilpatti Special Chikki & Sweets Box",
    description: "Famous Kovilpatti Kadalai Mittai (Peanut Chikki) and Ghee Halwa fresh box.",
    originalPrice: 160.00,
    discountPrice: 80.00,
    isVeg: true,
    imageUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1000&q=80",
    rating: 4.9,
    categoryName: "Desserts",
  }
];

const ACTIVE_LISTINGS = [
  {
    listingId: "lst_test_01",
    hotelId: "htl_test_merchant_01",
    menuItemId: "menu_001",
    itemName: "South Indian Special Thali / Meals",
    description: "Closing hour surplus: Complete thali meal box freshly packed.",
    categoryId: 6, // Meals
    isVeg: true,
    originalPrice: 140.00,
    discountPrice: 70.00,
    quantityTotal: 10,
    quantityAvailable: 10,
    address: "124 Main Road, Kovilpatti",
    lat: 9.1748868,
    lng: 77.8658213,
    imageUrl: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=1000&q=80",
    pickupWindowStart: "19:00:00",
    pickupWindowEnd: "22:30:00",
    isNightSale: true,
    saleWindowStart: "18:00:00",
    saleWindowEnd: "23:00:00",
    hoursValid: 6,
  },
  {
    listingId: "lst_test_02",
    hotelId: "htl_test_merchant_01",
    menuItemId: "menu_002",
    itemName: "Special Ghee Roast Dosa Set",
    description: "Closing hour surplus: 2 Ghee Roast Dosa with Chutneys.",
    categoryId: 2, // South Indian
    isVeg: true,
    originalPrice: 90.00,
    discountPrice: 45.00,
    quantityTotal: 8,
    quantityAvailable: 8,
    address: "124 Main Road, Kovilpatti",
    lat: 9.1748868,
    lng: 77.8658213,
    imageUrl: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1000&q=80",
    pickupWindowStart: "19:00:00",
    pickupWindowEnd: "22:30:00",
    isNightSale: true,
    saleWindowStart: "18:00:00",
    saleWindowEnd: "23:00:00",
    hoursValid: 6,
  },
];

async function seedHotelMenuAndListings() {
  console.log("=================================================");
  console.log("🍛 SEEDING GENUINE HOTEL MENU ITEMS & ACTIVE SURPLUS LISTINGS");
  console.log("=================================================\n");

  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Seed Menu Items
    for (const m of MENU_ITEMS) {
      await connection.query(
        `INSERT INTO dim_menu_items (
          menu_item_id, hotel_id, item_name, description, original_price, discount_price, is_veg, image_url, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          item_name = VALUES(item_name),
          description = VALUES(description),
          original_price = VALUES(original_price),
          discount_price = VALUES(discount_price),
          is_veg = VALUES(is_veg),
          image_url = VALUES(image_url),
          rating = VALUES(rating)`,
        [m.itemId, m.hotelId, m.name, m.description, m.originalPrice, m.discountPrice, m.isVeg, m.imageUrl, m.rating]
      );
      console.log(`✅ Menu Item created: "${m.name}" @ ₹${m.discountPrice} (Orig: ₹${m.originalPrice})`);
    }

    // 2. Seed Active Surplus Food Listings
    const now = new Date();
    for (const l of ACTIVE_LISTINGS) {
      const expiresAt = new Date(now.getTime() + l.hoursValid * 60 * 60 * 1000);

      await connection.query(
        `INSERT INTO fact_listings (
          listing_id, hotel_id, menu_item_id, item_name, description, category_id, is_veg,
          original_price, discount_price, quantity_total, quantity_available, address,
          latitude, longitude, image_url, pickup_window_start, pickup_window_end, status,
          notified_ngo, expires_at, is_night_sale, sale_window_start, sale_window_end,
          collection_deadline, delivery_supported, safe_storage_info, food_prep_time,
          food_safety_approved, eligible_for_ngo
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, 'active',
          FALSE, ?, ?, ?, ?,
          ?, TRUE, 'Temperature-controlled counter', 'Fresh daily surplus',
          TRUE, TRUE
        )
        ON DUPLICATE KEY UPDATE
          item_name = VALUES(item_name),
          original_price = VALUES(original_price),
          discount_price = VALUES(discount_price),
          quantity_total = VALUES(quantity_total),
          quantity_available = VALUES(quantity_available),
          status = 'active',
          expires_at = VALUES(expires_at)`,
        [
          l.listingId, l.hotelId, l.menuItemId, l.itemName, l.description, l.categoryId, l.isVeg,
          l.originalPrice, l.discountPrice, l.quantityTotal, l.quantityAvailable, l.address,
          l.lat, l.lng, l.imageUrl, l.pickupWindowStart, l.pickupWindowEnd,
          expiresAt, l.isNightSale, l.saleWindowStart, l.saleWindowEnd, expiresAt
        ]
      );
      console.log(`✅ Active Listing created: "${l.itemName}" (Qty: ${l.quantityAvailable}) [Expires: ${expiresAt.toLocaleTimeString()}]`);
    }

    console.log("\n=================================================");
    console.log("🎉 HOTEL MENU & SURPLUS LISTINGS SEEDED SUCCESSFULLY!");
    console.log("=================================================\n");
  } catch (err) {
    console.error("❌ Error seeding menu and listings:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  seedHotelMenuAndListings()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedHotelMenuAndListings };
