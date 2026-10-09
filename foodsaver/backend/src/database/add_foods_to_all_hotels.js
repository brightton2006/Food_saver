const { pool } = require("../config/database");

const FOOD_CATALOG = {
  biryani: [
    {
      name: "Hyderabadi Chicken Dum Biryani (Full Pack)",
      description: "Aromatic basmati rice cooked with tender marinated chicken, saffron & spices. Served with Raita and Salan.",
      category: "Biryani",
      categoryId: 4,
      isVeg: false,
      origPrice: 220,
      discPrice: 110,
      image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Seeraga Samba Mutton Biryani Box",
      description: "Authentic South Indian Seeraga Samba rice mutton biryani with rich flavor and ghee aroma.",
      category: "Biryani",
      categoryId: 4,
      isVeg: false,
      origPrice: 280,
      discPrice: 140,
      image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Chicken 65 Starter Box (6 Pcs)",
      description: "Crispy, spicy deep-fried chicken 65 marinated in curry leaves & South Indian spices.",
      category: "Starters",
      categoryId: 12,
      isVeg: false,
      origPrice: 160,
      discPrice: 80,
      image: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Kabab & Malabar Parotta Combo",
      description: "2 Flaky Malabar Parottas served with spicy Chicken Sukka / Kabab gravy.",
      category: "Main Course",
      categoryId: 11,
      isVeg: false,
      origPrice: 170,
      discPrice: 85,
      image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    },
  ],
  veg: [
    {
      name: "South Indian Special Thali / Meals",
      description: "Authentic Kovilpatti style meals: Steamed Rice, Sambar, Rasam, Kara Kuzhambu, Poriyal, Appalam & Payasam.",
      category: "Meals",
      categoryId: 6,
      isVeg: true,
      origPrice: 140,
      discPrice: 70,
      image: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Mini Tiffin Combo (Idli, Vada, Poori & Dosa)",
      description: "Delicious combo of 2 Idlis, 1 Medu Vada, 1 Poori Masala and Mini Masala Dosa with 3 Chutneys & Sambar.",
      category: "South Indian",
      categoryId: 2,
      isVeg: true,
      origPrice: 130,
      discPrice: 65,
      image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Special Ghee Roast Dosa Set (2 Pcs)",
      description: "Crispy golden Ghee Roast Dosa served with Coconut, Tomato & Mint chutneys and piping hot Sambar.",
      category: "South Indian",
      categoryId: 2,
      isVeg: true,
      origPrice: 95,
      discPrice: 48,
      image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Medu Vada & Sambar Pack (4 Pcs)",
      description: "Crispy lentil medu vadas spiced with black pepper and ginger, soaked in hot spiced sambar.",
      category: "Snacks",
      categoryId: 7,
      isVeg: true,
      origPrice: 70,
      discPrice: 35,
      image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    },
  ],
  bakery: [
    {
      name: "Kovilpatti Kadalai Mittai & Halwa Gift Box",
      description: "World-famous Kovilpatti Peanut Chikki (Kadalai Mittai) and fresh Tirunelveli Ghee Wheat Halwa pack.",
      category: "Desserts",
      categoryId: 9,
      isVeg: true,
      origPrice: 180,
      discPrice: 90,
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Fresh Cream Pastry & Cake Box (4 Pcs)",
      description: "Assorted fresh pastries including Black Forest, Chocolate Truffle, and Butterscotch slices.",
      category: "Desserts",
      categoryId: 9,
      isVeg: true,
      origPrice: 160,
      discPrice: 80,
      image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Hot Veg Puffs & Samosa Snack Combo (4 Pcs)",
      description: "Flaky baked vegetable puffs and crispy potato samosas served with sweet dates chutney.",
      category: "Snacks",
      categoryId: 7,
      isVeg: true,
      origPrice: 100,
      discPrice: 50,
      image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Assorted Traditional Sweets & Savouries Box (500g)",
      description: "Rich Laddu, Mysore Pak, Mixture and Murukku freshly prepared for evening snack time.",
      category: "Desserts",
      categoryId: 9,
      isVeg: true,
      origPrice: 240,
      discPrice: 120,
      image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80",
    },
  ],
  multicuisine: [
    {
      name: "Butter Naan & Paneer Butter Masala Meal",
      description: "2 Soft Butter Naans served with creamy Paneer Butter Masala curry and Jeera Rice.",
      category: "North Indian",
      categoryId: 3,
      isVeg: true,
      origPrice: 190,
      discPrice: 95,
      image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Chicken Fried Rice & Chilli Chicken Combo",
      description: "Wok-tossed Indo-Chinese chicken fried rice served with tangy, spicy chilli chicken gravy.",
      category: "Fast Food",
      categoryId: 10,
      isVeg: false,
      origPrice: 210,
      discPrice: 105,
      image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "North Indian Executive Veg Thali",
      description: "Butter Roti, Shahi Paneer, Dal Makhani, Veg Pulao, Salad, Raita & Gulab Jamun.",
      category: "Meals",
      categoryId: 6,
      isVeg: true,
      origPrice: 200,
      discPrice: 100,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Schezwan Hakka Noodles & Spring Rolls",
      description: "Spicy Schezwan vegetable noodles served with 2 crispy vegetable spring rolls.",
      category: "Fast Food",
      categoryId: 10,
      isVeg: true,
      origPrice: 170,
      discPrice: 85,
      image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
    },
  ],
};

