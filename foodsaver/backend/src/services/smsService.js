const crypto = require("crypto");
const https = require("https");
const http = require("http");
const { pool } = require("../config/database");
const { recordCommunicationEvent } = require("./emailService");

// Environment Configuration
const SMS_PROVIDER = (process.env.SMS_PROVIDER || "mock").toLowerCase();
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || "";
const FAST2SMS_ROUTE = process.env.FAST2SMS_ROUTE || "otp"; // "otp" or "dlt"
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || "";
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || "";
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || "FDSAVR";

const OTP_SECRET_SALT = process.env.OTP_SECRET_SALT || "foodsaver_otp_salt_2026";
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);
const MAX_VERIFICATION_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_HOURLY_REQUESTS = 5;

/**
 * Normalizes and validates Indian phone numbers
 * Returns 10-digit number and full E.164 (+91XXXXXXXXXX)
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { valid: false, error: "Phone number is required." };
  }

  // Strip spaces, dashes, parentheses
  const cleaned = rawPhone.trim().replace(/[\s\-\(\)]/g, "");

  let tenDigits = "";
  if (cleaned.startsWith("+91")) {
    tenDigits = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    tenDigits = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    tenDigits = cleaned.slice(1);
  } else if (cleaned.length === 10) {
    tenDigits = cleaned;
  } else {
    return { valid: false, error: "Invalid mobile number format. Please provide a 10-digit Indian phone number." };
  }

  // Validate 10 digits starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    return { valid: false, error: "Mobile number must be a valid 10-digit Indian mobile starting with 6, 7, 8, or 9." };
  }

  return {
    valid: true,
    tenDigits,
    e164: `+91${tenDigits}`,
  };
}

/**
 * Hashes OTP for secure storage
 */
function hashOtp(otp, phoneNumber) {
  return crypto
    .createHash("sha256")
    .update(`${phoneNumber}:${otp}:${OTP_SECRET_SALT}`)
    .digest("hex");
}

/**
 * Helper HTTP POST for external SMS APIs
 */
function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const payload = JSON.stringify(body);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Sends OTP via Fast2SMS (Indian Gateway)
 */
async function sendViaFast2Sms(tenDigitPhone, otp) {
  if (!FAST2SMS_API_KEY) {
    throw new Error("FAST2SMS_API_KEY is not configured in environment variables.");
  }

  const url = "https://www.fast2sms.com/dev/bulkV2";
  const headers = {
    authorization: FAST2SMS_API_KEY,
  };
  const body = {
    variables_values: otp,
    route: FAST2SMS_ROUTE,
    numbers: tenDigitPhone,
  };

  const response = await postJson(url, headers, body);
  if (response.status !== 200 || response.body?.return !== true) {
    throw new Error(response.body?.message || `Fast2SMS request failed with status ${response.status}`);
  }

  return response.body;
}

/**
 * Sends OTP via Twilio
 */
async function sendViaTwilio(e164Phone, otp) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials (ACCOUNT_SID, AUTH_TOKEN, PHONE_NUMBER) not configured.");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const postData = new URLSearchParams({
    To: e164Phone,
    From: TWILIO_PHONE_NUMBER,
    Body: `Your FoodSaver security verification code is: ${otp}. Valid for 5 minutes. Do not share with anyone.`,
  }).toString();

  const authHeader = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Twilio error: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Sends OTP via MSG91
 */
