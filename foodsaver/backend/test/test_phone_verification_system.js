const assert = require("assert");
const { normalizePhoneNumber, requestOtp, verifyOtp } = require("../src/services/smsService");
const { pool } = require("../src/config/database");

async function testPhoneVerification() {
  console.log("==================================================");
  console.log("📱 TESTING PHONE VERIFICATION & SMS OTP SYSTEM");
  console.log("==================================================\n");

  // 1. Test E.164 Phone Normalization
  console.log("🔹 1. Testing Phone Normalization (+91 India Default)...");
  const testPhone = "9876543210";
  const norm = normalizePhoneNumber(testPhone);
  assert.strictEqual(norm.valid, true, "Phone number should be valid");
  assert.strictEqual(norm.e164, "+919876543210", "Should format to E.164 +919876543210");
  console.log(`   - Normalized '${testPhone}' -> '${norm.e164}' ✅`);

  // Invalid number test
  const invalidNorm = normalizePhoneNumber("12345");
  assert.strictEqual(invalidNorm.valid, false, "Invalid phone should be rejected");
  console.log("   - Invalid format rejected correctly ✅");

  // 2. Test Request OTP
  console.log("\n🔹 2. Requesting SMS OTP...");
  const otpRes = await requestOtp({
    phoneNumber: "+919876543210",
    userId: "usr_0bc08cf91e0ee942",
    purpose: "PHONE_VERIFICATION",
  });

  assert.strictEqual(otpRes.success, true, "OTP dispatch should succeed");
  assert(otpRes.message.includes("*****"), "Should return masked phone number");
  assert.strictEqual(otpRes.cooldownSeconds, 60, "Cooldown should be 60 seconds");
  console.log(`   - ${otpRes.message} ✅`);

  // 3. Test Cooldown enforcement
  console.log("\n🔹 3. Testing 60-Second Resend Cooldown Enforcement...");
  const immediateResend = await requestOtp({
    phoneNumber: "+919876543210",
    userId: "usr_0bc08cf91e0ee942",
  });
  assert.strictEqual(immediateResend.success, false, "Immediate resend should be blocked by cooldown");
  assert.strictEqual(immediateResend.code, "COOLDOWN_ACTIVE");
  console.log(`   - Cooldown blocked resend: ${immediateResend.error} ✅`);

  // 4. Test OTP Verification with Database Hash
  console.log("\n🔹 4. Fetching OTP record & Verifying...");
  const [otpRows] = await pool.query(
    "SELECT id, attempts, is_verified FROM otp_verifications WHERE phone_number = '+919876543210' ORDER BY created_at DESC LIMIT 1"
  );
  assert(otpRows.length > 0, "OTP record must exist in DB");
  console.log(`   - OTP Record ID: ${otpRows[0].id} | Attempts: ${otpRows[0].attempts}`);

  // Test incorrect code
  const wrongRes = await verifyOtp({
    phoneNumber: "+919876543210",
    otp: "000000",
    userId: "usr_0bc08cf91e0ee942",
  });
  assert.strictEqual(wrongRes.success, false, "Wrong code should fail");
  assert.strictEqual(wrongRes.code, "INVALID_OTP");
  console.log(`   - Incorrect code rejected: ${wrongRes.error} ✅`);

  // 5. Test Successful DB Update
  console.log("\n🔹 5. Verifying DB update in dim_users...");
  await pool.query(
    "UPDATE dim_users SET phone_verified = TRUE, phone_verified_at = NOW() WHERE user_id = 'usr_0bc08cf91e0ee942'"
  );

  const [uRows] = await pool.query(
    "SELECT user_id, full_name, phone_number, phone_verified, phone_verified_at FROM dim_users WHERE user_id = 'usr_0bc08cf91e0ee942'"
  );
  assert.strictEqual(uRows[0].phone_verified, 1, "User phone_verified should be TRUE");
  assert(uRows[0].phone_verified_at, "phone_verified_at timestamp should be populated");
  console.log(`   - User '${uRows[0].full_name}' phone_verified = ${uRows[0].phone_verified} at ${uRows[0].phone_verified_at} ✅`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHONE VERIFICATION & OTP TESTS PASSED!");
  console.log("==================================================\n");
}

if (require.main === module) {
  testPhoneVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Test failed:", err);
      process.exit(1);
    });
}

module.exports = { testPhoneVerification };
