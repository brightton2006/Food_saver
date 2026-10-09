const crypto = require("crypto");
const { pool } = require("../config/database");
const { sendOtpEmail } = require("./emailService");

/**
 * Generates a cryptographically secure 6-digit numeric OTP string
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Computes SHA-256 hash of an OTP string
 */
function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
}

/**
 * Masks an email address for privacy in API responses (e.g., "j***n@example.com")
 */
function maskEmail(email) {
  if (!email || !email.includes("@")) return "*****@*****";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Requests or resends a 6-digit Email OTP with 60-second cooldown enforcement.
 */
async function requestEmailOtp({ email, name = "", userId = null, purpose = "EMAIL_VERIFICATION" }) {
  if (!email || !email.includes("@")) {
    return {
      success: false,
      code: "INVALID_EMAIL",
      error: "Please provide a valid email address.",
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Check existing active OTP for 60-second resend cooldown
  try {
    const [existingRows] = await pool.query(
      `SELECT id, last_sent_at, expires_at, attempts
       FROM email_otp_verifications
       WHERE LOWER(email) = ? AND purpose = ?
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, purpose]
    );

    if (existingRows.length > 0) {
      const lastSent = new Date(existingRows[0].last_sent_at).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastSent) / 1000);
      const COOLDOWN_PERIOD = 60; // 60 seconds cooldown

      if (elapsedSeconds < COOLDOWN_PERIOD) {
        const remaining = COOLDOWN_PERIOD - elapsedSeconds;
        return {
          success: false,
          code: "COOLDOWN_ACTIVE",
          error: `Please wait ${remaining} seconds before requesting a new verification code.`,
          cooldownSeconds: remaining,
          message: `Please wait ${remaining} seconds before requesting a new code.`,
        };
      }
    }

    // 2. Generate secure 6-digit OTP & Hash
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const id = `em_otp_${crypto.randomBytes(8).toString("hex")}`;
    const EXPIRY_MINUTES = 5;
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    // 3. Save hashed OTP to MySQL database
    await pool.query(
      `INSERT INTO email_otp_verifications 
         (id, email, user_id, otp_hash, purpose, attempts, max_attempts, is_verified, expires_at, last_sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 5, FALSE, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         otp_hash = VALUES(otp_hash),
         user_id = VALUES(user_id),
         attempts = 0,
         is_verified = FALSE,
         expires_at = VALUES(expires_at),
         last_sent_at = NOW()`,
      [id, cleanEmail, userId, otpHash, purpose, expiresAt]
    );

    // 4. Deliver OTP email via Nodemailer SMTP
    const mailResult = await sendOtpEmail({
      to: cleanEmail,
      name: name || cleanEmail.split("@")[0],
      otp,
      expiryMinutes: EXPIRY_MINUTES,
    });

    if (!mailResult.success && mailResult.reason === "invalid_email") {
      return {
        success: false,
        code: "EMAIL_DELIVERY_FAILED",
        error: "Failed to deliver verification email to the specified address.",
      };
    }

    return {
      success: true,
      code: "OTP_SENT",
      message: `A 6-digit verification code has been sent to ${maskEmail(cleanEmail)}.`,
      maskedEmail: maskEmail(cleanEmail),
      email: cleanEmail,
      cooldownSeconds: 60,
      expiryMinutes: EXPIRY_MINUTES,
      // Only include debug OTP in automated test runs
      ...(process.env.NODE_ENV === "test" ? { _debugOtp: otp } : {}),
    };
  } catch (err) {
    console.error("[EmailOtpService] Error requesting OTP:", err.message);
    return {
      success: false,
      code: "SERVER_ERROR",
      error: "Unable to send verification code. Please try again.",
    };
  }
}

/**
 * Verifies a submitted 6-digit Email OTP against the stored hash.
 * Enforces: 5-minute expiry, max 5 attempts, single-use atomic invalidation, and updates dim_users.
 */
async function verifyEmailOtp({ email, otp, userId = null, purpose = "EMAIL_VERIFICATION" }) {
  if (!email || !otp) {
    return {
      success: false,
      code: "MISSING_INPUT",
      error: "Email address and 6-digit OTP code are required.",
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return {
      success: false,
      code: "INVALID_FORMAT",
      error: "Verification code must be a 6-digit number.",
    };
  }

  try {
    // 1. Fetch latest verification record
    const [rows] = await pool.query(
      `SELECT * FROM email_otp_verifications 
       WHERE LOWER(email) = ? AND purpose = ?
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, purpose]
    );

    if (rows.length === 0) {
      return {
        success: false,
        code: "OTP_NOT_FOUND",
        error: "No active verification code found. Please request a new code.",
      };
    }

    const record = rows[0];

    // 2. Check if already verified
    if (record.is_verified) {
      return {
        success: false,
        code: "ALREADY_VERIFIED",
        error: "This verification code has already been used.",
      };
    }

    // 3. Check expiration (5 minutes)
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return {
        success: false,
        code: "OTP_EXPIRED",
        error: "Verification code has expired (valid for 5 minutes). Please request a new code.",
      };
    }

    // 4. Check max attempts (5 attempts limit)
    if (record.attempts >= record.max_attempts) {
      return {
        success: false,
        code: "MAX_ATTEMPTS_EXCEEDED",
        error: "Maximum verification attempts exceeded. Please request a new verification code.",
      };
    }

    // 5. Compare submitted OTP hash
    const submittedHash = hashOtp(cleanOtp);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, "hex"),
      Buffer.from(record.otp_hash, "hex")
    );

    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      const remainingAttempts = Math.max(0, record.max_attempts - newAttempts);

      // Increment attempt counter atomically in DB
      await pool.query(
        "UPDATE email_otp_verifications SET attempts = attempts + 1 WHERE id = ?",
        [record.id]
      );

      return {
        success: false,
        code: "INVALID_OTP",
        error: remainingAttempts > 0
          ? `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`
          : "Incorrect verification code. Maximum attempts reached. Please request a new code.",
        remainingAttempts,
      };
    }

    // 6. ATOMIC SUCCESS: Mark OTP record as verified & invalidate single-use
    await pool.query(
      "UPDATE email_otp_verifications SET is_verified = TRUE, attempts = attempts + 1 WHERE id = ?",
      [record.id]
    );

    // 7. Update dim_users table: set email_verified = TRUE and email_verified_at = NOW()
    const targetUserId = userId || record.user_id;
    if (targetUserId) {
      await pool.query(
        `UPDATE dim_users 
         SET email_verified = TRUE, email_verified_at = NOW(), status = IF(status = 'PENDING', 'APPROVED', status)
         WHERE user_id = ? OR LOWER(email) = ?`,
        [targetUserId, cleanEmail]
      );
    } else {
      await pool.query(
        `UPDATE dim_users 
         SET email_verified = TRUE, email_verified_at = NOW(), status = IF(status = 'PENDING', 'APPROVED', status)
         WHERE LOWER(email) = ?`,
        [cleanEmail]
      );
    }

    // Return clean success response
    return {
      success: true,
      code: "VERIFIED",
      message: "Email address verified successfully!",
      email: cleanEmail,
    };
  } catch (err) {
    console.error("[EmailOtpService] Error verifying OTP:", err.message);
    return {
      success: false,
      code: "SERVER_ERROR",
      error: "Verification failed due to a server error. Please try again.",
    };
  }
}

module.exports = {
  generateOtp,
  hashOtp,
  maskEmail,
  requestEmailOtp,
  verifyEmailOtp,
};
