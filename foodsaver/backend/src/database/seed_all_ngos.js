const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

const NGO_LIST = [
  {
    ngoId: "ngo_main_01",
    ngoName: "Kovilpatti Food Relief NGO",
    email: "ngoname@gmail.com",
    address: "45 Temple Road, Market Area, Kovilpatti",
    city: "Kovilpatti",
    district: "Thoothukudi",
    lat: 9.1724,
    lng: 77.8694,
    phone: "+91 4632 220999",
  },
  {
    ngoId: "ngo_kp_01",
    ngoName: "Kovilpatti Annadhanam Trust",
    email: "kovilpattiannadhanatrust@gmail.com",
    address: "12 Shenbagavalli Amman Kovil Street, Kovilpatti",
    city: "Kovilpatti",
    district: "Thoothukudi",
    lat: 9.1740,
    lng: 77.8712,
    phone: "+91 4632 221050",
  },
  {
    ngoId: "ngo_kp_02",
    ngoName: "Kovilpatti Surplus Food Rescue Foundation",
    email: "kovilpattisurplusfoodrescue@gmail.com",
    address: "88 Market Road, Indira Nagar, Kovilpatti",
    city: "Kovilpatti",
    district: "Thoothukudi",
    lat: 9.1728,
    lng: 77.8696,
    phone: "+91 4632 220880",
  },
  {
    ngoId: "ngo_tut_01",
    ngoName: "Thoothukudi District Food Bank NGO",
    email: "thoothukudidistrictfoodbank@gmail.com",
    address: "34 WGC Road, Thoothukudi",
    city: "Thoothukudi",
    district: "Thoothukudi",
    lat: 8.8052,
    lng: 78.1452,
    phone: "+91 461 2345678",
  },
  {
    ngoId: "ngo_mdu_01",
    ngoName: "Madurai Hunger Relief & Food Rescue",
    email: "maduraihungerrelief@gmail.com",
    address: "105 West Masi Street, Madurai",
    city: "Madurai",
    district: "Madurai",
    lat: 9.9195,
    lng: 78.1194,
    phone: "+91 452 2345678",
  },
  {
    ngoId: "ngo_chn_01",
    ngoName: "Chennai Surplus Food Rescue Society",
    email: "chennaisurplusfoodrescue@gmail.com",
    address: "50 Anna Salai, T Nagar, Chennai",
    city: "Chennai",
    district: "Chennai",
    lat: 13.0418,
    lng: 80.2341,
    phone: "+91 44 28345678",
  },
  {
    ngoId: "ngo_cbe_01",
    ngoName: "Coimbatore Community Food Bank",
    email: "coimbatorecommunityfoodbank@gmail.com",
    address: "18 RS Puram Main Road, Coimbatore",
    city: "Coimbatore",
    district: "Coimbatore",
    lat: 11.0018,
    lng: 76.9558,
    phone: "+91 422 2345678",
  },
  {
    ngoId: "ngo_tni_01",
    ngoName: "Tirunelveli Seva Relief Foundation",
    email: "tirunelvelisevarelief@gmail.com",
    address: "22 High Ground Road, Tirunelveli Junction",
    city: "Tirunelveli",
    district: "Tirunelveli",
    lat: 8.7139,
    lng: 77.7567,
    phone: "+91 462 2345678",
  },
];

async function seedAllNgos() {
  console.log("=================================================");
  console.log("🤝 SEEDING VERIFIED NGO ACCOUNTS & CREDENTIALS");
  console.log("   Primary NGO Email: ngoname@gmail.com");
  console.log("   Passwords: ngo@123 / no@123");
  console.log("=================================================\n");

  const passwordsToHash = ["ngo@123", "no@123"];
  const passwordHash = await bcrypt.hash("ngo@123", 10);

  let connection;
  try {
    connection = await pool.getConnection();

    for (let index = 0; index < NGO_LIST.length; index++) {
      const ngo = NGO_LIST[index];
      const userId = `usr_${ngo.ngoId}`;

      // 1. Insert or Update User in dim_users
      await connection.query(
        `INSERT INTO dim_users (
          user_id, role_id, email, password_hash, full_name, phone_number,
          is_active, status, latitude, longitude, approved_at
        ) VALUES (?, 'ngo', ?, ?, ?, ?, TRUE, 'APPROVED', ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          role_id = 'ngo',
          full_name = VALUES(full_name),
          status = 'APPROVED',
          is_active = TRUE,
          latitude = VALUES(latitude),
          longitude = VALUES(longitude)`,
        [userId, ngo.email, passwordHash, ngo.ngoName, ngo.phone, ngo.lat, ngo.lng]
      );

      // 2. Insert or Update NGO record in dim_ngos
      await connection.query(
        `INSERT INTO dim_ngos (
          ngo_id, ngo_user_id, ngo_name, organization_type, registration_number,
          description, address, contact_number, service_radius_km, verification_status, status,
          latitude, longitude
        ) VALUES (
          ?, ?, ?, 'Trust', ?,
          'Verified community food rescue and distribution organization', ?,
          ?, 15.0, 'approved', 'APPROVED',
          ?, ?
        )
        ON DUPLICATE KEY UPDATE
          ngo_user_id = VALUES(ngo_user_id),
          ngo_name = VALUES(ngo_name),
          address = VALUES(address),
          contact_number = VALUES(contact_number),
          verification_status = 'approved',
          status = 'APPROVED',
          latitude = VALUES(latitude),
          longitude = VALUES(longitude)`,
        [
          ngo.ngoId,
          userId,
          ngo.ngoName,
          `REG-NGO-TN-2026-00${index + 1}`,
          ngo.address,
          ngo.phone,
          ngo.lat,
          ngo.lng,
        ]
      );

      console.log(`✅ NGO Configured: [${ngo.ngoName}]`);
      console.log(`   └─ Email: ${ngo.email} | Passwords: ngo@123 / no@123`);
      console.log(`   └─ City: ${ngo.city} | Status: VERIFIED & APPROVED\n`);
    }

    // Re-create backward compatibility ngos view if needed
    await connection.query(
      `CREATE OR REPLACE VIEW ngos AS SELECT ngo_id, ngo_user_id, ngo_name, organization_type, registration_number, description, website, address, contact_number, service_radius_km, verification_status, status, rejection_reason, latitude, longitude, created_at, updated_at FROM dim_ngos`
    ).catch(() => {});

    console.log("=================================================");
    console.log("🎉 ALL NGO ACCOUNTS SUCCESSFULLY SEEDED & APPROVED!");
    console.log("=================================================\n");
  } catch (err) {
    console.error("❌ Error seeding NGO accounts:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  seedAllNgos()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedAllNgos, NGO_LIST };
