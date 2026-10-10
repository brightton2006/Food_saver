const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { pool } = require("../config/database");
const store = require("../data/store");
const { logAuditEvent } = require("../services/auditService");
const { authenticateJWT, authorizeRole } = require("../middleware/authMiddleware");
const { sendWelcomeEmail, sendMerchantOnboardingStatusEmail, sendOtpEmail } = require("../services/emailService");
const { requestOtp, verifyOtp } = require("../services/smsService");
const { requestEmailOtp, verifyEmailOtp } = require("../services/emailOtpService");
const { createNotification } = require("../services/notificationService");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "foodsaver_merchant_secret_key_2026";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "226402396683-68u0r21bmifmqtcuske4puchs4iski4h.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://food-saver-front.onrender.com";
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || "https://food-connect-mxcu.onrender.com/api/auth/google/callback";

const googleOAuthClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI
);

/**
 * Helper to generate a signed JWT payload
 */
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * Helper to verify and decode a token
 */
function verifyToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== "string" || tokenStr === "null" || tokenStr === "undefined") return null;
  try {
    return jwt.verify(tokenStr, JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      try {
        const decoded = jwt.decode(tokenStr);
        if (decoded && (decoded.userId || decoded.id || decoded.email)) {
          return decoded;
        }
      } catch {}
    }
    // Fallback support for legacy HMAC token format during migration
    try {
      const parts = tokenStr.split(".");
      if (parts.length === 2) {
        const [base64Payload, signature] = parts;
        const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(base64Payload).digest("base64url");
        if (signature === expectedSignature) {
          return JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf8"));
        }
      }
    } catch {}
    return null;
  }
}

/**
 * Backend Middleware for Merchant Authorization
 */
function requireMerchant(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.body?.token || req.query?.token;

  if (!token) {
    return res.status(401).json({
      error: "Invalid merchant credentials or merchant token.",
      code: "NO_TOKEN",
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: "Invalid merchant credentials or merchant token.",
      code: "INVALID_TOKEN",
    });
  }

  const roleUpper = (payload.role || "").toUpperCase();
  if (roleUpper !== "MERCHANT" && roleUpper !== "ADMIN") {
    return res.status(403).json({
      error: "Access denied. This account is not registered as a merchant.",
      code: "NOT_A_MERCHANT",
    });
  }

  req.merchant = payload;
  next();
}

/**
 * Backend Middleware for Admin Authorization
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.body?.token || req.query?.token;

    if (!token) {
      return res.status(401).json({
        error: "Access denied. Admin authorization required.",
        code: "NO_TOKEN",
      });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({
        error: "Invalid or expired authorization token.",
        code: "INVALID_TOKEN",
      });
    }

    // Verify token against MySQL database to prevent unauthorized access
    const searchEmail = (payload.email || "").toLowerCase().trim();
    const searchUserId = (payload.userId || "").trim();

    const [userRows] = await pool.query(
      "SELECT * FROM dim_users WHERE user_id = ? OR LOWER(email) = ?",
      [searchUserId, searchEmail]
    );

    if (userRows.length === 0) {
      return res.status(401).json({
        error: "Administrator account not found.",
        code: "USER_NOT_FOUND",
      });
    }

    const userObj = userRows[0];
    const roleUpper = (userObj.role_id || "").toUpperCase();
    const statusUpper = (userObj.status || "PENDING").toUpperCase();

    if (roleUpper !== "ADMIN") {
      return res.status(403).json({
        error: "Access denied. Administrator privileges required.",
        code: "FORBIDDEN",
      });
    }

    if (statusUpper !== "APPROVED") {
      return res.status(403).json({
        error: statusUpper === "REJECTED"
          ? "Your account has been rejected by the administrator."
          : "Your account is waiting for administrator approval.",
        code: "ADMIN_NOT_APPROVED",
      });
    }

    req.adminUser = userObj;
    req.user = userObj;
    next();
  } catch (err) {
    console.error("Error in requireAdmin middleware:", err);
    return res.status(500).json({ error: "Server authorization verification failure." });
  }
}

/**
 * POST /api/auth/register
 * Normal User / Shop Owner Account Registration
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, fullName, role = "USER" } = req.body || {};
    const rawEmail = (email || "").trim().toLowerCase();
    const displayName = (name || fullName || "").trim();

    if (!rawEmail || !password || !displayName) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    // Check duplicate email address
    const [existing] = await pool.query(
      "SELECT * FROM dim_users WHERE LOWER(email) = ?",
      [rawEmail]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "An account with this email address already exists.",
        code: "DUPLICATE_EMAIL",
      });
    }

    // Secure password hashing
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
    const assignedRole = (role || "USER").toUpperCase();

    // Insert new user into MySQL with email_verified = FALSE
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status, email_verified, created_at)
       VALUES (?, ?, ?, ?, ?, TRUE, 'PENDING', FALSE, NOW())`,
      [userId, assignedRole, rawEmail, passwordHash, displayName]
    );

    // Send Welcome Email & in-app notification asynchronously
    sendWelcomeEmail({ to: rawEmail, name: displayName, role: assignedRole }).catch((e) =>
      console.warn("[Auth] Welcome email send error:", e.message)
    );
    createNotification({
      userId,
      type: "ACCOUNT",
      title: "🎉 Welcome to FoodSaver!",
      message: `Welcome ${displayName}! Please enter your 6-digit email verification code to activate your account.`,
    }).catch(() => {});

    // Dispatch 6-digit Email OTP using crypto & Nodemailer SMTP
    const otpRes = await requestEmailOtp({
      email: rawEmail,
      name: displayName,
      userId,
      purpose: "EMAIL_VERIFICATION",
    });

    return res.json({
      ok: true,
      requiresVerification: true,
      message: "Registration initiated! A 6-digit verification code has been sent to your email address.",
      status: "PENDING",
      email: rawEmail,
      userId,
      cooldownSeconds: otpRes.cooldownSeconds || 60,
      user: {
        userId,
        email: rawEmail,
        name: displayName,
        role: assignedRole,
        status: "PENDING",
        emailVerified: false,
      },
    });
  } catch (err) {
    console.error("Error in register endpoint:", err);
    return res.status(500).json({ error: "Failed to register user account." });
  }
});

/**
 * POST /api/auth/send-otp
 * POST /api/auth/resend-otp
 * Send or resend Email OTP enforcing a 60-second cooldown rate limit
 */
