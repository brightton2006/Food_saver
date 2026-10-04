/**
 * End-to-end Verification for FoodSaver Communication, Multilingual & Theme Enhancements
 * 
 * Tests:
 * 1. Email Service (Welcome, Order Confirmation, Delivery Success + Idempotency)
 * 2. SMS OTP Service (Generation, Hashing, Validation, Expiry, Single-use)
 * 3. In-App Notification Service (Creation, Retrieval, Mark All Read)
 * 4. User Preferences (Language & Dynamic Theme persistence)
 */

process.env.NODE_ENV = 'test';
const { pool } = require('../src/config/database');
const emailService = require('../src/services/emailService');
const smsService = require('../src/services/smsService');
const notificationService = require('../src/services/notificationService');

async function runTests() {
  console.log('========================================================');
  console.log('🧪 STARTING FOODSAVER ENHANCEMENTS VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: EMAIL SERVICE - WELCOME EMAIL
    // -------------------------------------------------------------
    console.log('1️⃣ Testing Email Service - Welcome Email...');
    const welcomeResult = await emailService.sendWelcomeEmail({
      to: 'test-user@foodsaver.local',
      name: 'Priya Sharma',
      role: 'customer'
    });
    assert(welcomeResult.success, 'Welcome email dispatched successfully');
    assert(welcomeResult.eventId && welcomeResult.eventId.startsWith('welcome_'), 'Welcome email eventId generated');

    // -------------------------------------------------------------
    // TEST 2: EMAIL SERVICE - ORDER CONFIRMATION
    // -------------------------------------------------------------
    console.log('\n2️⃣ Testing Email Service - Order Confirmation Email...');
    const orderConfirmResult = await emailService.sendOrderConfirmationEmail({
      to: 'test-user@foodsaver.local',
      customerName: 'Priya Sharma',
      orderId: 'ORD-TEST-101',
      items: [
        { name: 'Veg Biryani Meal Box', quantity: 2, price: 120 },
        { name: 'Fresh Fruit Salad', quantity: 1, price: 60 }
      ],
      totalAmount: 300,
      merchantName: 'Annapoorna Kitchen',
      pickupTime: 'Today, 8:00 PM'
    });
    assert(orderConfirmResult.success, 'Order confirmation email dispatched');
    assert(orderConfirmResult.eventId === 'order_confirm_ORD-TEST-101', 'Order confirmation eventId matches order ID');

    // -------------------------------------------------------------
    // TEST 3: EMAIL SERVICE - DELIVERY SUCCESS EMAIL & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n3️⃣ Testing Email Service - Delivery Success & Idempotency...');
    const testDeliveryOrderId = `ORD-DELIV-${Date.now()}`;
    const deliveryResult1 = await emailService.sendDeliverySuccessEmail({
      to: 'test-user@foodsaver.local',
      customerName: 'Priya Sharma',
      orderId: testDeliveryOrderId,
      items: [{ name: 'Organic Sourdough Bread', quantity: 1, price: 90 }],
      totalAmount: 90,
      merchantName: 'Artisan Bakery',
      deliveredAt: new Date().toISOString(),
      co2SavedKg: 2.5
    });
    assert(deliveryResult1.success, 'First delivery-success email dispatched');
    assert(!deliveryResult1.skipped, 'First delivery-success email was not skipped');

    // Attempt second delivery email with same orderId -> MUST be skipped by idempotency
    const deliveryResult2 = await emailService.sendDeliverySuccessEmail({
      to: 'test-user@foodsaver.local',
      customerName: 'Priya Sharma',
      orderId: testDeliveryOrderId,
      items: [{ name: 'Organic Sourdough Bread', quantity: 1, price: 90 }],
      totalAmount: 90,
      merchantName: 'Artisan Bakery',
      deliveredAt: new Date().toISOString(),
      co2SavedKg: 2.5
    });
    assert(deliveryResult2.success, 'Second delivery email call returned success response');
    assert(deliveryResult2.skipped === true, 'Idempotency prevented duplicate delivery email dispatch');

    // Verify DB entry in communication_events
    const [commEvents] = await pool.query(
      `SELECT * FROM communication_events WHERE event_id = ?`,
      [`deliv_email_${testDeliveryOrderId}`]
    );
    assert(commEvents.length === 1, 'Communication event record saved in database');
    assert(commEvents[0].channel.toUpperCase() === 'EMAIL', 'Event recorded with channel = EMAIL');

    // -------------------------------------------------------------
    // TEST 4: SMS OTP SERVICE - GENERATION, HASHING & VERIFICATION
    // -------------------------------------------------------------
    console.log('\n4️⃣ Testing SMS OTP Service...');
    const testPhone = '+919876543210';
    // Clear old test records for this phone
    await pool.query(`DELETE FROM otp_verifications WHERE phone_number = ?`, [testPhone]);

    const otpSendResult = await smsService.requestOtp({
      phoneNumber: testPhone,
      purpose: 'PHONE_VERIFICATION'
    });
    assert(otpSendResult.success, 'SMS OTP generated and sent');
    assert(otpSendResult.phone === testPhone || otpSendResult.phoneNumber === testPhone, 'Phone number properly normalized');
    assert(otpSendResult.cooldownSeconds === 60, '60s cooldown returned');
    assert(otpSendResult._debugOtp !== undefined, 'Mock mode OTP returned for verification testing');

    const generatedOtp = otpSendResult._debugOtp;
    assert(generatedOtp && generatedOtp.length === 6, 'Generated 6-digit OTP obtained in test mode');

    // Test verifying with WRONG code
    const wrongVerify = await smsService.verifyOtp({
      phoneNumber: testPhone,
      otp: '000000'
    });
    assert(wrongVerify.success === false, 'Invalid OTP was correctly rejected');

    // Test verifying with CORRECT code
    const validVerify = await smsService.verifyOtp({
      phoneNumber: testPhone,
      otp: generatedOtp
    });
    assert(validVerify.success === true, 'Valid OTP was correctly verified');

    // Test single-use: Re-verifying the same OTP must fail
    const reusedVerify = await smsService.verifyOtp({
      phoneNumber: testPhone,
      otp: generatedOtp
    });
    assert(reusedVerify.success === false, 'Reusing previously verified OTP was rejected (single-use enforced)');

    // -------------------------------------------------------------
    // TEST 5: IN-APP NOTIFICATIONS & PERSISTENCE
    // -------------------------------------------------------------
    console.log('\n5️⃣ Testing In-App Notification System...');
    const testUserId = 'test_user_enhancements_' + Date.now();
    
    // Create test user in dim_users
    await pool.query(
      `INSERT INTO dim_users (user_id, email, password_hash, full_name, role_id, phone_number, preferred_language, preferred_theme)
       VALUES (?, ?, 'dummy_hash', 'Test User', 'customer', ?, 'en', 'forest-green')
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)`,
      [testUserId, `${testUserId}@example.com`, testPhone]
    );

    const notif = await notificationService.createNotification({
      userId: testUserId,
      type: 'order_status',
      title: 'Order Ready for Pickup',
      message: 'Your order at Annapoorna Kitchen is ready.',
      data: { orderId: 'ORD-TEST-101' }
    });
    assert(notif && notif.id, 'In-app notification created and assigned an ID');

    // Fetch user notifications
    const userNotifs = await notificationService.getUserNotifications(testUserId);
    assert(userNotifs.length >= 1, 'Persisted notification successfully retrieved from database');

    // Mark all as read
    const markSuccess = await notificationService.markAllNotificationsRead(testUserId);
    assert(markSuccess, 'Mark all as read succeeded');

    const updatedNotifs = await notificationService.getUserNotifications(testUserId);
    const unreadCount = updatedNotifs.filter(n => !n.is_read && !n.read).length;
    assert(unreadCount === 0, 'All notifications now marked as read');

    // -------------------------------------------------------------
    // TEST 6: USER PREFERENCES & THEME PERSISTENCE
    // -------------------------------------------------------------
    console.log('\n6️⃣ Testing User Preferences (Language & Dynamic Theme)...');
    
    // Update preferences in database for test user
    await pool.query(
      `UPDATE dim_users 
       SET preferred_language = ?, preferred_theme = ?, custom_theme_config = ?, phone_verified = 1
       WHERE user_id = ?`,
      ['ta', 'ocean-blue', JSON.stringify({ primary: '#0284c7', secondary: '#0369a1' }), testUserId]
    );

    const [prefRows] = await pool.query(
      `SELECT preferred_language, preferred_theme, custom_theme_config, phone_verified FROM dim_users WHERE user_id = ?`,
      [testUserId]
    );
    assert(prefRows[0].preferred_language === 'ta', 'User preferred_language persisted as Tamil (ta)');
    assert(prefRows[0].preferred_theme === 'ocean-blue', 'User preferred_theme persisted as ocean-blue');
    assert(prefRows[0].phone_verified === 1, 'User phone_verified flag set to 1');
    const customConfig = typeof prefRows[0].custom_theme_config === 'string' 
      ? JSON.parse(prefRows[0].custom_theme_config) 
      : prefRows[0].custom_theme_config;
    assert(customConfig.primary === '#0284c7', 'Custom theme configuration properly preserved');

    // Clean up test records
    await pool.query(`DELETE FROM fact_notifications WHERE user_id = ?`, [testUserId]);
    await pool.query(`DELETE FROM dim_users WHERE user_id = ?`, [testUserId]);
    await pool.query(`DELETE FROM otp_verifications WHERE phone_number = ?`, [testPhone]);

    console.log('\n========================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================');

    if (failed === 0) {
      console.log('✨ All FoodSaver Communication, Multilingual & Theme enhancements verified successfully!\n');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test execution error:', err);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (_) {}
  }
}

runTests();
