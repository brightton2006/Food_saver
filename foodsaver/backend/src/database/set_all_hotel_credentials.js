const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

function generateEmail(hotelName, hotelId) {
  const cleanName = hotelName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  
  if (!cleanName) {
    return `hotel_${hotelId.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com`;
  }

  return `${cleanName}@gmail.com`;
}

async function setHotelCredentials() {
  console.log("=================================================");
  console.log("🏨 UPDATING ALL HOTEL OWNER LOGINS & PASSWORDS");
  console.log("   Password: hotel@123");
  console.log("   Email Format: <hotelname>@gmail.com");
  console.log("=================================================\n");

  const password = "hotel@123";
  const passwordHash = await bcrypt.hash(password, 10);

  let connection;
  try {
    connection = await pool.getConnection();

    // Fetch all hotels
    const [hotels] = await connection.query("SELECT hotel_id, merchant_user_id, hotel_name, address, contact_number, latitude, longitude FROM dim_hotels");

    // Fetch all existing users in dim_users to build email-to-user mapping
    const [existingUsers] = await connection.query("SELECT user_id, email FROM dim_users");
    const emailToUserMap = new Map();
    for (const u of existingUsers) {
      if (u.email) {
        emailToUserMap.set(u.email.toLowerCase(), u.user_id);
      }
    }

    const assignedEmails = new Set();
    const credentialsList = [];

    for (const hotel of hotels) {
      let baseEmail = generateEmail(hotel.hotel_name, hotel.hotel_id);
      let finalEmail = baseEmail;
      let count = 1;

      let userId = hotel.merchant_user_id || `usr_mkt_${hotel.hotel_id}`;

      // Ensure finalEmail is uniquely available for this userId
      while (true) {
        const emailLower = finalEmail.toLowerCase();
        const isAssignedInLoop = assignedEmails.has(emailLower);
        const ownerInDb = emailToUserMap.get(emailLower);
        const isOwnedByOtherInDb = ownerInDb && ownerInDb !== userId;

        if (!isAssignedInLoop && !isOwnedByOtherInDb) {
          break;
        }

        count++;
        const namePart = baseEmail.split("@")[0];
        finalEmail = `${namePart}${count}@gmail.com`;
      }

      assignedEmails.add(finalEmail.toLowerCase());
      emailToUserMap.set(finalEmail.toLowerCase(), userId);

      if (hotel.merchant_user_id) {
        // Update existing user
        await connection.query(
          `UPDATE dim_users 
           SET email = ?, password_hash = ?, role_id = 'merchant', status = 'APPROVED', is_active = TRUE, full_name = ?
           WHERE user_id = ?`,
          [finalEmail, passwordHash, hotel.hotel_name, userId]
        );
      } else {
        // Create a new merchant user for this hotel
        await connection.query(
          `INSERT INTO dim_users (
            user_id, role_id, email, password_hash, full_name, phone_number,
            is_active, status, latitude, longitude, approved_at
          ) VALUES (?, 'merchant', ?, ?, ?, ?, TRUE, 'APPROVED', ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            password_hash = VALUES(password_hash),
            role_id = 'merchant',
            status = 'APPROVED',
            is_active = TRUE`,
          [
            userId,
            finalEmail,
            passwordHash,
            hotel.hotel_name,
            hotel.contact_number || "+91 9876543210",
            hotel.latitude || 9.1724,
            hotel.longitude || 77.8694,
          ]
        );

        // Update hotel's merchant_user_id
        await connection.query(
          "UPDATE dim_hotels SET merchant_user_id = ? WHERE hotel_id = ?",
          [userId, hotel.hotel_id]
        );
      }

      credentialsList.push({
        hotelName: hotel.hotel_name,
        hotelId: hotel.hotel_id,
        email: finalEmail,
        password: password,
      });
    }

    console.log("✅ Credentials updated successfully for all hotels:\n");
    console.table(credentialsList);

    return credentialsList;
  } catch (err) {
    console.error("❌ Error setting hotel credentials:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  setHotelCredentials()
    .then(() => {
      console.log("🎉 All hotel logins configured!");
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { setHotelCredentials };