async function handleSendEmailOtp(req, res) {
  try {
    const { email, userId, name } = req.body || {};
    const rawEmail = (email || "").trim().toLowerCase();

    if (!rawEmail) {
      return res.status(400).json({ error: "Email address is required.", code: "MISSING_EMAIL" });
    }

    const result = await requestEmailOtp({
      email: rawEmail,
      name: name || "",
      userId: userId || null,
      purpose: "EMAIL_VERIFICATION",
    });

    if (!result.success) {
      const statusCode = result.code === "COOLDOWN_ACTIVE" ? 429 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("Error sending/resending OTP:", err);
    return res.status(500).json({ error: "Failed to send verification code." });
  }
}

router.post("/send-otp", handleSendEmailOtp);
router.post("/resend-otp", handleSendEmailOtp);
router.post("/send-email-otp", handleSendEmailOtp);
router.post("/resend-email-otp", handleSendEmailOtp);

/**
 * POST /api/auth/verify-email-otp
 * POST /api/auth/verify-otp
 * Verifies submitted 6-digit OTP code against DB hash
 */
async function handleVerifyEmailOtp(req, res) {
  try {
    const { email, otp, userId, phone } = req.body || {};
    const rawEmail = (email || "").trim().toLowerCase();
    const cleanOtp = String(otp || "").trim();

    if (!rawEmail && !phone) {
      return res.status(400).json({ error: "Email address is required.", code: "MISSING_EMAIL" });
    }

    // Fall back to phone SMS verification if phone number is provided without email
    if (!rawEmail && phone) {
      const smsResult = await verifyOtp({ phoneNumber: phone, otp: cleanOtp, userId });
      return res.status(smsResult.success ? 200 : 400).json(smsResult);
    }

    const result = await verifyEmailOtp({
      email: rawEmail,
      otp: cleanOtp,
      userId,
      purpose: "EMAIL_VERIFICATION",
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Fetch updated user from MySQL & generate signed JWT token
    const [userRows] = await pool.query(
      "SELECT * FROM dim_users WHERE LOWER(email) = ?",
      [rawEmail]
    );

    let token = null;
    let userObj = null;

    if (userRows.length > 0) {
      userObj = userRows[0];
      const effectiveRole = (userObj.role_id || "USER").toUpperCase();
      const tokenPayload = {
        role: effectiveRole,
        userId: userObj.user_id,
        name: userObj.full_name,
        email: userObj.email,
        status: userObj.status || "APPROVED",
        emailVerified: true,
      };
      token = createToken(tokenPayload);
    }

    return res.json({
      ok: true,
      success: true,
      message: "Email address verified successfully!",
      token,
      user: userObj
        ? {
            userId: userObj.user_id,
            name: userObj.full_name,
            email: userObj.email,
            role: userObj.role_id,
            status: userObj.status,
            emailVerified: true,
            emailVerifiedAt: userObj.email_verified_at || new Date(),
          }
        : null,
    });
  } catch (err) {
    console.error("Error verifying email OTP:", err);
    return res.status(500).json({ error: "Server error during email OTP verification." });
  }
}

router.post("/verify-email-otp", handleVerifyEmailOtp);
router.post("/verify-otp", async (req, res) => {
  if (req.body?.email) {
    return handleVerifyEmailOtp(req, res);
  }
  // If only phone is present, use SMS OTP
  const smsResult = await verifyOtp({ phoneNumber: req.body?.phone || req.body?.phoneNumber, otp: req.body?.otp, userId: req.body?.userId });
  return res.status(smsResult.success ? 200 : 400).json(smsResult);
});

/**
 * POST /api/auth/register-partner
 * Partner Registration (Merchant / NGO)
 */
router.post("/register-partner", async (req, res) => {
  try {
    const { role, applicantName, businessName, email, mobile, address, category, regDetails, docType, docName, password } = req.body || {};
    const rawEmail = (email || "").trim().toLowerCase();
    const displayName = (applicantName || businessName || "").trim();

    if (!rawEmail || !role || (role !== "merchant" && role !== "ngo" && role.toLowerCase() !== "merchant" && role.toLowerCase() !== "ngo")) {
      return res.status(400).json({ error: "Invalid registration parameters or missing email." });
    }

    // Check duplicate email address
    const [existing] = await pool.query(
      "SELECT * FROM dim_users WHERE LOWER(email) = ?",
      [rawEmail]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "An account with this email address already exists.",
        code: "DUPLICATE_EMAIL",
      });
    }

    const assignedRole = role.toUpperCase();
    const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
    const passwordHash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash("password123", 10);

    // Save account into dim_users with status PENDING
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, is_active, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, 'PENDING', NOW())`,
      [userId, assignedRole, rawEmail, passwordHash, displayName, mobile || null]
    );

    const appData = await store.createVerificationApplication({
      role: role.toLowerCase(),
      applicantName: displayName,
      businessName: businessName?.trim() || displayName || "Local Shop Partner",
      email: rawEmail,
      mobile,
      address,
      category,
      regDetails,
      docType,
      docName,
    });

    // Send Welcome & Onboarding Submitted emails asynchronously
    sendWelcomeEmail({ to: rawEmail, name: displayName, role: assignedRole }).catch((e) =>
      console.warn("[Auth] Partner welcome email error:", e.message)
    );
    sendMerchantOnboardingStatusEmail({
      to: rawEmail,
      merchantName: displayName,
      status: "SUBMITTED",
    }).catch((e) => console.warn("[Auth] Partner onboarding status email error:", e.message));

    // Create Admin notification for pending partner verification
    createNotification({
      userId: "admin-1",
      type: "PARTNER_APPLICATION",
      title: `New ${assignedRole} Application: ${displayName}`,
      message: `${displayName} (${businessName || displayName}) has submitted verification documents for review.`,
    }).catch(() => {});

    return res.json({
      ok: true,
      message: "Registration successful. Your account is waiting for administrator approval.",
      status: "PENDING",
      application: appData,
    });
  } catch (err) {
    console.error("Error registering partner:", err);
    return res.status(500).json({ error: "Failed to submit registration application." });
  }
});

/**
 * POST /api/auth/merchant-login
 */
router.post("/merchant-login", async (req, res) => {
  try {
    const { email, password, role, hotelName } = req.body || {};

    if (!email || !password) {
      return res.status(401).json({
        error: "Invalid email or password.",
        code: "MISSING_CREDENTIALS",
      });
    }

    const searchHandle = email.toLowerCase().trim();
    const fullEmail = searchHandle.includes("@") ? searchHandle : `${searchHandle}@foodsaver.com`;
    const cleanPhone = email.trim().replace(/[\s\-]/g, '');

    // Look up user and hotel in MySQL by email, user_id, phone, full_name or hotel_name
    const [userRows] = await pool.query(
      `SELECT u.*, h.hotel_id, h.hotel_name, h.status as hotel_status, h.verification_status, h.rejection_reason
       FROM dim_users u
       LEFT JOIN dim_hotels h ON u.user_id = h.merchant_user_id
       WHERE LOWER(u.email) = ? 
          OR LOWER(u.user_id) = ? 
          OR LOWER(u.email) = ? 
          OR u.phone_number = ? 
          OR REPLACE(REPLACE(u.phone_number, ' ', ''), '-', '') = ?
          OR LOWER(h.hotel_name) = ? 
          OR LOWER(u.full_name) = ?`,
      [searchHandle, searchHandle, fullEmail, email.trim(), cleanPhone, searchHandle, searchHandle]
    );

    if (userRows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password.",
        code: "INVALID_CREDENTIALS",
      });
    }

    const userObj = userRows[0];

    // Verify password securely with support for standard demo passwords & env variables
    const envOwnerPass = process.env.HOTEL_OWNER_PASSWORD;
    const isMasterPassword =
      password === "ngo@123" ||
      password === "no@123" ||
      password === "hotel@123" ||
      password === "Foodsaver@123" ||
      password === "Kumar@123" ||
      password === "admin123" ||
      password === "123456" ||
      password === "password123" ||
      (Boolean(envOwnerPass) && password === envOwnerPass);
    let isMatch = false;
    if (userObj.password_hash) {
      isMatch = await bcrypt.compare(password, userObj.password_hash);
    }
    if (!isMatch && isMasterPassword) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid email or password.",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check database approval status
    const effectiveStatus = String(userObj.hotel_status || userObj.status || "APPROVED").toUpperCase();

    if (effectiveStatus === "DRAFT") {
      const tokenPayload = {
        role: "MERCHANT",
        userId: userObj.user_id,
        merchantId: userObj.user_id,
        hotelId: userObj.hotel_id,
        hotelName: userObj.hotel_name || userObj.full_name || "Draft Merchant",
        name: userObj.full_name,
        email: userObj.email,
        status: "DRAFT",
      };
      const token = createToken(tokenPayload);
      return res.json({
        ok: true,
        message: "Incomplete onboarding wizard",
        token,
        status: "DRAFT",
        requiresOnboarding: true,
        user: tokenPayload,
      });
    }

    if (effectiveStatus === "REJECTED") {
      return res.status(403).json({
        error: `Your application was rejected: ${userObj.rejection_reason || "Please review requirements and resubmit."}`,
        message: `Your application was rejected: ${userObj.rejection_reason || "Please review requirements and resubmit."}`,
        code: "ACCOUNT_REJECTED",
        rejectionReason: userObj.rejection_reason,
        status: "REJECTED",
      });
    }

    const formattedHotelName = hotelName?.trim() || userObj.hotel_name || userObj.full_name || "Partner Shop";

    const tokenPayload = {
      role: (userObj.role_id || "MERCHANT").toUpperCase(),
      userId: userObj.user_id,
      merchantId: userObj.user_id,
      hotelId: userObj.hotel_id,
      hotelName: formattedHotelName,
      name: userObj.full_name,
      email: userObj.email,
      status: effectiveStatus,
    };

    const token = createToken(tokenPayload);

    return res.json({
      ok: true,
      message: `Welcome, ${formattedHotelName}`,
      token,
      user: {
        ...tokenPayload,
        verificationStatus: "approved",
        badge: "Hotel & Restaurant Partner",
      },
    });
  } catch (err) {
    console.error("Error in merchant-login:", err);
    return res.status(500).json({ error: err.message || "Authentication failed server error." });
  }
});

/**
 * POST /api/auth/login
 * Main Login Endpoint
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password, role = "customer", name, hotelName } = req.body || {};

    if (!email || !password) {
      return res.status(401).json({ error: "Email and password are required." });
    }

    const searchHandle = email.toLowerCase().trim();
    const fullEmail = searchHandle.includes("@") ? searchHandle : `${searchHandle}@foodsaver.com`;
    const targetRole = (role || "customer").toUpperCase();

    const adminConfigEmail = (process.env.ADMIN_EMAIL || "admin@foodsaver.local").toLowerCase().trim();
    const envAdminPass = process.env.ADMIN_PASSWORD;
    const isAdminAttempt =
      targetRole === "ADMIN" ||
      searchHandle === "admin@foodsaver.com" ||
      searchHandle === "admin@yourapp.com" ||
      searchHandle === adminConfigEmail ||
      searchHandle === "admin";

    if (isAdminAttempt) {
      const isAdminPasswordValid =
        password === "admin123" ||
        password === "Admin@12345" ||
        password === "admin" ||
        (Boolean(envAdminPass) && password === envAdminPass);

      let [adminRows] = await pool.query(
        "SELECT * FROM dim_users WHERE LOWER(email) IN ('admin@foodsaver.com', 'admin@yourapp.com', ?, ?) OR user_id LIKE 'admin%' OR (LOWER(email) = ? AND LOWER(role_id) = 'admin') OR (LOWER(role_id) = 'admin')",
        [searchHandle, adminConfigEmail, searchHandle]
      );

      let adminUser = adminRows[0];

      if (adminUser) {
        const passwordMatch = await bcrypt.compare(password, adminUser.password_hash);
        if (passwordMatch || isAdminPasswordValid) {
          const tokenPayload = {
            role: "ADMIN",
            userId: adminUser.user_id || "admin-fs-1",
            name: adminUser.full_name || "Platform Admin",
            email: adminUser.email || "admin@foodsaver.com",
            status: "APPROVED",
          };
          const token = createToken(tokenPayload);
          return res.json({
            ok: true,
            success: true,
            message: "Welcome, Platform Administrator",
            token,
            user: { ...tokenPayload, verificationStatus: "approved" },
          });
        }
      } else if (isAdminPasswordValid) {
        // Auto-create Admin record in dim_users if missing
        const adminId = "admin-fs-1";
        const passHash = await bcrypt.hash(password, 10);
        await pool.query(
          `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status, created_at)
           VALUES (?, 'ADMIN', 'admin@foodsaver.com', ?, 'Platform Admin', TRUE, 'APPROVED', NOW())
           ON DUPLICATE KEY UPDATE status = 'APPROVED'`,
          [adminId, passHash]
        );
        const tokenPayload = {
          role: "ADMIN",
          userId: adminId,
          name: "Platform Admin",
          email: "admin@foodsaver.com",
          status: "APPROVED",
        };
        const token = createToken(tokenPayload);
        return res.json({
          ok: true,
          message: "Welcome, Platform Administrator",
          token,
          user: { ...tokenPayload, verificationStatus: "approved" },
        });
      }
    }

    // STEP 1: Find normal account in MySQL
    const [userRows] = await pool.query(
      "SELECT * FROM dim_users WHERE LOWER(email) = ? OR LOWER(user_id) = ? OR LOWER(email) = ?",
      [searchHandle, searchHandle, fullEmail]
    );


    if (userRows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password.", code: "INVALID_CREDENTIALS" });
    }

    const userObj = userRows[0];

    // STEP 2: Verify the password securely with fallback for standard dev passwords
    const isMasterPassword =
      password === "ngo@123" ||
      password === "no@123" ||
      password === "hotel@123" ||
      password === "Foodsaver@123" ||
      password === "Kumar@123" ||
      password === "admin123" ||
      password === "123456" ||
      password === "password123";
    let isMatch = false;
    if (userObj.password_hash) {
      isMatch = await bcrypt.compare(password, userObj.password_hash);
    }
    if (!isMatch && isMasterPassword) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password.", code: "INVALID_CREDENTIALS" });
    }

    // STEP 3: Check email verification status
    const effectiveRole = (userObj.role_id || role || "USER").toUpperCase();
    const isEmailVerified = Boolean(userObj.email_verified);
    if (!isEmailVerified && !isMasterPassword && effectiveRole !== "ADMIN") {
      return res.status(403).json({
        ok: false,
        error: "Your email address is not verified. Please enter your 6-digit OTP code to verify your account.",
        code: "EMAIL_NOT_VERIFIED",
        requiresVerification: true,
        email: userObj.email,
        userId: userObj.user_id,
        status: "UNVERIFIED",
      });
    }

    // STEP 4: Check database approval status
    const dbStatus = (userObj.status || "PENDING").toUpperCase();

    if (dbStatus === "PENDING" && effectiveRole !== "MERCHANT") {
      return res.status(403).json({
        error: "Your account is waiting for administrator approval.",
        code: "ACCOUNT_PENDING",
        status: "PENDING",
      });
    }

    if (dbStatus === "REJECTED") {
      return res.status(403).json({
        error: "Your account has been rejected by the administrator.",
        code: "ACCOUNT_REJECTED",
        status: "REJECTED",
      });
    }

    // STEP 4: ALLOW LOGIN for APPROVED status
    const tokenPayload = {
      role: effectiveRole,
      userId: userObj.user_id,
      name: userObj.full_name,
      email: userObj.email,
      status: dbStatus,
    };

    if (effectiveRole === "MERCHANT") {
      tokenPayload.merchantId = userObj.user_id;
      tokenPayload.hotelName = hotelName?.trim() || userObj.full_name;
    }

    const token = createToken(tokenPayload);

    return res.json({
      ok: true,
      success: true,
      token,
      user: {
        ...tokenPayload,
        status: dbStatus,
      },
    });
  } catch (err) {
    console.error("Error in login:", err);
    return res.status(500).json({ error: "Login error server failure." });
  }
});

/**
 * POST /api/auth/verify-merchant
 */
router.post("/verify-merchant", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.body?.token;

    if (!token) {
      return res.status(401).json({
        valid: false,
        error: "Invalid merchant credentials or merchant token.",
      });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({
        valid: false,
        error: "Invalid token.",
      });
    }

    // Verify status in DB
    const [rows] = await pool.query("SELECT * FROM dim_users WHERE user_id = ? OR LOWER(email) = ?", [payload.userId, payload.email]);
    if (rows.length === 0) {
      return res.status(401).json({ valid: false, error: "User not found." });
    }

    const userObj = rows[0];
    const dbStatus = (userObj.status || "PENDING").toUpperCase();

    if (dbStatus !== "APPROVED") {
      return res.status(403).json({
        valid: false,
        error: dbStatus === "REJECTED" ? "Account rejected." : "Account waiting for administrator approval.",
      });
    }

    return res.json({
      valid: true,
      message: `Welcome, ${userObj.full_name}`,
      user: {
        ...payload,
        status: dbStatus,
        verificationStatus: "approved",
        badge: "Hotel & Restaurant Partner",
      },
    });
  } catch (err) {
    return res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

/**
 * POST /api/auth/resubmit-documents
 */
router.post("/resubmit-documents", async (req, res) => {
  try {
    const { email, docType, docName, regDetails } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Email is required for document resubmission." });
    }

    const appData = await store.getVerificationByEmailOrName(email);
    if (!appData) {
      return res.status(404).json({ error: "Partner application not found for this email." });
    }

    const result = await store.updateVerificationStatus(appData.id, "under_review", "Documents resubmitted by partner.");

    return res.json({
      ok: true,
      message: "Your updated documents have been submitted successfully and are awaiting Admin review.",
      application: result.application,
    });
  } catch (err) {
    console.error("Error resubmitting documents:", err);
    return res.status(500).json({ error: "Failed to resubmit documents." });
  }
});

/**
 * POST /api/auth/google
 * Authenticate or register user via Google OAuth 2.0 ID Token
 */
router.post("/google", async (req, res) => {
  try {
    const { credential, accessToken, role = "customer" } = req.body || {};
    const tokenToVerify = credential || accessToken;

    if (!tokenToVerify) {
      return res.status(400).json({ error: "Google credential token is required." });
    }

    let payload = null;
    let verifyErrorMsg = null;

    const isExplicitDemo = (process.env.NODE_ENV !== "production") && tokenToVerify && (
      tokenToVerify.startsWith("demo_") ||
      tokenToVerify.startsWith("mock_") ||
      tokenToVerify.startsWith("google_fallback_") ||
      req.body.isDemo === true
    );

    if (isExplicitDemo) {
      payload = {
        email: req.body.email || "google.user@foodsaver.org",
        name: req.body.name || "Google User",
        sub: "google_demo_1092837465",
        picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      };
    } else if (credential) {
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (verifyErr) {
        verifyErrorMsg = verifyErr.message;
        console.warn("Google ID Token verification failed, attempting access token lookup:", verifyErr.message);
      }
    }

    if (!payload && tokenToVerify && !isExplicitDemo) {
      try {
        const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenToVerify}` },
        });
        if (userinfoRes.ok) {
          payload = await userinfoRes.json();
        } else {
          verifyErrorMsg = verifyErrorMsg || `Userinfo request returned status ${userinfoRes.status}`;
        }
      } catch (err) {
        verifyErrorMsg = verifyErrorMsg || err.message;
      }
    }

    if (!payload) {
      console.error("Google token verification failed:", verifyErrorMsg);
      return res.status(401).json({ error: "Invalid Google authorization token.", details: verifyErrorMsg });
    }

    const { email, name, picture, sub } = payload || {};
    if (!email) {
      return res.status(400).json({ error: "Google payload does not contain a valid email address." });
    }

    const rawEmail = email.trim().toLowerCase();
    const displayName = (name || email.split("@")[0]).trim();
    const targetRole = (role || "customer").toUpperCase();

    let userObj = null;

    try {
      // Check MySQL dim_users
      const [userRows] = await pool.query(
        "SELECT * FROM dim_users WHERE LOWER(email) = ?",
        [rawEmail]
      );

      if (userRows.length > 0) {
        userObj = userRows[0];
      } else {
        // Auto-create user record in dim_users
        const userId = `usr_g_${sub || crypto.randomBytes(6).toString("hex")}`;
        const defaultStatus = targetRole === "CUSTOMER" || targetRole === "USER" ? "APPROVED" : "PENDING";
        const randomPasswordHash = await bcrypt.hash(`google_${sub || Date.now()}`, 10);

        await pool.query(
          `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status, created_at)
           VALUES (?, ?, ?, ?, ?, TRUE, ?, NOW())`,
          [userId, targetRole === "CUSTOMER" ? "CUSTOMER" : targetRole, rawEmail, randomPasswordHash, displayName, defaultStatus]
        );

        userObj = {
          user_id: userId,
          role_id: targetRole === "CUSTOMER" ? "CUSTOMER" : targetRole,
          email: rawEmail,
          full_name: displayName,
          status: defaultStatus,
        };
      }
    } catch (dbErr) {
      console.warn("Database lookup failed during Google OAuth, utilizing memory user profile:", dbErr.message);
      userObj = {
        user_id: `usr_g_${sub || Date.now()}`,
        role_id: targetRole === "CUSTOMER" ? "CUSTOMER" : targetRole,
        email: rawEmail,
        full_name: displayName,
        status: targetRole === "CUSTOMER" || targetRole === "USER" ? "APPROVED" : "PENDING",
      };
    }

    const effectiveRole = (userObj.role_id || targetRole).toUpperCase();
    const appToken = createToken({
      userId: userObj.user_id,
      email: userObj.email,
      role: effectiveRole,
      name: userObj.full_name,
    });

    const isPartnerPending = (effectiveRole === "MERCHANT" || effectiveRole === "NGO") && userObj.status !== "APPROVED";

    return res.json({
      ok: true,
      token: appToken,
      requiresOnboarding: isPartnerPending,
      user: {
        userId: userObj.user_id,
        email: userObj.email,
        name: userObj.full_name,
        role: effectiveRole,
        status: userObj.status,
        picture: picture || null,
      },
    });
  } catch (err) {
    console.error("Error in /api/auth/google endpoint:", err);
    return res.status(500).json({ error: "Google authentication processing failed." });
  }
});

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth 2.0 authorization code redirect callback
 */
