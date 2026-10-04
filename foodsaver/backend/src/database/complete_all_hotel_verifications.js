const { pool } = require("../config/database");
const store = require("../data/store");

async function completeAndApproveAllHotels() {
  console.log("=================================================");
  console.log("🏨 SUBMITTING & VERIFYING ALL HOTELS FOR ADMIN APPROVAL");
  console.log("=================================================\n");

  let connection;
  try {
    connection = await pool.getConnection();

    // Get all hotels
    const [hotels] = await connection.query(`
      SELECT h.hotel_id, h.merchant_user_id, h.hotel_name, h.address, h.contact_number, u.email, u.full_name
      FROM dim_hotels h
      LEFT JOIN dim_users u ON h.merchant_user_id = u.user_id
    `);

    const summary = [];

    // 0. Ensure Admin user exists for FK constraint
    let [admins] = await connection.query("SELECT user_id FROM dim_users WHERE role_id = 'admin' LIMIT 1");
    let adminUserId = admins.length > 0 ? admins[0].user_id : 'usr_test_admin';
    if (admins.length === 0) {
      await connection.query(
        `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status)
         VALUES ('usr_test_admin', 'admin', 'admin@foodsaver.com', '$2a$10$R9h/cIPz0gi.URNNWBROlOKFfP0G34n7/5G0Q30q8k/Eep6gA8J1q', 'Platform Admin', '+91 9876543210', TRUE, 'APPROVED')
         ON DUPLICATE KEY UPDATE role_id = 'admin', status = 'APPROVED'`
      );
    }

    for (let index = 0; index < hotels.length; index++) {
      const hotel = hotels[index];
      const userId = hotel.merchant_user_id || `usr_mkt_${hotel.hotel_id}`;
      const hotelId = hotel.hotel_id;
      const hotelName = hotel.hotel_name;

      const fssaiNum = `124210${String(10000000 + index)}`;
      const gstinNum = `33AAAAA${String(1000 + index)}A1Z${index % 10}`;

      // 1. Ensure user is merchant in dim_users
      await connection.query(
        `INSERT INTO dim_users (
          user_id, role_id, email, password_hash, full_name, phone_number, is_active, status
        ) VALUES (?, 'merchant', ?, '$2a$10$R9h/cIPz0gi.URNNWBROlOKFfP0G34n7/5G0Q30q8k/Eep6gA8J1q', ?, '+91 9876543210', TRUE, 'PENDING')
        ON DUPLICATE KEY UPDATE
          role_id = 'merchant',
          status = 'PENDING',
          is_active = TRUE`,
        [userId, hotel.email || `${hotelId}@gmail.com`, hotelName]
      );

      // 2. Submit Merchant Onboarding (creates verification application + admin notification)
      const appId = `ver_${hotelId}`;
      await connection.query(
        `INSERT INTO dim_verification_applications (
          application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name, status, submitted_at
        ) VALUES (?, ?, ?, 'merchant', 'South Indian', ?, 'FSSAI License', ?, 'under_review', NOW())
        ON DUPLICATE KEY UPDATE
          business_name = VALUES(business_name),
          registration_details = VALUES(registration_details),
          status = 'under_review',
          submitted_at = NOW()`,
        [appId, userId, hotelName, `FSSAI: ${fssaiNum} | GST: ${gstinNum}`, `fssai_${hotelId}.pdf`]
      );

      // 3. Create Admin Notification for verification
      const notifId = `notif_ver_${hotelId}`;
      await connection.query(
        `INSERT INTO fact_admin_notifications (notification_id, admin_user_id, hotel_id, application_id, notification_type, message, is_read)
         VALUES (?, ?, ?, ?, 'NEW_MERCHANT_PROFILE_SUBMITTED', ?, FALSE)
         ON DUPLICATE KEY UPDATE message = VALUES(message)`,
        [notifId, adminUserId, hotelId, appId, `Merchant profile submitted for ${hotelName}. Pending admin verification.`]
      );

      // 4. Update hotel status to SUBMITTED & under_review
      await connection.query(
        `UPDATE dim_hotels 
         SET merchant_user_id = ?, status = 'SUBMITTED', verification_status = 'under_review' 
         WHERE hotel_id = ?`,
        [userId, hotelId]
      );

      // 5. Admin Approve synchronously
      await store.updateMerchantApproval(hotelId, "APPROVED", "admin-system");

      summary.push({
        hotelId,
        hotelName,
        onboardingStatus: "SUBMITTED & VERIFIED",
        adminStatus: "APPROVED",
        verificationStatus: "approved",
      });
    }

    console.log("✅ All hotel verification submissions and admin approvals completed!\n");
    console.table(summary);

    return summary;
  } catch (err) {
    console.error("❌ Error completing hotel verifications:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

if (require.main === module) {
  completeAndApproveAllHotels()
    .then(() => {
      console.log("🎉 All hotels successfully submitted & verified by Admin!");
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { completeAndApproveAllHotels };