function getCategoryPool(hotelName) {
  const name = (hotelName || "").toLowerCase();
  if (name.includes("biryani") || name.includes("biriyani") || name.includes("bhai") || name.includes("ameer")) {
    return FOOD_CATALOG.biryani;
  }
  if (name.includes("bakery") || name.includes("sweets") || name.includes("bakers") || name.includes("box")) {
    return FOOD_CATALOG.bakery;
  }
  if (name.includes("veg") || name.includes("bhavan") || name.includes("saravana") || name.includes("ananda") || name.includes("mess") || name.includes("greenleaf")) {
    return FOOD_CATALOG.veg;
  }
  return FOOD_CATALOG.multicuisine;
}

async function addFoodsToAllHotels() {
  console.log("=================================================");
  console.log("🍱 ADDING 30-DAY SURPLUS FOOD LISTINGS (NORMAL & NIGHT SALE) TO ALL HOTELS");
  console.log("=================================================\n");

  let connection;
  try {
    connection = await pool.getConnection();

    const [hotels] = await connection.query(
      "SELECT hotel_id, hotel_name, address, latitude, longitude FROM dim_hotels"
    );

    console.log(`Found ${hotels.length} hotels. Inserting 30-day food listings for normal & night sale pages...\n`);

    let totalListingsInserted = 0;
    const now = new Date();
    // Valid for 30 days
    const DAYS_VALID = 30;
    const expiresAt = new Date(now.getTime() + DAYS_VALID * 24 * 60 * 60 * 1000);

    for (let index = 0; index < hotels.length; index++) {
      const hotel = hotels[index];
      const foodItems = getCategoryPool(hotel.hotel_name);

      for (let fIdx = 0; fIdx < foodItems.length; fIdx++) {
        const item = foodItems[fIdx];
        const menuItemId = `menu_${hotel.hotel_id}_${fIdx + 1}`;
        const listingId = `lst_${hotel.hotel_id}_${fIdx + 1}`;

        // Alternate items between Normal (isNightSale = false) and Night Sale (isNightSale = true)
        const isNightSale = fIdx % 2 !== 0;

        // 1. Insert Menu Item
        await connection.query(
          `INSERT INTO dim_menu_items (
            menu_item_id, hotel_id, item_name, description, original_price, discount_price, is_veg, image_url, rating
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4.7)
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
            item.name,
            item.description,
            item.origPrice,
            item.discPrice,
            item.isVeg,
            item.image,
          ]
        );

        // 2. Insert Active 30-Day Listing
        const qtyTotal = 15 + (index % 5);
        const qtyAvail = 10 + (index % 4);

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
            ?, ?, ?, '09:00:00', '23:59:00', 'active',
            FALSE, ?, ?, '17:00:00', '23:59:00',
            ?, TRUE, 'Temperature-controlled counter', 'Fresh daily surplus',
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
            is_night_sale = VALUES(is_night_sale),
            expires_at = VALUES(expires_at),
            collection_deadline = VALUES(collection_deadline),
            latitude = VALUES(latitude),
            longitude = VALUES(longitude)`,
          [
            listingId,
            hotel.hotel_id,
            menuItemId,
            item.name,
            item.description,
            item.categoryId,
            item.isVeg,
            item.origPrice,
            item.discPrice,
            qtyTotal,
            qtyAvail,
            hotel.address || "Main Street, Kovilpatti",
            hotel.latitude || 9.1724,
            hotel.longitude || 77.8694,
            item.image,
            expiresAt,
            isNightSale,
            expiresAt,
          ]
        );

        totalListingsInserted++;
      }

      console.log(`✅ [${index + 1}/${hotels.length}] ${hotel.hotel_name}: Added ${foodItems.length} food listings (30 Days, Normal & Night Sale).`);
    }

    console.log(`\n=================================================`);
    console.log(`🎉 SUCCESS! Inserted ${totalListingsInserted} active 30-day food listings across all ${hotels.length} hotels.`);
    console.log(`=================================================\n`);
  } catch (err) {
    console.error("❌ Error adding food listings:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  addFoodsToAllHotels()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { addFoodsToAllHotels };