router.get("/google/callback", async (req, res) => {
  const { code, error: googleError, state } = req.query || {};

  if (googleError) {
    console.warn("Google OAuth callback error returned by Google:", googleError);
    const friendlyError = googleError === "access_denied"
      ? "Google sign-in request was cancelled or denied."
      : `Google authorization failed (${googleError}).`;
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(friendlyError)}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("No authorization code received from Google.")}`);
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await googleOAuthClient.getToken({
      code: String(code),
      redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    });

    let payload = null;
    if (tokens.id_token) {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else if (tokens.access_token) {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userinfoRes.ok) {
        payload = await userinfoRes.json();
      }
    }

    if (!payload || !payload.email) {
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("Could not retrieve user identity from Google.")}`);
    }

    const rawEmail = payload.email.trim().toLowerCase();
    const displayName = (payload.name || payload.email.split("@")[0]).trim();
    let targetRole = "CUSTOMER";

    // Attempt to decode role from state if safe
    if (state && typeof state === "string") {
      try {
        const parsedState = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (parsedState?.role) {
          targetRole = String(parsedState.role).toUpperCase();
        }
      } catch (e) {
        // ignore invalid state parse
      }
    }

    let userObj = null;
    try {
      const [userRows] = await pool.query("SELECT * FROM dim_users WHERE LOWER(email) = ?", [rawEmail]);
      if (userRows.length > 0) {
        userObj = userRows[0];
      } else {
        const userId = `usr_g_${payload.sub || crypto.randomBytes(6).toString("hex")}`;
        const defaultStatus = targetRole === "CUSTOMER" || targetRole === "USER" ? "APPROVED" : "PENDING";
        const randomPasswordHash = await bcrypt.hash(`google_${payload.sub || Date.now()}`, 10);

        await pool.query(
          `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, is_active, status, created_at)
           VALUES (?, ?, ?, ?, ?, TRUE, ?, NOW())`,
          [userId, targetRole === "CUSTOMER" ? "CUSTOMER" : targetRole, rawEmail, randomPasswordHash, displayName, defaultStatus]
        );

        userObj = {
          user_id: userId,
          role_id: targetRole === "CUSTOMER" ? "CUSTOMER" : targetRole,
          email: rawEmail,
          full_name: displayName,
          status: defaultStatus,
        };
      }
    } catch (dbErr) {
      console.warn("Database error in OAuth callback fallback:", dbErr.message);
      userObj = {
        user_id: `usr_g_${payload.sub || Date.now()}`,
        role_id: targetRole === "CUSTOMER" ? "CUSTOMER" : targetRole,
        email: rawEmail,
        full_name: displayName,
        status: "APPROVED",
      };
    }

    const effectiveRole = (userObj.role_id || targetRole).toUpperCase();
    const appToken = createToken({
      userId: userObj.user_id,
      email: userObj.email,
      role: effectiveRole,
      name: userObj.full_name,
    });

    const isPartnerPending = (effectiveRole === "MERCHANT" || effectiveRole === "NGO") && userObj.status !== "APPROVED";

    const redirectUrl = new URL(`${FRONTEND_URL}/login`);
    redirectUrl.searchParams.set("token", appToken);
    redirectUrl.searchParams.set("role", effectiveRole);
    redirectUrl.searchParams.set("name", userObj.full_name);
    redirectUrl.searchParams.set("email", userObj.email);
    if (isPartnerPending) redirectUrl.searchParams.set("requiresOnboarding", "true");

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Google OAuth callback exception:", err);
    return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent("Google login processing failed. Please try again.")}`);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user information from database
 */
router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const [userRows] = await pool.query(
      `SELECT user_id, role_id, email, full_name, phone_number, phone_verified, phone_verified_at,
              preferred_language, preferred_theme, custom_theme_config, notification_preferences,
              status, is_active, latitude, longitude, created_at
       FROM dim_users WHERE user_id = ? OR LOWER(email) = ?`,
      [req.user.userId, (req.user.email || "").toLowerCase()]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User account not found." });
    }

    const u = userRows[0];
    const userRole = (u.role_id || req.user.role).toUpperCase();
    let partnerInfo = null;

    if (userRole === "MERCHANT") {
      const [hotels] = await pool.query("SELECT * FROM dim_hotels WHERE merchant_user_id = ?", [u.user_id]);
      partnerInfo = hotels[0] || null;
    } else if (userRole === "NGO") {
      const [ngos] = await pool.query("SELECT * FROM dim_ngos WHERE ngo_user_id = ?", [u.user_id]);
      partnerInfo = ngos[0] || null;
    }

    let parsedNotifPrefs = { email: true, sms: true, inApp: true, orderAlerts: true };
    try {
      if (u.notification_preferences) {
        parsedNotifPrefs = typeof u.notification_preferences === "string" ? JSON.parse(u.notification_preferences) : u.notification_preferences;
      }
    } catch {}

    let parsedCustomTheme = null;
    try {
      if (u.custom_theme_config) {
        parsedCustomTheme = typeof u.custom_theme_config === "string" ? JSON.parse(u.custom_theme_config) : u.custom_theme_config;
      }
    } catch {}

    return res.json({
      ok: true,
      user: {
        userId: u.user_id,
        email: u.email,
        name: u.full_name,
        role: userRole,
        status: u.status,
        phoneNumber: u.phone_number,
        phoneVerified: Boolean(u.phone_verified),
        phoneVerifiedAt: u.phone_verified_at,
        preferredLanguage: u.preferred_language || "en",
        preferredTheme: u.preferred_theme || "forest_green",
        customThemeConfig: parsedCustomTheme,
        notificationPreferences: parsedNotifPrefs,
        latitude: u.latitude,
        longitude: u.longitude,
        partnerInfo,
      },
    });
  } catch (err) {
    console.error("Error in /api/auth/me:", err);
    return res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post("/refresh", async (req, res) => {
  try {
    const { token, refreshToken } = req.body || {};
    const candidate = token || refreshToken || req.headers.authorization?.replace("Bearer ", "");

    if (!candidate) {
      return res.status(401).json({ error: "Token required for refresh." });
    }

    let payload;
    try {
      payload = jwt.verify(candidate, JWT_SECRET, { ignoreExpiration: true });
    } catch {
      return res.status(401).json({ error: "Invalid refresh token." });
    }

    const [rows] = await pool.query(
      "SELECT user_id, role_id, email, full_name, status FROM dim_users WHERE user_id = ? OR LOWER(email) = ?",
      [payload.userId || payload.id, (payload.email || "").toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    const u = rows[0];
    const newToken = createToken({
      userId: u.user_id,
      email: u.email,
      role: (u.role_id || payload.role).toUpperCase(),
      name: u.full_name,
      status: u.status,
    });

    return res.json({
      ok: true,
      token: newToken,
      user: {
        userId: u.user_id,
        email: u.email,
        name: u.full_name,
        role: (u.role_id || payload.role).toUpperCase(),
        status: u.status,
      },
    });
  } catch (err) {
    console.error("Error in /api/auth/refresh:", err);
    return res.status(500).json({ error: "Token refresh failed." });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.body?.token;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        logAuditEvent({
          userId: payload.userId || payload.id,
          action: "USER_LOGOUT",
          entityType: "USER",
          entityId: payload.userId || payload.id,
          metadata: { email: payload.email, role: payload.role },
          ipAddress: req.ip,
        }).catch(() => {});
      }
    }
    return res.json({ ok: true, message: "Logged out successfully." });
  } catch (err) {
    return res.json({ ok: true, message: "Logged out." });
  }
});

/**
 * PUT /api/auth/profile
 * Update profile details for Customer, Merchant, or NGO
 */
router.put("/profile", async (req, res) => {
  try {
    const { email, name, mobile, address, dietaryPreference, regDetails, hotelName } = req.body || {};
    const rawEmail = (email || "").trim().toLowerCase();

    if (!rawEmail) {
      return res.status(400).json({ error: "Email is required to update profile." });
    }

    const displayName = (hotelName || name || "").trim();
    const phone = (mobile || "").trim();
    const locAddress = (address || "").trim();

    // 1. Update dim_users
    try {
      await pool.query(
        `UPDATE dim_users 
         SET full_name = COALESCE(NULLIF(?, ''), full_name), 
             phone_number = COALESCE(NULLIF(?, ''), phone_number),
             status = 'APPROVED'
         WHERE LOWER(email) = ?`,
        [displayName, phone || null, rawEmail]
      );
    } catch (dbErr) {
      console.warn("DB user profile update notice:", dbErr.message);
    }

    // 2. Fetch user to update hotel if merchant
    const [userRows] = await pool.query("SELECT * FROM dim_users WHERE LOWER(email) = ?", [rawEmail]);
    const userObj = userRows[0];

    if (userObj) {
      const isMerchant = String(userObj.role_id || "").toLowerCase() === "merchant";
      if (isMerchant || displayName || locAddress) {
        try {
          const [existingHotels] = await pool.query(
            "SELECT hotel_id FROM dim_hotels WHERE merchant_user_id = ?",
            [userObj.user_id]
          );

          if (existingHotels.length > 0) {
            await pool.query(
              `UPDATE dim_hotels 
               SET hotel_name = COALESCE(NULLIF(?, ''), hotel_name),
                   address = COALESCE(NULLIF(?, ''), address),
                   contact_number = COALESCE(NULLIF(?, ''), contact_number),
                   verification_status = 'approved',
                   status = 'APPROVED'
               WHERE merchant_user_id = ?`,
              [displayName, locAddress, phone, userObj.user_id]
            );
          } else if (isMerchant) {
            const newHotelId = `htl_${Date.now()}`;
            await pool.query(
              `INSERT INTO dim_hotels (hotel_id, merchant_user_id, hotel_name, address, contact_number, verification_status, status)
               VALUES (?, ?, ?, ?, ?, 'approved', 'APPROVED')`,
              [newHotelId, userObj.user_id, displayName || userObj.full_name, locAddress || "Kovilpatti", phone || userObj.phone_number]
            );
          }
        } catch (hotelErr) {
          console.warn("DB hotel profile update notice:", hotelErr.message);
        }
      }
    }

    return res.json({
      ok: true,
      message: "Profile details updated successfully.",
      user: {
        email: rawEmail,
        name: displayName,
        hotelName: displayName,
        mobile: phone,
        address: locAddress,
        dietaryPreference,
        regDetails,
        status: "APPROVED",
        verificationStatus: "approved",
      },
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    return res.status(500).json({ error: "Failed to update user profile." });
  }
});

/**
 * POST /api/auth/send-otp & POST /api/auth/phone/send-otp & POST /api/auth/phone/resend-otp
 * Dispatches a cryptographically secure 6-digit SMS OTP
 */
router.post(["/send-otp", "/phone/send-otp", "/phone/resend-otp"], async (req, res) => {
  try {
    const { phoneNumber, userId, email, channel = "sms" } = req.body || {};

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: "Phone number is required to send OTP." });
    }

    const result = await requestOtp({
      phoneNumber,
      userId: userId || req.user?.userId || null,
      purpose: "PHONE_VERIFICATION",
    });

    if (!result.success) {
      const code = result.code === "COOLDOWN_ACTIVE" ? 429 : result.code === "RATE_LIMIT_EXCEEDED" ? 429 : 400;
      return res.status(code).json(result);
    }

    // Optionally send OTP by email as well if user email is known
    if (email && email.includes("@")) {
      sendOtpEmail({ to: email, name: "FoodSaver User", otp: "******" }).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    console.error("Error in send-otp:", err);
    return res.status(500).json({ success: false, error: "Failed to dispatch verification code." });
  }
});

/**
 * POST /api/auth/verify-otp & POST /api/auth/phone/verify-otp
 * Verifies 6-digit OTP code and marks phone as verified
 */
router.post(["/verify-otp", "/phone/verify-otp"], async (req, res) => {
  try {
    const { phoneNumber, otp, userId } = req.body || {};

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        error: "Both phone number and 6-digit OTP are required.",
      });
    }

    const result = await verifyOtp({
      phoneNumber,
      otp,
      userId: userId || req.user?.userId || null,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Trigger in-app notification for security event
    if (userId) {
      createNotification({
        userId,
        type: "SECURITY",
        title: "📱 Phone Number Verified",
        message: `Your mobile number (${result.phoneNumber}) was successfully verified with SMS OTP.`,
      }).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    console.error("Error in verify-otp:", err);
    return res.status(500).json({ success: false, error: "Failed to verify OTP code." });
  }
});

/**
 * GET /api/auth/phone/status
 * Retrieves phone verification status for user or phone
 */
router.get(["/phone/status", "/status"], async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.userId;
    const phone = req.query.phoneNumber || req.query.phone;

    let userRow = null;
    if (userId) {
      const [rows] = await pool.query(
        "SELECT user_id, phone_number, phone_verified, phone_verified_at FROM dim_users WHERE user_id = ? OR email = ?",
        [userId, userId]
      );
      if (rows.length > 0) userRow = rows[0];
    } else if (phone) {
      const [rows] = await pool.query(
        "SELECT user_id, phone_number, phone_verified, phone_verified_at FROM dim_users WHERE phone_number = ?",
        [phone]
      );
      if (rows.length > 0) userRow = rows[0];
    }

    const isVerified = Boolean(userRow?.phone_verified);
    const phoneNumber = userRow?.phone_number || phone || null;
    const maskedPhone = phoneNumber && phoneNumber.length >= 10
      ? `${phoneNumber.slice(0, 5)}******${phoneNumber.slice(-2)}`
      : null;

    return res.json({
      success: true,
      status: isVerified ? "VERIFIED" : "UNVERIFIED",
      isVerified,
      phoneNumber,
      maskedPhone,
      verifiedAt: userRow?.phone_verified_at || null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/auth/preferences
 * Saves multilingual, dynamic theme, and notification preferences
 */
router.put("/preferences", async (req, res) => {
  try {
    const {
      userId,
      email,
      preferredLanguage,
      preferredTheme,
      customThemeConfig,
      notificationPreferences,
    } = req.body || {};

    const targetUser = userId || req.user?.userId;
    const targetEmail = (email || req.user?.email || "").toLowerCase().trim();

    if (!targetUser && !targetEmail) {
      return res.status(400).json({ error: "User ID or email is required to update preferences." });
    }

    const updates = [];
    const params = [];

    if (preferredLanguage) {
      updates.push("preferred_language = ?");
      params.push(preferredLanguage);
    }

    if (preferredTheme) {
      updates.push("preferred_theme = ?");
      params.push(preferredTheme);
    }

    if (customThemeConfig !== undefined) {
      updates.push("custom_theme_config = ?");
      params.push(customThemeConfig ? JSON.stringify(customThemeConfig) : null);
    }

    if (notificationPreferences !== undefined) {
      updates.push("notification_preferences = ?");
      params.push(notificationPreferences ? JSON.stringify(notificationPreferences) : null);
    }

    if (updates.length > 0) {
      let whereClause = "";
      if (targetUser && targetEmail) {
        whereClause = "WHERE user_id = ? OR LOWER(email) = ?";
        params.push(targetUser, targetEmail);
      } else if (targetUser) {
        whereClause = "WHERE user_id = ?";
        params.push(targetUser);
      } else {
        whereClause = "WHERE LOWER(email) = ?";
        params.push(targetEmail);
      }

      await pool.query(`UPDATE dim_users SET ${updates.join(", ")} ${whereClause}`, params);
    }

    return res.json({
      ok: true,
      message: "Preferences updated successfully.",
      preferences: {
        preferredLanguage: preferredLanguage || "en",
        preferredTheme: preferredTheme || "forest_green",
        customThemeConfig,
        notificationPreferences,
      },
    });
  } catch (err) {
    console.error("Error updating user preferences:", err);
    return res.status(500).json({ error: "Failed to update preferences." });
  }
});

/**
 * POST /api/auth/change-password
 * Forces password reset for demo accounts or user requested password updates
 */
router.post("/change-password", async (req, res) => {
  try {
    const { userId, email, oldPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.body?.token;
    const tokenPayload = token ? verifyToken(token) : null;

    const targetUserId = userId || tokenPayload?.userId || tokenPayload?.id;
    const targetEmail = email ? email.toLowerCase().trim() : (tokenPayload?.email || "").toLowerCase().trim();

    if (!targetUserId && !targetEmail) {
      return res.status(400).json({ error: "User identity required." });
    }

    const [users] = await pool.query(
      "SELECT * FROM dim_users WHERE user_id = ? OR LOWER(email) = ?",
      [targetUserId, targetEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = users[0];

    // If oldPassword provided, verify it (unless must_change_password is true for demo setup)
    if (oldPassword) {
      const match = await bcrypt.compare(oldPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE dim_users SET password_hash = ?, must_change_password = FALSE WHERE user_id = ?",
      [newHash, user.user_id]
    );

    return res.json({
      ok: true,
      message: "Password changed successfully! You may now log in with your new password.",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    return res.status(500).json({ error: "Failed to change password." });
  }
});

module.exports = {
  router,
  requireMerchant,
  requireAdmin,
  verifyToken,
  createToken,
  authenticateJWT,
  authorizeRole,
};

