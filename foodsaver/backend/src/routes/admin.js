const express = require("express");
const store = require("../data/store");
const { requireAdmin } = require("./auth");
const router = express.Router();

// Apply requireAdmin middleware to protect all /api/admin/* endpoints
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Returns list of user accounts with filtering & search for Admin review
 */
router.get("/users", async (req, res) => {
  try {
    const { role = "all", status = "all", search = "" } = req.query;
    const users = await store.listUsersForAdmin(role, status, search);
    return res.json({ ok: true, count: users.length, users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:id/approve
 * Admin approves a user/shop owner account
 */
router.post("/users/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const user = await store.updateUserApprovalStatus(id, "APPROVED", adminId);

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    // Also update any corresponding verification application or hotel if applicable
    const app = await store.getVerificationByEmailOrName(user.email);
    if (app) {
      await store.updateVerificationStatus(app.id, "approved");
    }

    return res.json({
      ok: true,
      message: "Account approved successfully.",
      user,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:id/reject
 * Admin rejects a user/shop owner account
 */
router.post("/users/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const user = await store.updateUserApprovalStatus(id, "REJECTED", adminId);

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    const app = await store.getVerificationByEmailOrName(user.email);
    if (app) {
      await store.updateVerificationStatus(app.id, "rejected", "Account rejected by administrator.");
    }

    return res.json({
      ok: true,
      message: "Account rejected successfully.",
      user,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/notifications
 */
router.get("/notifications", async (req, res) => {
  try {
    const data = await store.getAdminNotifications();
    return res.json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/notifications/:id/read
 */
router.post("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await store.markAdminNotificationRead(id);
    return res.json({ ok: true, notification });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/notifications/mark-all-read
 */
router.post("/notifications/mark-all-read", async (req, res) => {
  try {
    await store.markAllAdminNotificationsRead();
    return res.json({ ok: true, message: "All notifications marked as read." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/hotels
 */
router.get("/hotels", async (req, res) => {
  try {
    const hotels = await store.listHotelsForAdmin();
    return res.json({ ok: true, count: hotels.length, hotels });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/hotels/:id/approve
 */
router.post("/hotels/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await store.updateHotelStatus(id, "APPROVED");
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    if (result.hotel?.merchantName || result.hotel?.merchantId) {
      const app = (await store.getVerificationByEmailOrName(result.hotel.merchantName)) || (await store.getVerificationByEmailOrName(result.hotel.merchantId));
      if (app) {
        await store.updateVerificationStatus(app.id, "approved");
      }
    }

    return res.json({
      ok: true,
      message: `Hotel ${result.hotel.hotelName} approved successfully. It is now live for customers.`,
      hotel: result.hotel,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/hotels/:id/reject
 */
router.post("/hotels/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Hotel submission proof is incomplete. Please resubmit valid business details." } = req.body || {};

    const result = await store.updateHotelStatus(id, "REJECTED", reason);
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    return res.json({
      ok: true,
      message: `Hotel ${result.hotel.hotelName} rejected. Notification sent to merchant.`,
      hotel: result.hotel,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/verifications
 */
router.get("/verifications", async (req, res) => {
  try {
    const { role = "all", status = "all" } = req.query;
    const applications = await store.listVerifications(role, status);
    return res.json({ ok: true, count: applications.length, applications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/verifications/:id/approve
 */
router.post("/verifications/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await store.updateVerificationStatus(id, "approved");
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    if (result.application?.businessName) {
      await store.updateHotelStatus(result.application.businessName, "APPROVED");
    }

    return res.json({
      ok: true,
      message: "Application approved successfully. Partner is now verified.",
      application: result.application,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/verifications/:id/reject
 */
router.post("/verifications/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Submitted document is unreadable or incomplete. Please resubmit clear documentation." } = req.body || {};

    const result = await store.updateVerificationStatus(id, "rejected", reason);
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    if (result.application?.businessName) {
      await store.updateHotelStatus(result.application.businessName, "REJECTED", reason);
    }

    return res.json({
      ok: true,
      message: "Application rejected. Notification sent to partner.",
      application: result.application,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/verifications/:id/request-resubmission
 */
router.post("/verifications/:id/request-resubmission", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Please upload a valid business license or 80G tax document." } = req.body || {};

    const result = await store.updateVerificationStatus(id, "under_review", reason);
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    return res.json({
      ok: true,
      message: "Resubmission requested.",
      application: result.application,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/merchants
 */
router.get("/merchants", async (req, res) => {
  try {
    const { status = "all", type = "all", search = "" } = req.query;
    const merchants = await store.listMerchantsForAdmin(status, type, search);
    return res.json({ ok: true, count: merchants.length, merchants });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/merchants/:id
 */
router.get("/merchants/:id", async (req, res) => {
  try {
    const profile = await store.getMerchantFullProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: "Merchant not found." });
    return res.json({ ok: true, merchant: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/merchants/:id/approve
 */
router.post("/merchants/:id/approve", async (req, res) => {
  try {
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const profile = await store.updateMerchantApproval(req.params.id, "APPROVED", adminId);
    return res.json({ ok: true, message: "Merchant approved successfully.", merchant: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/merchants/:id/reject
 */
router.post("/merchants/:id/reject", async (req, res) => {
  try {
    const { reason = "Documentation incomplete or unverifiable." } = req.body || {};
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const profile = await store.updateMerchantApproval(req.params.id, "REJECTED", adminId, reason);
    return res.json({ ok: true, message: "Merchant application rejected.", merchant: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/merchants/:id/request-changes
 */
router.post("/merchants/:id/request-changes", async (req, res) => {
  try {
    const { reason = "Please upload updated food license / address proof." } = req.body || {};
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const profile = await store.updateMerchantApproval(req.params.id, "RESUBMIT", adminId, reason);
    return res.json({ ok: true, message: "Requested changes from merchant.", merchant: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/ngos
 */
router.get("/ngos", async (req, res) => {
  try {
    const { status = "all", search = "" } = req.query;
    const ngos = await store.listNgosForAdmin(status, search);
    return res.json({ ok: true, count: ngos.length, ngos });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/ngos/:id
 */
router.get("/ngos/:id", async (req, res) => {
  try {
    const profile = await store.getNgoFullProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: "NGO profile not found." });
    return res.json({ ok: true, ngo: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/ngos/:id/approve
 */
router.post("/ngos/:id/approve", async (req, res) => {
  try {
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const profile = await store.updateNgoApproval(req.params.id, "APPROVED", adminId);
    return res.json({ ok: true, message: "NGO approved successfully.", ngo: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/ngos/:id/reject
 */
router.post("/ngos/:id/reject", async (req, res) => {
  try {
    const { reason = "12A/80G tax document unverified." } = req.body || {};
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const profile = await store.updateNgoApproval(req.params.id, "REJECTED", adminId, reason);
    return res.json({ ok: true, message: "NGO application rejected.", ngo: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/ngos/:id/request-changes
 */
router.post("/ngos/:id/request-changes", async (req, res) => {
  try {
    const { reason = "Please re-upload a clear copy of Trust Deed and PAN." } = req.body || {};
    const adminId = req.adminUser?.user_id || req.user?.user_id || "admin-app-1";
    const profile = await store.updateNgoApproval(req.params.id, "RESUBMIT", adminId, reason);
    return res.json({ ok: true, message: "Requested changes from NGO.", ngo: profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/dashboard-stats
 * Real MySQL aggregation metrics for production admin dashboard
 */
router.get("/dashboard-stats", async (req, res) => {
  try {
    const { pool } = require("../config/database");

    // Total and role counts
    const [userCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN LOWER(role_id) = 'customer' THEN 1 ELSE 0 END) as total_customers,
        SUM(CASE WHEN LOWER(role_id) = 'merchant' THEN 1 ELSE 0 END) as total_merchants,
        SUM(CASE WHEN LOWER(role_id) = 'ngo' THEN 1 ELSE 0 END) as total_ngos,
        SUM(CASE WHEN LOWER(role_id) = 'admin' THEN 1 ELSE 0 END) as total_admins
      FROM dim_users
    `);

    // Merchant Approvals
    const [merchantApprovalCounts] = await pool.query(`
      SELECT 
        SUM(CASE WHEN status = 'APPROVED' OR verification_status = 'approved' THEN 1 ELSE 0 END) as approved_merchants,
        SUM(CASE WHEN status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW') OR verification_status IN ('pending', 'under_review') THEN 1 ELSE 0 END) as pending_merchant_approvals,
        SUM(CASE WHEN status = 'REJECTED' OR verification_status = 'rejected' THEN 1 ELSE 0 END) as rejected_merchants
      FROM dim_hotels
    `);

    // NGO Approvals
    const [ngoApprovalCounts] = await pool.query(`
      SELECT 
        SUM(CASE WHEN status = 'APPROVED' OR verification_status = 'approved' THEN 1 ELSE 0 END) as approved_ngos,
        SUM(CASE WHEN status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW') OR verification_status IN ('pending', 'under_review') THEN 1 ELSE 0 END) as pending_ngo_approvals
      FROM dim_ngos
    `);

    // Food Listings
    const [listingCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_listings,
        SUM(CASE WHEN status = 'active' AND expires_at > NOW() THEN 1 ELSE 0 END) as active_listings,
        COALESCE(SUM(quantity_total), 0) as total_portions_listed,
        COALESCE(SUM(quantity_available), 0) as total_portions_remaining
      FROM fact_listings
    `);

    // Claims / Orders
    const [orderCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('ORDER_PLACED', 'ORDER_CONFIRMED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'CUSTOMER_ON_THE_WAY', 'CUSTOMER_ARRIVED', 'pending') THEN 1 ELSE 0 END) as active_orders,
        SUM(CASE WHEN status IN ('COMPLETED', 'PICKED_UP', 'DELIVERED', 'collected') THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status IN ('COMPLETED', 'PICKED_UP', 'DELIVERED', 'collected') THEN quantity ELSE 0 END), 0) as food_sold_portions,
        COALESCE(SUM(CASE WHEN status IN ('COMPLETED', 'PICKED_UP', 'DELIVERED', 'collected') THEN price_paid ELSE 0 END), 0) as total_gmv
      FROM fact_claims
    `);

    // Donations
    const [donationCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total_donations,
        SUM(CASE WHEN status IN ('DONATION_COLLECTED', 'DONATION_COMPLETED') THEN 1 ELSE 0 END) as completed_donations,
        SUM(CASE WHEN status NOT IN ('DONATION_COLLECTED', 'DONATION_COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as active_donations,
        COALESCE(SUM(CASE WHEN status IN ('DONATION_COLLECTED', 'DONATION_COMPLETED') THEN quantity ELSE 0 END), 0) as food_donated_portions
      FROM fact_donations
    `);

    const soldPortions = Number(orderCounts[0]?.food_sold_portions || 0);
    const donatedPortions = Number(donationCounts[0]?.food_donated_portions || 0);
    const foodSavedPortions = soldPortions + donatedPortions;
    const foodSavedKg = Number((foodSavedPortions * 0.45).toFixed(1));
    const co2OffsetKg = Number((foodSavedKg * 2.5).toFixed(1));

    return res.json({
      ok: true,
      stats: {
        totalUsers: Number(userCounts[0]?.total_users || 0),
        totalCustomers: Number(userCounts[0]?.total_customers || 0),
        totalMerchants: Number(userCounts[0]?.total_merchants || 0),
        approvedMerchants: Number(merchantApprovalCounts[0]?.approved_merchants || 0),
        pendingMerchantApprovals: Number(merchantApprovalCounts[0]?.pending_merchant_approvals || 0),
        totalNgos: Number(userCounts[0]?.total_ngos || 0),
        approvedNgos: Number(ngoApprovalCounts[0]?.approved_ngos || 0),
        pendingNgoApprovals: Number(ngoApprovalCounts[0]?.pending_ngo_approvals || 0),
        totalListings: Number(listingCounts[0]?.total_listings || 0),
        activeListings: Number(listingCounts[0]?.active_listings || 0),
        totalOrders: Number(orderCounts[0]?.total_orders || 0),
        activeOrders: Number(orderCounts[0]?.active_orders || 0),
        completedOrders: Number(orderCounts[0]?.completed_orders || 0),
        foodSavedPortions,
        foodSavedKg,
        co2OffsetKg,
        totalDonations: Number(donationCounts[0]?.total_donations || 0),
        activeDonations: Number(donationCounts[0]?.active_donations || 0),
        totalGmv: Number(orderCounts[0]?.total_gmv || 0),
      },
    });
  } catch (err) {
    console.error("Error computing admin dashboard stats:", err);
    return res.status(500).json({ error: "Failed to load database statistics." });
  }
});

/**
 * GET /api/admin/audit-logs
 * Fetch system audit events
 */
router.get("/audit-logs", async (req, res) => {
  try {
    const { getAuditLogs } = require("../services/auditService");
    const { limit = 50, offset = 0, action, entityType, userId } = req.query;
    const data = await getAuditLogs({ limit, offset, action, entityType, userId });
    return res.json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/orders
 * List real database orders for monitoring
 */
router.get("/orders", async (req, res) => {
  try {
    const { pool } = require("../config/database");
    const { status = "all", search = "" } = req.query;

    let sql = `
      SELECT c.*, l.item_name, l.original_price, l.discount_price, h.hotel_name, u.full_name as customer_name, u.email as customer_email
      FROM fact_claims c
      JOIN fact_listings l ON c.listing_id = l.listing_id
      JOIN dim_hotels h ON l.hotel_id = h.hotel_id
      LEFT JOIN dim_users u ON c.customer_user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      sql += " AND c.status = ?";
      params.push(status);
    }
    if (search) {
      sql += " AND (l.item_name LIKE ? OR h.hotel_name LIKE ? OR c.claim_token LIKE ? OR u.full_name LIKE ?)";
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    sql += " ORDER BY c.claimed_at DESC LIMIT 100";
    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      count: rows.length,
      orders: rows.map((r) => ({
        id: r.claim_id,
        claimToken: r.claim_token,
        listingId: r.listing_id,
        itemName: r.item_name,
        hotelName: r.hotel_name,
        customerName: r.customer_name || "Customer",
        customerEmail: r.customer_email || "",
        quantity: r.quantity,
        pricePaid: Number(r.price_paid),
        status: r.status,
        claimedAt: r.claimed_at,
        collectedAt: r.collected_at,
        trackingActive: Boolean(r.tracking_active),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/listings
 * List real database listings for monitoring
 */
router.get("/listings", async (req, res) => {
  try {
    const { pool } = require("../config/database");
    const { status = "all", search = "" } = req.query;

    let sql = `
      SELECT l.*, h.hotel_name, c.name as category_name
      FROM fact_listings l
      JOIN dim_hotels h ON l.hotel_id = h.hotel_id
      LEFT JOIN dim_categories c ON l.category_id = c.category_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      sql += " AND l.status = ?";
      params.push(status);
    }
    if (search) {
      sql += " AND (l.item_name LIKE ? OR h.hotel_name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY l.created_at DESC LIMIT 100";
    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      count: rows.length,
      listings: rows.map((r) => ({
        id: r.listing_id,
        hotelName: r.hotel_name,
        itemName: r.item_name,
        category: r.category_name || "Food",
        isVeg: Boolean(r.is_veg),
        originalPrice: Number(r.original_price),
        discountPrice: Number(r.discount_price),
        quantityTotal: r.quantity_total,
        quantityAvailable: r.quantity_available,
        status: r.status,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/donations
 * List real database donations for monitoring
 */
router.get("/donations", async (req, res) => {
  try {
    const { pool } = require("../config/database");
    const [rows] = await pool.query(`
      SELECT d.*, h.hotel_name, u.full_name as merchant_name, nu.full_name as ngo_name
      FROM fact_donations d
      JOIN dim_hotels h ON d.hotel_id = h.hotel_id
      JOIN dim_users u ON d.merchant_user_id = u.user_id
      LEFT JOIN fact_donation_claims dc ON d.donation_id = dc.donation_id
      LEFT JOIN dim_users nu ON dc.ngo_user_id = nu.user_id
      ORDER BY d.created_at DESC
      LIMIT 100
    `);

    return res.json({
      ok: true,
      count: rows.length,
      donations: rows.map((r) => ({
        id: r.donation_id,
        hotelName: r.hotel_name,
        merchantName: r.merchant_name,
        itemName: r.item_name,
        quantity: r.quantity,
        address: r.address,
        status: r.status,
        pickupDeadline: r.pickup_deadline,
        ngoName: r.ngo_name || null,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/settings
 */
router.get("/settings", async (req, res) => {
  try {
    const settings = await store.getAppSettings();
    return res.json({ ok: true, settings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/settings
 */
router.post("/settings", async (req, res) => {
  try {
    const { key, value, settings } = req.body || {};
    if (settings && typeof settings === "object") {
      for (const [k, v] of Object.entries(settings)) {
        await store.updateAppSetting(k, v);
      }
    } else if (key && value !== undefined) {
      await store.updateAppSetting(key, value);
    } else {
      return res.status(400).json({ error: "key and value or settings object is required." });
    }

    const updated = await store.getAppSettings();
    return res.json({ ok: true, settings: updated, message: "Platform settings updated successfully." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

