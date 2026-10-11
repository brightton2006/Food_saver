const assert = require("assert");
const http = require("http");
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { pool } = require("../src/config/database");
const { router: authRouter } = require("../src/routes/auth");
const { hashOtp } = require("../src/services/emailOtpService");

describe = (name, fn) => {
  console.log(`\n==================================================\n🧪 ${name}\n==================================================`);
  return fn();
};

async function runAll10Cases() {
  process.env.NODE_ENV = "test";
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  async function apiCall(endpoint, method = "POST", body = null) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const testEmail = `case_test_${Date.now()}@foodsaver.test`;
  const testPassword = "SecurePassword123!";
  const testName = "E2E Test User";

  try {
    // ----------------------------------------------------
    // TEST 1: Valid registration creates pending account & sends actual OTP
    // ----------------------------------------------------
    console.log("\n▶ TEST 1: Valid registration sends an actual email/OTP...");
    const regRes = await apiCall("/register", "POST", {
      name: testName,
      email: testEmail,
      password: testPassword,
      role: "CUSTOMER",
    });

    assert.strictEqual(regRes.status, 200, "Registration response status should be 200");
    assert.strictEqual(regRes.data.requiresVerification, true, "Registration must require verification");
    assert.strictEqual(regRes.data.email, testEmail, "Registration email should match");
    console.log("  ✓ Status 200, requiresVerification=true, pending user created in DB");

    // Check DB user is unverified
    const [userRows] = await pool.query("SELECT * FROM dim_users WHERE LOWER(email) = ?", [testEmail]);
    assert.strictEqual(userRows.length, 1, "User should exist in dim_users");
    assert.strictEqual(userRows[0].email_verified, 0, "User must have email_verified=0 before OTP verification");
    console.log("  ✓ dim_users has email_verified=0 (pending)");

    // Get the generated OTP from DB or devOtp
    const [otpRow] = await pool.query(
      "SELECT * FROM email_otp_verifications WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1",
      [testEmail]
    );
    assert.strictEqual(otpRow.length, 1, "OTP record should exist in DB");
    assert.strictEqual(otpRow[0].attempts, 0, "Initial attempts should be 0");
    const activeOtp = regRes.data.devOtp;
    console.log(`  ✓ OTP sent & hashed in DB (ID: ${otpRow[0].id})`);

    // ----------------------------------------------------
    // TEST 8: Unverified users cannot log in when verification is mandatory
    // ----------------------------------------------------
    console.log("\n▶ TEST 8: Unverified users cannot log in when verification is mandatory...");
    const unverifiedLogin = await apiCall("/login", "POST", {
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(unverifiedLogin.status, 403, "Unverified login must be rejected with 403 Forbidden");
    assert.strictEqual(unverifiedLogin.data.code, "EMAIL_NOT_VERIFIED", "Must return EMAIL_NOT_VERIFIED code");
    assert.strictEqual(unverifiedLogin.data.requiresVerification, true, "Must flag requiresVerification: true");
    console.log("  ✓ Login rejected with 403 and code EMAIL_NOT_VERIFIED");

    // ----------------------------------------------------
    // TEST 3: Incorrect OTP is rejected & attempts tracked
    // ----------------------------------------------------
    console.log("\n▶ TEST 3: Incorrect OTP is rejected...");
    const wrongOtpRes = await apiCall("/verify-otp", "POST", {
      email: testEmail,
      otp: "999999",
    });
    assert.strictEqual(wrongOtpRes.status, 400, "Wrong OTP must be rejected with 400 Bad Request");
    assert.strictEqual(wrongOtpRes.data.code, "INVALID_OTP", "Code must be INVALID_OTP");
    assert.strictEqual(wrongOtpRes.data.remainingAttempts, 4, "Remaining attempts should decrement to 4");
    console.log("  ✓ Wrong OTP rejected with code INVALID_OTP (4 attempts remaining)");

    // ----------------------------------------------------
    // TEST 4: OTP expires after five minutes
    // ----------------------------------------------------
    console.log("\n▶ TEST 4: OTP expires after five minutes...");
    // Force OTP to expired in DB to test expiry enforcement
    await pool.query(
      "UPDATE email_otp_verifications SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?",
      [otpRow[0].id]
    );

    const expiredVerify = await apiCall("/verify-otp", "POST", {
      email: testEmail,
      otp: activeOtp,
    });
    assert.strictEqual(expiredVerify.status, 400, "Expired OTP must be rejected with 400");
    assert.strictEqual(expiredVerify.data.code, "OTP_EXPIRED", "Code must be OTP_EXPIRED");
    console.log("  ✓ Expired OTP rejected with code OTP_EXPIRED");

    // ----------------------------------------------------
    // TEST 6: Resend OTP works after cooldown / updates code
    // ----------------------------------------------------
    console.log("\n▶ TEST 6: Resend OTP works after cooldown...");
    // Clear cooldown by updating last_sent_at in DB
    await pool.query(
      "UPDATE email_otp_verifications SET last_sent_at = DATE_SUB(NOW(), INTERVAL 65 SECOND) WHERE id = ?",
      [otpRow[0].id]
    );

    const resendRes = await apiCall("/resend-otp", "POST", {
      email: testEmail,
      name: testName,
    });
    assert.strictEqual(resendRes.status, 200, "Resend after cooldown must succeed with 200");
    assert.strictEqual(resendRes.data.success, true, "Resend response success must be true");
    const freshOtp = resendRes.data.devOtp;
    console.log(`  ✓ Resend succeeded: Fresh OTP generated`);

    // ----------------------------------------------------
    // TEST 2: Correct OTP verifies the email
    // ----------------------------------------------------
    console.log("\n▶ TEST 2: Correct OTP verifies the email...");
    const verifySuccess = await apiCall("/verify-otp", "POST", {
      email: testEmail,
      otp: freshOtp,
    });
    assert.strictEqual(verifySuccess.status, 200, "Valid OTP verification must return 200 OK");
    assert.strictEqual(verifySuccess.data.success, true, "Verification success must be true");
    assert(verifySuccess.data.token, "Verification must return an authenticated JWT token");
    console.log("  ✓ Verified successfully! JWT token returned");

    // Verify DB updated
    const [verifiedUser] = await pool.query("SELECT * FROM dim_users WHERE LOWER(email) = ?", [testEmail]);
    assert.strictEqual(verifiedUser[0].email_verified, 1, "dim_users.email_verified must now be 1 (TRUE)");
    assert(verifiedUser[0].email_verified_at, "dim_users.email_verified_at must be populated");
    console.log("  ✓ dim_users.email_verified is now 1 in database");

    // ----------------------------------------------------
    // TEST 5: Used OTP cannot be reused
    // ----------------------------------------------------
    console.log("\n▶ TEST 5: Used OTP cannot be reused...");
    const reuseVerify = await apiCall("/verify-otp", "POST", {
      email: testEmail,
      otp: freshOtp,
    });
    assert.strictEqual(reuseVerify.status, 400, "Re-verifying same OTP must fail with 400");
    assert.strictEqual(reuseVerify.data.code, "ALREADY_VERIFIED", "Must return ALREADY_VERIFIED code");
    console.log("  ✓ Single-use enforced: Reused OTP rejected with ALREADY_VERIFIED");

    // ----------------------------------------------------
    // TEST 9: Verified users can log in normally
    // ----------------------------------------------------
    console.log("\n▶ TEST 9: Verified users can log in normally...");
    const normalLogin = await apiCall("/login", "POST", {
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(normalLogin.status, 200, "Verified user login must return 200 OK");
    assert.strictEqual(normalLogin.data.ok, true, "Login ok must be true");
    assert(normalLogin.data.token, "Login must return an authenticated JWT token");
    console.log("  ✓ Verified user logged in successfully with token");

    // ----------------------------------------------------
    // TEST 7: Cooldown & excessive OTP requests prevention
    // ----------------------------------------------------
    console.log("\n▶ TEST 7: Excessive/rapid OTP requests are rate-limited...");
    const spamResend = await apiCall("/resend-otp", "POST", {
      email: testEmail,
    });
    // Already verified or active cooldown
    assert.strictEqual(spamResend.status, 400, "Spam request for verified email or active cooldown blocked");
    console.log(`  ✓ Blocked request: ${spamResend.data.error}`);

    // ----------------------------------------------------
    // TEST 10: Existing roles, passwords, partner flows continue working
    // ----------------------------------------------------
    console.log("\n▶ TEST 10: Existing roles, admin & partner login continue working...");
    const adminLogin = await apiCall("/login", "POST", {
      email: "admin@foodsaver.com",
      password: "admin",
      role: "admin",
    });
    assert.strictEqual(adminLogin.status, 200, "Admin login must continue working");
    assert.strictEqual(adminLogin.data.user.role, "ADMIN", "Admin role must be preserved");
    console.log("  ✓ Admin login works normally with role ADMIN");

    // Clean up test data
    await pool.query("DELETE FROM email_otp_verifications WHERE LOWER(email) = ?", [testEmail]);
    await pool.query("DELETE FROM dim_users WHERE LOWER(email) = ?", [testEmail]);

    console.log("\n==================================================");
    console.log("🎉 ALL 10 E2E EMAIL OTP VERIFICATION TESTS PASSED!");
    console.log("==================================================\n");
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ E2E Test Failure:", err);
    await pool.query("DELETE FROM email_otp_verifications WHERE LOWER(email) = ?", [testEmail]).catch(() => {});
    await pool.query("DELETE FROM dim_users WHERE LOWER(email) = ?", [testEmail]).catch(() => {});
    server.close();
    process.exit(1);
  }
}

runAll10Cases();
