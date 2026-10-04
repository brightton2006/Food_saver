const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

function generateHotelEmail(hotelName, hotelId) {
  const cleanName = hotelName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  
  if (!cleanName) {
    return `hotel_${hotelId.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`;
  }

  return `${cleanName}@gmail.com`;
}

const ALL_DISTRICT_HOTELS = [
  // 1. ARIYALUR
  {
    id: "htl_tn_ari_01",
    name: "Hotel Sri Vigneshwara Ariyalur",
    district: "Ariyalur",
    city: "Ariyalur",
    address: "Bus Stand Road, Ariyalur",
    lat: 11.1401,
    lng: 79.0786,
    cuisine: "South Indian Vegetarian & Thali",
    phone: "+91 4329 221122",
    foods: [
      { name: "Ariyalur Special Meals Thali", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Crispy Onion Rava Dosa", orig: 80, disc: 40, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 2. CHENGALPATTU
  {
    id: "htl_tn_cpt_01",
    name: "Hotel Saravana Bhavan Chengalpattu",
    district: "Chengalpattu",
    city: "Chengalpattu",
    address: "GST Road, Chengalpattu",
    lat: 12.6939,
    lng: 79.9757,
    cuisine: "South Indian Tiffin & Filter Coffee",
    phone: "+91 44 2742 3344",
    foods: [
      { name: "Special Ghee Roast Dosa Set", orig: 110, disc: 55, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" },
      { name: "Chengalpattu Highway Mini Tiffin", orig: 130, disc: 65, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 3. CHENNAI
  {
    id: "htl_tn_chn_01",
    name: "Hotel Saravana Bhavan T Nagar",
    district: "Chennai",
    city: "Chennai",
    address: "15 Nageswaran Road, T Nagar, Chennai",
    lat: 13.0418,
    lng: 80.2341,
    cuisine: "South Indian Vegetarian",
    phone: "+91 44 28151234",
    foods: [
      { name: "Ghee Roast Dosa Set", orig: 110, disc: 55, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" },
      { name: "Mini Tiffin Combo", orig: 140, disc: 70, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Full South Indian Meals", orig: 160, disc: 80, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" }
    ]
  },
  {
    id: "htl_tn_chn_02",
    name: "Adyar Ananda Bhavan Anna Nagar",
    district: "Chennai",
    city: "Chennai",
    address: "2nd Avenue, Anna Nagar, Chennai",
    lat: 13.0850,
    lng: 80.2101,
    cuisine: "South Indian Sweets & Tiffin",
    phone: "+91 44 26215678",
    foods: [
      { name: "Ghee Sweets Gift Box (500g)", orig: 260, disc: 130, isVeg: true, categoryId: 9, img: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80" },
      { name: "Paneer Butter Masala & Naan", orig: 190, disc: 95, isVeg: true, categoryId: 3, img: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80" }
    ]
  },
  {
    id: "htl_tn_chn_03",
    name: "Buhari Hotel Mount Road",
    district: "Chennai",
    city: "Chennai",
    address: "830 Anna Salai, Mount Road, Chennai",
    lat: 13.0604,
    lng: 80.2670,
    cuisine: "Biryani & Non-Veg",
    phone: "+91 44 28529999",
    foods: [
      { name: "Original Chicken 65 & Biryani Combo", orig: 290, disc: 145, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" },
      { name: "Mutton Dum Biryani Full Pack", orig: 320, disc: 160, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 4. COIMBATORE
  {
    id: "htl_tn_cbe_01",
    name: "Annapoorna Gowrishankar RS Puram",
    district: "Coimbatore",
    city: "Coimbatore",
    address: "DB Road, RS Puram, Coimbatore",
    lat: 11.0065,
    lng: 76.9510,
    cuisine: "Pure Veg Sambar Idli & Tiffin",
    phone: "+91 422 2471111",
    foods: [
      { name: "Annapoorna Sambar Vadai Combo", orig: 75, disc: 38, isVeg: true, categoryId: 7, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80" },
      { name: "Ghee Masala Dosa Set", orig: 100, disc: 50, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },
  {
    id: "htl_tn_cbe_02",
    name: "Hari Bhavanam Peelamedu",
    district: "Coimbatore",
    city: "Coimbatore",
    address: "Avinashi Road, Peelamedu, Coimbatore",
    lat: 11.0280,
    lng: 77.0020,
    cuisine: "Kongu Non-Veg Naattu Kozhi",
    phone: "+91 422 2598888",
    foods: [
      { name: "Kongu Naattu Kozhi Biryani Pack", orig: 240, disc: 120, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" },
      { name: "Pallipalayam Chicken Fry Box", orig: 190, disc: 95, isVeg: false, categoryId: 12, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 5. CUDDALORE
  {
    id: "htl_tn_cdl_01",
    name: "Hotel Anandha Cuddalore",
    district: "Cuddalore",
    city: "Cuddalore",
    address: "Beach Road, Cuddalore",
    lat: 11.7480,
    lng: 79.7714,
    cuisine: "South Indian Tiffin & Seafood",
    phone: "+91 4142 230999",
    foods: [
      { name: "Cuddalore Special Meals Box", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Fresh Cuddalore Fish Fry & Parotta", orig: 180, disc: 90, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 6. DHARMAPURI
  {
    id: "htl_tn_dmp_01",
    name: "Hotel Sri Ram Dharmapuri",
    district: "Dharmapuri",
    city: "Dharmapuri",
    address: "Nethaji Bypass, Dharmapuri",
    lat: 12.1357,
    lng: 78.1560,
    cuisine: "South Indian Vegetarian",
    phone: "+91 4342 260888",
    foods: [
      { name: "Dharmapuri Rava Dosa Set", orig: 90, disc: 45, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Sambar Idli Combo", orig: 70, disc: 35, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 7. DINDIGUL
  {
    id: "htl_tn_dgl_01",
    name: "Thalappakatti Biriyani GT Road",
    district: "Dindigul",
    city: "Dindigul",
    address: "GT Road, Dindigul",
    lat: 10.3640,
    lng: 77.9780,
    cuisine: "Dindigul Seeraga Samba Biryani",
    phone: "+91 451 2432222",
    foods: [
      { name: "Dindigul Mutton Seeraga Samba Biryani", orig: 290, disc: 145, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80" },
      { name: "Dindigul Chicken Biryani Box", orig: 230, disc: 115, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 8. ERODE
  {
    id: "htl_tn_erd_01",
    name: "Thirupathi Mess Brough Road",
    district: "Erode",
    city: "Erode",
    address: "Brough Road, Erode",
    lat: 11.3420,
    lng: 77.7210,
    cuisine: "Erode Special Meals & Tiffin",
    phone: "+91 424 2223333",
    foods: [
      { name: "Erode Paruppu Podi Meals", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Erode Kothu Parotta", orig: 140, disc: 70, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 9. KALLAKURICHI
  {
    id: "htl_tn_klk_01",
    name: "Hotel Saravana Bhavan Kallakurichi",
    district: "Kallakurichi",
    city: "Kallakurichi",
    address: "Salem Main Road, Kallakurichi",
    lat: 11.7384,
    lng: 78.9639,
    cuisine: "South Indian Vegetarian & Tiffin",
    phone: "+91 4151 223344",
    foods: [
      { name: "Kallakurichi Special Meals Thali", orig: 125, disc: 60, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Ghee Masala Dosa Set", orig: 90, disc: 45, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 10. KANCHIPURAM
  {
    id: "htl_tn_kpm_01",
    name: "Hotel Kanchi Sri Saravana Gandhi Road",
    district: "Kanchipuram",
    city: "Kanchipuram",
    address: "Gandhi Road, Kanchipuram",
    lat: 12.8342,
    lng: 79.7036,
    cuisine: "Kanchipuram Idli & South Indian",
    phone: "+91 44 2722 2222",
    foods: [
      { name: "Kanchipuram Kovil Idli (2 Pcs) & Chutney", orig: 85, disc: 42, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Kanchi Special South Indian Meals", orig: 140, disc: 70, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 11. KANYAKUMARI
  {
    id: "htl_tn_ngl_01",
    name: "Hotel Arya Bhavan Nagercoil",
    district: "Kanyakumari",
    city: "Nagercoil",
    address: "Cape Road, Nagercoil",
    lat: 8.1833,
    lng: 77.4119,
    cuisine: "Nanjil Nadu Cuisine & Meals",
    phone: "+91 4652 231111",
    foods: [
      { name: "Nanjil Special Coconut Rice & Avial", orig: 140, disc: 70, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Kanyakumari Fish Curry & Meals Combo", orig: 190, disc: 95, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 12. KARUR
  {
    id: "htl_tn_krr_01",
    name: "Hotel Arunachala Karur",
    district: "Karur",
    city: "Karur",
    address: "Kovai Road, Karur",
    lat: 10.9601,
    lng: 78.0766,
    cuisine: "South Indian Tiffin & Meals",
    phone: "+91 4324 261111",
    foods: [
      { name: "Karur Special Meals Thali", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Karur Chicken Chukka Parotta Set", orig: 170, disc: 85, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 13. KRISHNAGIRI
  {
    id: "htl_tn_kgi_01",
    name: "Hotel Saravana Bhavan Krishnagiri",
    district: "Krishnagiri",
    city: "Krishnagiri",
    address: "Bengaluru Road, Krishnagiri",
    lat: 12.5186,
    lng: 78.2137,
    cuisine: "South Indian Highway Tiffin",
    phone: "+91 4343 234111",
    foods: [
      { name: "Highway Mini Tiffin Combo", orig: 120, disc: 60, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Crispy Butter Masala Dosa", orig: 95, disc: 48, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 14. MADURAI
  {
    id: "htl_tn_mdu_01",
    name: "Murugan Idli Shop West Masi",
    district: "Madurai",
    city: "Madurai",
    address: "196 West Masi Street, Madurai",
    lat: 9.9175,
    lng: 78.1160,
    cuisine: "Soft Mallipoo Idli & Tiffin",
    phone: "+91 452 2341234",
    foods: [
      { name: "Madurai Soft Mallipoo Idli (4 Pcs)", orig: 80, disc: 40, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Ghee Podi Dosa", orig: 95, disc: 48, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },
  {
    id: "htl_tn_mdu_02",
    name: "Amma Mess KK Nagar",
    district: "Madurai",
    city: "Madurai",
    address: "12 Lake View Road, KK Nagar, Madurai",
    lat: 9.9320,
    lng: 78.1410,
    cuisine: "Madurai Non-Veg Kari Dosa",
    phone: "+91 452 2589999",
    foods: [
      { name: "Madurai Mutton Kari Dosa", orig: 220, disc: 110, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" },
      { name: "Chicken Chukka & Parotta Set", orig: 180, disc: 90, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 15. MAYILADUTHURAI
  {
    id: "htl_tn_myd_01",
    name: "Hotel Kaliyakudi Mayiladuthurai",
    district: "Mayiladuthurai",
    city: "Mayiladuthurai",
    address: "Pattamangalam Street, Mayiladuthurai",
    lat: 11.1018,
    lng: 79.6521,
    cuisine: "Heritage South Indian Vegetarian",
    phone: "+91 4364 222555",
    foods: [
      { name: "Mayiladuthurai Special South Indian Meals", orig: 135, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Ghee Podi Idli & Vadai Combo", orig: 80, disc: 40, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 16. NAGAPATTINAM
  {
    id: "htl_tn_ngp_01",
    name: "Hotel Sea Breeze Nagapattinam",
    district: "Nagapattinam",
    city: "Nagapattinam",
    address: "Public Office Road, Nagapattinam",
    lat: 10.7672,
    lng: 79.8449,
    cuisine: "Coastal Seafood & Biryani",
    phone: "+91 4365 221234",
    foods: [
      { name: "Nagapattinam Fish Curry & Rice Combo", orig: 220, disc: 110, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" },
      { name: "Prawn Thokku & Malabar Parotta Set", orig: 240, disc: 120, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 17. NAMAKKAL
  {
    id: "htl_tn_nmk_01",
    name: "Hotel Selvam Namakkal",
    district: "Namakkal",
    city: "Namakkal",
    address: "Salem Road, Namakkal",
    lat: 11.2189,
    lng: 78.1674,
    cuisine: "Namakkal Special Egg Biryani & Non-Veg",
    phone: "+91 4286 231122",
    foods: [
      { name: "Namakkal Special Egg Biryani Pack", orig: 160, disc: 80, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" },
      { name: "Nattu Kozhi Pepper Fry Box", orig: 210, disc: 105, isVeg: false, categoryId: 12, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 18. NILGIRIS / OOTY
  {
    id: "htl_tn_oty_01",
    name: "Hotel Nahar Ooty",
    district: "Nilgiris",
    city: "Ooty",
    address: "Charing Cross, Ooty",
    lat: 11.4102,
    lng: 76.6950,
    cuisine: "Ooty Chocolates & Multi-Cuisine",
    phone: "+91 423 2442173",
    foods: [
      { name: "Ooty Homemade Chocolates Box (250g)", orig: 250, disc: 125, isVeg: true, categoryId: 9, img: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80" },
      { name: "Fresh Cream Pastry & Cake Pack", orig: 180, disc: 90, isVeg: true, categoryId: 9, img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 19. PERAMBALUR
  {
    id: "htl_tn_pbl_01",
    name: "Hotel Dhanalakshmi Perambalur",
    district: "Perambalur",
    city: "Perambalur",
    address: "Trichy Main Road, Perambalur",
    lat: 11.2342,
    lng: 78.8820,
    cuisine: "South Indian Tiffin & Meals",
    phone: "+91 4328 277888",
    foods: [
      { name: "Perambalur Executive Meals Thali", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Hot Sambar Vada Box", orig: 70, disc: 35, isVeg: true, categoryId: 7, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 20. PUDUKKOTTAI
  {
    id: "htl_tn_pdk_01",
    name: "Hotel Sri Vasantha Bhavan Pudukkottai",
    district: "Pudukkottai",
    city: "Pudukkottai",
    address: "East Main Street, Pudukkottai",
    lat: 10.3833,
    lng: 78.8167,
    cuisine: "Pudukkottai Special Tiffin & Non-Veg",
    phone: "+91 4322 221555",
    foods: [
      { name: "Pudukkottai Muttai Parotta Combo", orig: 150, disc: 75, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Ghee Onion Dosa Set", orig: 90, disc: 45, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 21. RAMANATHAPURAM
  {
    id: "htl_tn_rmd_01",
    name: "Hotel Rameswaram Grand",
    district: "Ramanathapuram",
    city: "Rameswaram",
    address: "Bus Stand Road, Rameswaram",
    lat: 9.2876,
    lng: 79.3129,
    cuisine: "Pure Veg Temple Tiffin",
    phone: "+91 4573 221555",
    foods: [
      { name: "Rameswaram Temple Special Meals", orig: 120, disc: 60, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "South Indian Mini Breakfast Set", orig: 100, disc: 50, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 22. RANIPET
  {
    id: "htl_tn_rpt_01",
    name: "Hotel Sri Balaji Ranipet",
    district: "Ranipet",
    city: "Ranipet",
    address: "MBT Road, Ranipet",
    lat: 12.9290,
    lng: 79.3331,
    cuisine: "South Indian Tiffin & Biryani",
    phone: "+91 4172 272233",
    foods: [
      { name: "Ranipet Special Chicken Biryani", orig: 200, disc: 100, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Ghee Masala Dosa", orig: 90, disc: 45, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 23. SALEM
  {
    id: "htl_tn_slm_01",
    name: "Selvi Mess Fairlands",
    district: "Salem",
    city: "Salem",
    address: "Omalur Main Road, Fairlands, Salem",
    lat: 11.6780,
    lng: 78.1410,
    cuisine: "Salem Mutton Biryani & Non-Veg",
    phone: "+91 427 2447777",
    foods: [
      { name: "Salem Special Mutton Biryani", orig: 260, disc: 130, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80" },
      { name: "Nattu Kozhi Varuval Box", orig: 210, disc: 105, isVeg: false, categoryId: 12, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 24. SIVAGANGA
  {
    id: "htl_tn_svg_01",
    name: "Chettinad Mansion Karaikudi",
    district: "Sivaganga",
    city: "Karaikudi",
    address: "Kanadukathan, Karaikudi",
    lat: 10.0722,
    lng: 78.7844,
    cuisine: "Authentic Chettinad Non-Veg",
    phone: "+91 4565 273456",
    foods: [
      { name: "Chettinad Kozhi Varuval & Parotta Combo", orig: 220, disc: 110, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" },
      { name: "Chettinad Crab Curry & Rice Pack", orig: 270, disc: 135, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 25. TENKASI
  {
    id: "htl_tn_tks_01",
    name: "Rahmath Border Parotta Kadai",
    district: "Tenkasi",
    city: "Tenkasi",
    address: "Courtallam Road, Tenkasi",
    lat: 8.9598,
    lng: 77.3134,
    cuisine: "World Famous Border Parotta & Salna",
    phone: "+91 4633 222111",
    foods: [
      { name: "Famous Border Oil Parotta (4 Pcs) & Mutton Salna", orig: 170, disc: 85, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Nattu Kozhi Country Chicken Fry", orig: 220, disc: 110, isVeg: false, categoryId: 12, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 26. THANJAVUR
  {
    id: "htl_tn_tjv_01",
    name: "Hotel Gnanam Thanjavur",
    district: "Thanjavur",
    city: "Thanjavur",
    address: "Old Bus Stand, Thanjavur",
    lat: 10.7860,
    lng: 79.1380,
    cuisine: "South Indian Vegetarian Thali",
    phone: "+91 4362 278500",
    foods: [
      { name: "Thanjavur Royal Meals Box", orig: 150, disc: 75, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Thanjavur Sambar Vada Set", orig: 75, disc: 38, isVeg: true, categoryId: 7, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 27. THENI
  {
    id: "htl_tn_thn_01",
    name: "Hotel Western Gats Theni",
    district: "Theni",
    city: "Theni",
    address: "Bypass Road, Theni",
    lat: 10.0104,
    lng: 77.4768,
    cuisine: "Highrange South Indian & Juice",
    phone: "+91 4546 253333",
    foods: [
      { name: "Cumbum Grape Juice & South Indian Meals", orig: 140, disc: 70, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Chicken Chukka & Malabar Parotta Set", orig: 180, disc: 90, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 28. THOOTHUKUDI (TUTICORIN)
  {
    id: "htl_tn_tut_01",
    name: "Alagar Sweets & Bakery WGC Road",
    district: "Thoothukudi",
    city: "Thoothukudi",
    address: "WGC Road, Thoothukudi",
    lat: 8.7610,
    lng: 78.1310,
    cuisine: "Tuticorin Macaroon & Sweets",
    phone: "+91 461 2321111",
    foods: [
      { name: "Famous Tuticorin Cashew Macaroons (250g)", orig: 220, disc: 110, isVeg: true, categoryId: 9, img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80" },
      { name: "Tirunelveli Ghee Halwa & Savouries Box", orig: 160, disc: 80, isVeg: true, categoryId: 9, img: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 29. TIRUCHIRAPPALLI (TRICHY)
  {
    id: "htl_tn_try_01",
    name: "Hotel Vasantha Bhavan Thillai Nagar",
    district: "Tiruchirappalli",
    city: "Tiruchirappalli",
    address: "Salai Road, Thillai Nagar, Trichy",
    lat: 10.8240,
    lng: 78.6860,
    cuisine: "South Indian Vegetarian Meals",
    phone: "+91 431 2745555",
    foods: [
      { name: "Trichy Executive Thali Meals", orig: 150, disc: 75, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Hot Medu Vada Box (4 Pcs)", orig: 70, disc: 35, isVeg: true, categoryId: 7, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 30. TIRUNELVELI
  {
    id: "htl_tn_tni_01",
    name: "Iruttukadai Halwa Tirunelveli",
    district: "Tirunelveli",
    city: "Tirunelveli",
    address: "West Car Street, Tirunelveli Town",
    lat: 8.7280,
    lng: 77.6890,
    cuisine: "Tirunelveli Ghee Wheat Halwa",
    phone: "+91 462 2334444",
    foods: [
      { name: "Original Tirunelveli Ghee Halwa (500g)", orig: 180, disc: 90, isVeg: true, categoryId: 9, img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Mixture & Savouries Box", orig: 120, disc: 60, isVeg: true, categoryId: 7, img: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80" }
    ]
  },
  {
    id: "htl_tn_tni_02",
    name: "Hotel Janakiram Junction",
    district: "Tirunelveli",
    city: "Tirunelveli",
    address: "Madurai Road, Tirunelveli Junction",
    lat: 8.7140,
    lng: 77.7210,
    cuisine: "Multi-Cuisine South Indian",
    phone: "+91 462 2331111",
    foods: [
      { name: "Nellai Special Meals Box", orig: 140, disc: 70, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Chicken Biryani & Raitha Pack", orig: 200, disc: 100, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 31. TIRUPATHUR
  {
    id: "htl_tn_tpt_01",
    name: "Hotel Sri Sai Tirupathur",
    district: "Tirupathur",
    city: "Tirupathur",
    address: "Vaniyambadi Road, Tirupathur",
    lat: 12.4926,
    lng: 78.5679,
    cuisine: "South Indian Tiffin & Biryani",
    phone: "+91 4179 220555",
    foods: [
      { name: "Tirupathur Chicken Biryani Pack", orig: 190, disc: 95, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" },
      { name: "Mini Tiffin Combo", orig: 110, disc: 55, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 32. TIRUPPUR
  {
    id: "htl_tn_tpr_01",
    name: "Hotel Royal Plaza Tiruppur",
    district: "Tiruppur",
    city: "Tiruppur",
    address: "Avinashi Road, Tiruppur",
    lat: 11.1085,
    lng: 77.3411,
    cuisine: "Kongu Special Meals & Non-Veg",
    phone: "+91 421 2234567",
    foods: [
      { name: "Tiruppur Pallipalayam Chicken Rice", orig: 200, disc: 100, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" },
      { name: "Ghee Masala Dosa Set", orig: 95, disc: 48, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 33. TIRUVALLUR
  {
    id: "htl_tn_tvl_01",
    name: "Hotel Sri Vasantham Tiruvallur",
    district: "Tiruvallur",
    city: "Tiruvallur",
    address: "JN Road, Tiruvallur",
    lat: 13.1432,
    lng: 79.9079,
    cuisine: "South Indian Vegetarian Tiffin",
    phone: "+91 44 2766 1234",
    foods: [
      { name: "Tiruvallur Special South Indian Thali", orig: 135, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Ghee Roast Dosa Set", orig: 100, disc: 50, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 34. TIRUVANNAMALAI
  {
    id: "htl_tn_tvm_01",
    name: "Hotel Sri Ramana Tiruvannamalai",
    district: "Tiruvannamalai",
    city: "Tiruvannamalai",
    address: "Chengam Road, Tiruvannamalai",
    lat: 12.2253,
    lng: 79.0747,
    cuisine: "Girivalam Pure Veg Thali & Coffee",
    phone: "+91 4175 237777",
    foods: [
      { name: "Girivalam Special Pure Veg Thali", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Hot Filter Coffee & Medu Vada Combo", orig: 65, disc: 32, isVeg: true, categoryId: 7, img: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 35. TIRUVARUR
  {
    id: "htl_tn_tvr_01",
    name: "Hotel Selvam Tiruvarur",
    district: "Tiruvarur",
    city: "Tiruvarur",
    address: "Netaji Road, Tiruvarur",
    lat: 10.7726,
    lng: 79.6365,
    cuisine: "South Indian Traditional Tiffin & Meals",
    phone: "+91 4366 222444",
    foods: [
      { name: "Tiruvarur Traditional South Indian Meals", orig: 130, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Special Onion Uthappam Box", orig: 85, disc: 42, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 36. VELLORE
  {
    id: "htl_tn_vel_01",
    name: "Hotel Darling Residency Green Circle",
    district: "Vellore",
    city: "Vellore",
    address: "Officer's Line, Green Circle, Vellore",
    lat: 12.9240,
    lng: 79.1360,
    cuisine: "Multi-Cuisine North & South Indian",
    phone: "+91 416 2213000",
    foods: [
      { name: "Butter Naan & Paneer Masala", orig: 180, disc: 90, isVeg: true, categoryId: 3, img: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80" },
      { name: "Vellore Biryani & Chilli Chicken Combo", orig: 230, disc: 115, isVeg: false, categoryId: 4, img: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 37. VILUPPURAM
  {
    id: "htl_tn_vpm_01",
    name: "Hotel Vasantha Bhavan Viluppuram",
    district: "Viluppuram",
    city: "Viluppuram",
    address: "Trichy Main Road, Viluppuram",
    lat: 11.9401,
    lng: 79.4861,
    cuisine: "South Indian Highway Tiffin & Meals",
    phone: "+91 4146 224455",
    foods: [
      { name: "Viluppuram Highway Special Meals", orig: 135, disc: 65, isVeg: true, categoryId: 6, img: "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=800&q=80" },
      { name: "Crispy Masala Dosa Set", orig: 90, disc: 45, isVeg: true, categoryId: 2, img: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80" }
    ]
  },

  // 38. VIRUDHUNAGAR
  {
    id: "htl_tn_vrn_01",
    name: "Virudhunagar Ennai Parotta Kadai",
    district: "Virudhunagar",
    city: "Virudhunagar",
    address: "Madurai Road, Virudhunagar",
    lat: 9.5872,
    lng: 77.9514,
    cuisine: "Virudhunagar Oil Parotta",
    phone: "+91 4562 245111",
    foods: [
      { name: "Virudhunagar Coin Parotta (4 Pcs) & Chicken Salna", orig: 160, disc: 80, isVeg: false, categoryId: 11, img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80" },
      { name: "Virudhunagar Mutton Chukka Box", orig: 210, disc: 105, isVeg: false, categoryId: 12, img: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80" }
    ]
  }
];

async function integrateAllDistrictHotels() {
  console.log("=================================================");
  console.log("🌏 INTEGRATING ALL 38 TAMIL NADU DISTRICT HOTELS & FOOD LISTINGS");
  console.log("   Common Password for All Hotels: hotel@123");
  console.log("   Username Format: hotelname@gmail.com");
  console.log("=================================================\n");

  const passwordHash = await bcrypt.hash("hotel@123", 10);
  let connection;

  try {
    connection = await pool.getConnection();

    // 1. Process & Seed Tamil Nadu District Hotels
    let hotelCount = 0;
    let foodCount = 0;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const h of ALL_DISTRICT_HOTELS) {
      const email = generateHotelEmail(h.name, h.id);
      const userId = `usr_mkt_${h.id}`;

      // Insert/Update User
      await connection.query(
        `INSERT INTO dim_users (
          user_id, role_id, email, password_hash, full_name, phone_number,
          is_active, status, latitude, longitude, approved_at, phone_verified
        ) VALUES (?, 'merchant', ?, ?, ?, ?, TRUE, 'APPROVED', ?, ?, NOW(), TRUE)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          password_hash = VALUES(password_hash),
          status = 'APPROVED',
          is_active = TRUE`,
        [userId, email, passwordHash, h.name, h.phone, h.lat, h.lng]
      );

      // Insert/Update Hotel
      await connection.query(
        `INSERT INTO dim_hotels (
          hotel_id, merchant_user_id, hotel_name, address, location_city, district,
          contact_number, cuisine, status, verification_status, latitude, longitude,
          delivery_available, takeaway_available
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, 'APPROVED', 'approved', ?, ?,
          TRUE, TRUE
        )
        ON DUPLICATE KEY UPDATE
          hotel_name = VALUES(hotel_name),
          address = VALUES(address),
          location_city = VALUES(location_city),
          district = VALUES(district),
          status = 'APPROVED',
          verification_status = 'approved',
          latitude = VALUES(latitude),
          longitude = VALUES(longitude)`,
        [h.id, userId, h.name, h.address, h.city, h.district, h.phone, h.cuisine, h.lat, h.lng]
      );

      hotelCount++;

      // Insert/Update Foods
      for (let fIdx = 0; fIdx < h.foods.length; fIdx++) {
        const item = h.foods[fIdx];
        const menuItemId = `menu_${h.id}_${fIdx + 1}`;
        const listingId = `lst_${h.id}_${fIdx + 1}`;

        await connection.query(
          `INSERT INTO dim_menu_items (
            menu_item_id, hotel_id, item_name, description, original_price, discount_price, is_veg, image_url, rating
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 4.8)
          ON DUPLICATE KEY UPDATE
            item_name = VALUES(item_name),
            original_price = VALUES(original_price),
            discount_price = VALUES(discount_price),
            is_veg = VALUES(is_veg),
            image_url = VALUES(image_url)`,
          [menuItemId, h.id, item.name, `${h.name} daily fresh offer`, item.orig, item.disc, item.isVeg, item.img]
        );

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
            ?, ?, 10, 8, ?,
            ?, ?, ?, '18:00:00', '23:00:00', 'active',
            FALSE, ?, TRUE, '17:00:00', '23:30:00',
            ?, TRUE, 'Temperature-controlled counter', 'Fresh daily surplus',
            TRUE, TRUE
          )
          ON DUPLICATE KEY UPDATE
            item_name = VALUES(item_name),
            original_price = VALUES(original_price),
            discount_price = VALUES(discount_price),
            status = 'active',
            expires_at = VALUES(expires_at),
            latitude = VALUES(latitude),
            longitude = VALUES(longitude)`,
          [
            listingId, h.id, menuItemId, item.name, `${h.name} fresh surplus deal`, item.categoryId, item.isVeg,
            item.orig, item.disc, h.address, h.lat, h.lng, item.img, expiresAt, expiresAt
          ]
        );

        foodCount++;
      }
    }

    // 2. Ensure ALL hotels in dim_hotels have password hotel@123 and valid username hotelname@gmail.com
    const [allUsers] = await connection.query("SELECT user_id, email FROM dim_users WHERE role_id = 'merchant'");
    const existingEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));

    const [allHotels] = await connection.query("SELECT hotel_id, merchant_user_id, hotel_name FROM dim_hotels");

    for (const h of allHotels) {
      let baseEmail = generateHotelEmail(h.hotel_name, h.hotel_id);
      let finalEmail = baseEmail;
      let counter = 1;

      let userId = h.merchant_user_id || `usr_mkt_${h.hotel_id}`;

      // Ensure user exists
      const [uRows] = await connection.query("SELECT user_id, email FROM dim_users WHERE user_id = ?", [userId]);
      if (uRows.length > 0) {
        const currentEmail = uRows[0].email.toLowerCase();
        if (currentEmail !== finalEmail && existingEmails.has(finalEmail)) {
          finalEmail = currentEmail; // keep existing valid email if already assigned
        }
        await connection.query(
          `UPDATE dim_users 
           SET password_hash = ?, role_id = 'merchant', status = 'APPROVED', is_active = TRUE
           WHERE user_id = ?`,
          [passwordHash, userId]
        );
        existingEmails.add(finalEmail);
      } else {
        while (existingEmails.has(finalEmail)) {
          counter++;
          finalEmail = `${baseEmail.split("@")[0]}${counter}@gmail.com`;
        }
        await connection.query(
          `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status, latitude, longitude)
           VALUES (?, 'merchant', ?, ?, ?, '+91 9876543210', TRUE, 'APPROVED', 9.1724, 77.8694)`,
          [userId, finalEmail, passwordHash, h.hotel_name]
        );
        existingEmails.add(finalEmail);
        await connection.query("UPDATE dim_hotels SET merchant_user_id = ? WHERE hotel_id = ?", [userId, h.hotel_id]);
      }
    }

    // Print summary table of all hotels
    const [finalHotelList] = await connection.query(`
      SELECT h.hotel_name, h.location_city as district, u.email, 'hotel@123' as password, h.status, h.verification_status
      FROM dim_hotels h
      JOIN dim_users u ON h.merchant_user_id = u.user_id
      ORDER BY h.location_city, h.hotel_name
    `);

    console.log("✅ All district hotels integrated successfully:\n");
    console.table(finalHotelList);

    console.log(`\n=================================================`);
    console.log(`🎉 COMPLETE SUCCESS!`);
    console.log(`   - Total District Hotels: ${finalHotelList.length}`);
    console.log(`   - Total Active Surplus Food Listings: ${foodCount}`);
    console.log(`   - Password for ALL Hotels: hotel@123`);
    console.log(`   - Email Format: hotelname@gmail.com`);
    console.log(`=================================================\n`);
  } catch (err) {
    console.error("❌ Error integrating district hotels:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  integrateAllDistrictHotels()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { integrateAllDistrictHotels };