async function sendViaMsg91(e164Phone, otp) {
  if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
    throw new Error("MSG91 credentials not fully configured.");
  }

  const url = `https://api.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${e164Phone.replace("+", "")}&authkey=${MSG91_AUTH_KEY}&otp=${otp}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`MSG91 status error: ${res.statusCode} ${data}`));
        }
      });
    }).on("error", reject);
  });
}

/**
 * Request & Dispatch a new SMS OTP
 */
async function requestOtp({ phoneNumber, userId = null, purpose = "PHONE_VERIFICATION" }) {
  const norm = normalizePhoneNumber(phoneNumber);
  if (!norm.valid) {
    return { success: false, error: norm.error };
  }

  const cleanPhone = norm.e164;
  const tenDigits = norm.tenDigits;

  // 1. Rate Limiting Check: Max requests in last hour
  const [hourlyRows] = await pool.query(
    `SELECT COUNT(*) as count FROM otp_verifications
     WHERE phone_number = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [cleanPhone]
  );
  if (hourlyRows[0]?.count >= MAX_HOURLY_REQUESTS) {
    return {
      success: false,
      error: "Too many OTP requests for this phone number. Please try again in an hour.",
      code: "RATE_LIMIT_EXCEEDED",
    };
  }

  // 2. Cooldown Check: Last OTP must be older than 60 seconds
  const [recentRows] = await pool.query(
    `SELECT created_at FROM otp_verifications
     WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`,
    [cleanPhone]
  );
  if (recentRows.length > 0) {
    const elapsedSeconds = (Date.now() - new Date(recentRows[0].created_at).getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitRemaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      return {
        success: false,
        error: `Please wait ${waitRemaining} seconds before requesting a new OTP.`,
        cooldownSeconds: waitRemaining,
        code: "COOLDOWN_ACTIVE",
      };
    }
  }

  // 3. Cryptographically Secure OTP Generation (6-digit integer)
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = hashOtp(otpCode, cleanPhone);
  const otpId = `otp_${crypto.randomBytes(8).toString("hex")}`;
  const expiryDate = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any previous unverified OTPs for this phone number
  await pool.query(
    `UPDATE otp_verifications SET is_verified = TRUE WHERE phone_number = ? AND is_verified = FALSE`,
    [cleanPhone]
  );

  // 4. Store Hash in Database
  await pool.query(
    `INSERT INTO otp_verifications (id, phone_number, user_id, otp_hash, purpose, attempts, max_attempts, is_verified, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, FALSE, ?, NOW())`,
    [otpId, cleanPhone, userId, hashedOtp, purpose, MAX_VERIFICATION_ATTEMPTS, expiryDate]
  );

  // 5. Dispatch SMS via Configured Provider
  let providerUsed = "mock";
  let deliveryError = null;

  try {
    if (FAST2SMS_API_KEY && (SMS_PROVIDER === "fast2sms" || SMS_PROVIDER === "auto")) {
      await sendViaFast2Sms(tenDigits, otpCode);
      providerUsed = "fast2sms";
    } else if (TWILIO_ACCOUNT_SID && (SMS_PROVIDER === "twilio" || SMS_PROVIDER === "auto")) {
      await sendViaTwilio(cleanPhone, otpCode);
      providerUsed = "twilio";
    } else if (MSG91_AUTH_KEY && (SMS_PROVIDER === "msg91" || SMS_PROVIDER === "auto")) {
      await sendViaMsg91(cleanPhone, otpCode);
      providerUsed = "msg91";
    } else {
      // Secure local mock provider — Never expose real OTP in API response
      console.log(`📱 [SMS Service - Mock] Sent SMS OTP to ${cleanPhone}: [HASH STORED SECURELY]`);
      providerUsed = "mock";
    }
  } catch (err) {
    deliveryError = err.message;
    console.error(`❌ [SMS Service] Provider delivery failed:`, err.message);
  }

  // Record delivery event
  await recordCommunicationEvent({
    eventId: `sms_otp_${otpId}`,
    eventType: "SMS_OTP",
    referenceId: otpId,
    recipient: cleanPhone,
    channel: "SMS",
    status: deliveryError ? "FAILED" : "SENT",
    lastError: deliveryError,
    payload: { provider: providerUsed, purpose },
  });

  const response = {
    success: true,
    message: `OTP sent successfully to ${cleanPhone.slice(0, 5)}*****${cleanPhone.slice(-2)}`,
    phoneNumber: cleanPhone,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };

  if (process.env.NODE_ENV === "test") {
    response._debugOtp = otpCode;
  }

  return response;
}

/**
 * Verify OTP Code
 */
async function verifyOtp({ phoneNumber, otp, userId = null }) {
  const norm = normalizePhoneNumber(phoneNumber);
  if (!norm.valid) {
    return { success: false, error: norm.error };
  }

  const cleanPhone = norm.e164;
  const trimmedOtp = (otp || "").trim();

  if (!trimmedOtp || trimmedOtp.length !== 6 || !/^\d{6}$/.test(trimmedOtp)) {
    return { success: false, error: "Please enter a valid 6-digit verification code." };
  }

  // 1. Fetch active OTP record
  const [rows] = await pool.query(
    `SELECT * FROM otp_verifications
     WHERE phone_number = ? AND is_verified = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [cleanPhone]
  );

  if (rows.length === 0) {
    return {
      success: false,
      error: "No active verification code found. Please request a new OTP.",
      code: "NO_ACTIVE_OTP",
    };
  }

  const record = rows[0];

  // 2. Check Expiry
  if (new Date() > new Date(record.expires_at)) {
    await pool.query("UPDATE otp_verifications SET is_verified = TRUE WHERE id = ?", [record.id]);
    return {
      success: false,
      error: "This OTP has expired. Please request a new code.",
      code: "OTP_EXPIRED",
    };
  }

  // 3. Check Attempt Limit
  if (record.attempts >= record.max_attempts) {
    await pool.query("UPDATE otp_verifications SET is_verified = TRUE WHERE id = ?", [record.id]);
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
      code: "MAX_ATTEMPTS_EXCEEDED",
    };
  }

  // 4. Verify Hash
  const candidateHash = hashOtp(trimmedOtp, cleanPhone);
  if (candidateHash !== record.otp_hash) {
    // Increment failed attempts
    await pool.query(
      `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
      [record.id]
    );
    const attemptsLeft = record.max_attempts - (record.attempts + 1);
    return {
      success: false,
      error: attemptsLeft > 0
        ? `Incorrect code. ${attemptsLeft} attempt(s) remaining.`
        : "Incorrect code. Maximum attempts reached.",
      code: "INVALID_OTP",
      attemptsRemaining: Math.max(0, attemptsLeft),
    };
  }

  // 5. Successful Verification — Mark OTP as used
  await pool.query(
    `UPDATE otp_verifications SET is_verified = TRUE WHERE id = ?`,
    [record.id]
  );

  // 6. Update user's verified status in dim_users if userId or matching phone exists
  if (userId) {
    await pool.query(
      `UPDATE dim_users
       SET phone_number = ?, phone_verified = TRUE, phone_verified_at = NOW()
       WHERE user_id = ? OR email = ?`,
      [cleanPhone, userId, userId]
    );
  } else {
    await pool.query(
      `UPDATE dim_users
       SET phone_verified = TRUE, phone_verified_at = NOW()
       WHERE phone_number = ?`,
      [cleanPhone]
    );
  }

  return {
    success: true,
    verified: true,
    message: "Phone number verified successfully!",
    phoneNumber: cleanPhone,
  };
}

module.exports = {
  normalizePhoneNumber,
  requestOtp,
  verifyOtp,
};
