const { pool } = require("../config/database");

async function addNightSaleSpecialToAllHotels() {
  console.log("=================================================");
  console.log("🌙 ADDING 30-DAY NIGHT SALE SPECIAL FOOD TO ALL HOTELS");
  console.log("=================================================\n");

  let connection;
  try {
    connection = await pool.getConnection();

    const [hotels] = await connection.query(
      "SELECT hotel_id, hotel_name, address, latitude, longitude FROM dim_hotels"
    );

    console.log(`Found ${hotels.length} hotels. Adding 30-day Midnight Flash Sale Special items...\n`);

    let totalListingsInserted = 0;
    const now = new Date();
    // Valid for 30 days
    const DAYS_VALID = 30;
    const expiresAt = new Date(now.getTime() + DAYS_VALID * 24 * 60 * 60 * 1000);

    for (let index = 0; index < hotels.length; index++) {
      const hotel = hotels[index];
      const hotelName = (hotel.hotel_name || "").toLowerCase();

      const isVegOnly = hotelName.includes("veg") || hotelName.includes("bhavan") || hotelName.includes("saravana") || hotelName.includes("ananda") || hotelName.includes("bakery") || hotelName.includes("sweets");

      const menuItemId = `menu_night_special_${hotel.hotel_id}`;
      const listingId = `lst_night_special_${hotel.hotel_id}`;

      const itemName = isVegOnly
        ? "Midnight Super Saver Veg Feast Box (70% OFF)"
        : "Midnight Super Saver Deluxe Biryani & Starter Combo (70% OFF)";

      const description = isVegOnly
        ? "Exclusive late-night surplus feast: Variety Rice, Paneer Butter Masala, 2 Butter Naans, Crispy Samosa & Dessert."
        : "Exclusive late-night surplus combo: Special Chicken Biryani, Crispy Chicken 65, Parotta & Gulab Jamun.";

      const originalPrice = isVegOnly ? 260 : 320;
      const discountPrice = isVegOnly ? 78 : 96;
      const imageUrl = isVegOnly
        ? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
        : "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80";

      // 1. Insert or Update Menu Item
      await connection.query(
        `INSERT INTO dim_menu_items (
          menu_item_id, hotel_id, item_name, description, original_price, discount_price, is_veg, image_url, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4.9)
        ON DUPLICATE KEY UPDATE
          item_name = VALUES(item_name),
          description = VALUES(description),
          original_price = VALUES(original_price),
          discount_price = VALUES(discount_price),
          is_veg = VALUES(is_veg),
          image_url = VALUES(image_url)`,
        [
          menuItemId,
          hotel.hotel_id,
          itemName,
          description,
          originalPrice,
          discountPrice,
          isVegOnly,
          imageUrl,
        ]
      );

      // 2. Insert or Update Active 30-Day Night Sale Listing
      const qtyTotal = 12 + (index % 5);
      const qtyAvail = 8 + (index % 4);

      await connection.query(
        `INSERT INTO fact_listings (
          listing_id, hotel_id, menu_item_id, item_name, description, category_id, is_veg,
          original_price, discount_price, quantity_total, quantity_available, address,
          latitude, longitude, image_url, pickup_window_start, pickup_window_end, status,
          notified_ngo, expires_at, is_night_sale, sale_window_start, sale_window_end,
          collection_deadline, delivery_supported, safe_storage_info, food_prep_time,
          food_safety_approved, eligible_for_ngo
        ) VALUES (
          ?, ?, ?, ?, ?, 6, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, '18:00:00', '23:59:00', 'active',
          FALSE, ?, TRUE, '18:00:00', '23:59:00',
          ?, TRUE, 'Insulated hot counter', 'Prepared fresh this evening',
          TRUE, TRUE
        )
        ON DUPLICATE KEY UPDATE
          item_name = VALUES(item_name),
          description = VALUES(description),
          original_price = VALUES(original_price),
          discount_price = VALUES(discount_price),
          quantity_total = VALUES(quantity_total),
          quantity_available = VALUES(quantity_available),
          status = 'active',
          is_night_sale = TRUE,
          expires_at = VALUES(expires_at),
          collection_deadline = VALUES(collection_deadline),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude)`,
        [
          listingId,
          hotel.hotel_id,
          menuItemId,
          itemName,
          description,
          isVegOnly,
          originalPrice,
          discountPrice,
          qtyTotal,
          qtyAvail,
          hotel.address || "Main Street, Kovilpatti",
          hotel.latitude || 9.1724,
          hotel.longitude || 77.8694,
          imageUrl,
          expiresAt,
          expiresAt,
        ]
      );

      totalListingsInserted++;
      console.log(`🌙 [${index + 1}/${hotels.length}] ${hotel.hotel_name}: Added 30-Day Night Sale Special item ("${itemName}")`);
    }

    console.log(`\n=================================================`);
    console.log(`🎉 SUCCESS! Added 30-day Night Sale Special items to all ${hotels.length} hotels.`);
    console.log(`=================================================\n`);
  } catch (err) {
    console.error("❌ Error adding night sale items:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  addNightSaleSpecialToAllHotels()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { addNightSaleSpecialToAllHotels };
