const assert = require("assert");
const crypto = require("crypto");
const { pool } = require("../src/config/database");
const { requestEmailOtp, verifyEmailOtp, hashOtp } = require("../src/services/emailOtpService");
const store = require("../src/data/store");

const { initializeDatabase } = require("../src/database/initDb");

async function testEmailOtpVerificationSystem() {
  process.env.NODE_ENV = "test";
  console.log("==================================================");
  console.log("✉️ TESTING REAL EMAIL OTP VERIFICATION SYSTEM");
  console.log("==================================================\n");

  // Ensure Email OTP tables exist in MySQL
  await pool.query(`
    ALTER TABLE dim_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE NOT NULL, ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_otp_verifications (
      id VARCHAR(50) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      user_id VARCHAR(50) NULL,
      otp_hash VARCHAR(255) NOT NULL,
      purpose VARCHAR(50) DEFAULT 'EMAIL_VERIFICATION' NOT NULL,
      attempts INT DEFAULT 0 NOT NULL,
      max_attempts INT DEFAULT 5 NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_email_otp (email, is_verified, expires_at)
    )
  `);

  const testEmail = `test_otp_user_${Date.now()}@foodsaver.test`;
  const testName = "Test Email Verification User";
  const testPassword = "Password@123";
  const testUserId = `usr_test_${crypto.randomBytes(6).toString("hex")}`;

  try {
    // 1. Clean up any existing test records
    await pool.query("DELETE FROM email_otp_verifications WHERE LOWER(email) = ?", [testEmail]);
    await pool.query("DELETE FROM dim_users WHERE LOWER(email) = ?", [testEmail]);

    // 2. Register user in dim_users with email_verified = FALSE
    console.log("🔹 1. Registering new pending user in database...");
    const bcrypt = require("bcryptjs");
    const passHash = await bcrypt.hash(testPassword, 10);
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status, email_verified, created_at)
       VALUES (?, 'CUSTOMER', ?, ?, ?, TRUE, 'PENDING', FALSE, NOW())`,
      [testUserId, testEmail, passHash, testName]
    );

    const [initUser] = await pool.query("SELECT * FROM dim_users WHERE user_id = ?", [testUserId]);
    assert.strictEqual(initUser[0].email_verified, 0, "User email_verified should initially be FALSE (0)");
    console.log(`   - User created: ID='${testUserId}', email_verified=0 ✅`);

    // 3. Test Request OTP & Hashed Generation
    console.log("\n🔹 2. Requesting Email OTP (crypto 6-digit generation)...");
    const reqRes = await requestEmailOtp({
      email: testEmail,
      name: testName,
      userId: testUserId,
      purpose: "EMAIL_VERIFICATION",
    });

    assert.strictEqual(reqRes.success, true, "OTP dispatch should succeed");
    assert.strictEqual(reqRes.cooldownSeconds, 60, "Resend cooldown should be 60 seconds");
    console.log(`   - ${reqRes.message} ✅`);

    // Verify OTP record in DB
    const [otpRows] = await pool.query(
      "SELECT id, otp_hash, attempts, max_attempts, is_verified, expires_at FROM email_otp_verifications WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1",
      [testEmail]
    );
    assert(otpRows.length > 0, "Email OTP verification record must exist in DB");
    assert.strictEqual(otpRows[0].attempts, 0, "Initial attempt count must be 0");
    assert.strictEqual(otpRows[0].max_attempts, 5, "Max attempts should be 5");
    assert.strictEqual(otpRows[0].is_verified, 0, "Initial is_verified must be FALSE (0)");
    console.log(`   - DB Record verified: ID='${otpRows[0].id}', Hash='${otpRows[0].otp_hash.slice(0, 10)}...' ✅`);

    // 4. Test Cooldown Enforcement (60 Seconds)
    console.log("\n🔹 3. Testing 60-Second Resend Cooldown Enforcement...");
    const immediateResend = await requestEmailOtp({
      email: testEmail,
      name: testName,
      userId: testUserId,
      purpose: "EMAIL_VERIFICATION",
    });
    assert.strictEqual(immediateResend.success, false, "Immediate resend should be blocked by cooldown");
    assert.strictEqual(immediateResend.code, "COOLDOWN_ACTIVE");
    console.log(`   - Cooldown blocked resend: ${immediateResend.error} ✅`);

    // 5. Test Unverified Food Purchase Block ("customer once verified only they buy a food here")
    console.log("\n🔹 4. Testing Unverified Customer Food Purchase Restriction...");
    const unverifiedClaim = await store.claimListing("lst_kov_001", {
      customerId: testUserId,
      customerName: testName,
      quantity: 1,
    });
    assert.strictEqual(unverifiedClaim.error, "EMAIL_VERIFICATION_REQUIRED", "Unverified customer must be blocked from buying food");
    console.log(`   - Unverified customer food purchase correctly blocked: '${unverifiedClaim.message}' ✅`);

    // 6. Test Invalid OTP Code Rejection & Attempt Counter
    console.log("\n🔹 5. Testing Incorrect OTP Rejection & Attempt Tracking...");
    const wrongVerify = await verifyEmailOtp({
      email: testEmail,
      otp: "000000",
      userId: testUserId,
    });
    assert.strictEqual(wrongVerify.success, false, "Wrong 6-digit code must be rejected");
    assert.strictEqual(wrongVerify.code, "INVALID_OTP");
    assert.strictEqual(wrongVerify.remainingAttempts, 4, "Remaining attempts should decrement to 4");
    console.log(`   - Wrong OTP rejected: ${wrongVerify.error} ✅`);

    // 7. Test Valid OTP Verification (using debug OTP in test mode)
    console.log("\n🔹 6. Testing Valid OTP Verification & Single-Use Invalidation...");
    const validOtp = reqRes._debugOtp;
    assert(validOtp && validOtp.length === 6, "Valid 6-digit OTP obtained from service");

    const validVerify = await verifyEmailOtp({
      email: testEmail,
      otp: validOtp,
      userId: testUserId,
    });
    assert.strictEqual(validVerify.success, true, "Valid OTP verification should succeed");
    console.log(`   - Email OTP verified successfully: ${validVerify.message} ✅`);

    // Verify DB update on dim_users
    const [updatedUser] = await pool.query("SELECT email_verified, email_verified_at, status FROM dim_users WHERE user_id = ?", [testUserId]);
    assert.strictEqual(updatedUser[0].email_verified, 1, "dim_users.email_verified should now be TRUE (1)");
    assert(updatedUser[0].email_verified_at, "dim_users.email_verified_at timestamp should be set");
    console.log(`   - dim_users updated: email_verified=1 at ${updatedUser[0].email_verified_at} ✅`);

    // 8. Test Single-Use Invalidation (Re-verifying same OTP must fail)
    console.log("\n🔹 7. Testing OTP Single-Use Invalidation...");
    const reusedVerify = await verifyEmailOtp({
      email: testEmail,
      otp: validOtp,
      userId: testUserId,
    });
    assert.strictEqual(reusedVerify.success, false, "Re-verifying an already used OTP must fail");
    assert.strictEqual(reusedVerify.code, "ALREADY_VERIFIED");
    console.log(`   - Single-use enforced: ${reusedVerify.error} ✅`);

    // 9. Test Verified Customer Food Purchase Success
    console.log("\n🔹 8. Testing Verified Customer Food Purchase Success...");
    const verifiedClaim = await store.claimListing("lst_kov_001", {
      customerId: testUserId,
      customerName: testName,
      quantity: 1,
    });
    assert.notStrictEqual(verifiedClaim.error, "EMAIL_VERIFICATION_REQUIRED", "Verified customer must pass email verification check");
    console.log(`   - Verified customer email authorization check passed! (Claim status: ${verifiedClaim.ok ? "Success" : verifiedClaim.error}) ✅`);

    // Clean up test data
    await pool.query("DELETE FROM email_otp_verifications WHERE LOWER(email) = ?", [testEmail]);
    await pool.query("DELETE FROM dim_users WHERE LOWER(email) = ?", [testEmail]);

    console.log("\n==================================================");
    console.log("🎉 ALL EMAIL OTP VERIFICATION TESTS PASSED!");
    console.log("==================================================\n");
  } catch (err) {
    // Clean up on failure
    await pool.query("DELETE FROM email_otp_verifications WHERE LOWER(email) = ?", [testEmail]).catch(() => {});
    await pool.query("DELETE FROM dim_users WHERE LOWER(email) = ?", [testEmail]).catch(() => {});
    throw err;
  }
}

if (require.main === module) {
  testEmailOtpVerificationSystem()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Test failed:", err);
      process.exit(1);
    });
}

module.exports = { testEmailOtpVerificationSystem };
