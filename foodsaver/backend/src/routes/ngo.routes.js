const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const store = require('../data/store');

const JWT_SECRET = process.env.JWT_SECRET || 'foodsaver_merchant_secret_key_2026';

module.exports = function ngoRouter(io) {
  const router = express.Router();

  // Middleware to authenticate JWT token and ensure NGO role
  function authenticateNgo(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.body?.token || req.query?.token;

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role && decoded.role.toLowerCase() !== "ngo" && decoded.role.toLowerCase() !== "admin") {
        return res.status(403).json({ error: "forbidden", message: "NGO access required" });
      }
      const userId = decoded.userId || decoded.id;
      req.user = { ...decoded, userId };
      next();
    } catch (err) {
      return res.status(401).json({ error: "invalid_token", message: "Invalid or expired authentication token" });
    }
  }

  // Real route: GET /api/ngo/partners — approved NGO partners from database
  router.get('/partners', async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT ngo_id as id, ngo_name as name, service_radius_km as radiusKm, address, contact_number as phone FROM dim_ngos WHERE verification_status = 'approved' OR status = 'APPROVED'"
      );
      res.json({ partners: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Legacy route: GET /api/ngo/notifications — rescue alerts
  router.get('/notifications', async (req, res) => {
    try {
      const notifications = await store.listNgoNotifications();
      res.json({ notifications });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Legacy route: POST /api/ngo/notifications/:id/acknowledge
  router.post('/notifications/:id/acknowledge', async (req, res) => {
    try {
      const { ngoName } = req.body || {};
      const result = await store.acknowledgeNotification(req.params.id, ngoName || 'Partner NGO');
      if (result.error) return res.status(404).json({ error: result.error });

      if (io) {
        io.emit('ngo:acknowledged', result.notification);
        if (result.merchantNotice) {
          io.emit('merchant:ngo-collected', result.merchantNotice);
        }
        const listing = await store.getListing(result.notification.listingId);
        if (listing) {
          io.emit('listing:updated', listing);
        }
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Legacy route: POST /api/ngo/rescue
  router.post('/rescue', async (req, res) => {
    try {
      const { listingId, ngoName, quantity } = req.body || {};
      if (!listingId) {
        return res.status(400).json({ error: 'listingId is required' });
      }
      const result = await store.claimListing(listingId, {
        customerId: ngoName || 'ngo_partner',
        customerName: ngoName || 'Partner NGO',
        customerUsername: (ngoName || 'ngo_partner').toLowerCase().replace(/\s+/g, '_'),
        quantity: Math.max(1, Number(quantity) || 1),
        method: 'ngo_rescue',
      });
      if (result.error) return res.status(400).json({ error: result.error });

      if (io && result.listing) {
        io.emit('listing:updated', result.listing);
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1. REGISTER NGO (Step 1)
  router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, phone, organizationName, organizationType } = req.body;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ error: 'validation_error', message: 'Full name, email, phone, and password are required.' });
    }

    // Check duplicate email
    const [existingEmail] = await pool.query('SELECT user_id FROM dim_users WHERE LOWER(email) = ?', [email.toLowerCase().trim()]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'duplicate_email', message: 'An account with this email already exists.' });
    }

    // Check duplicate phone
    const [existingPhone] = await pool.query('SELECT user_id FROM dim_users WHERE phone_number = ?', [phone.trim()]);
    if (existingPhone.length > 0) {
      return res.status(400).json({ error: 'duplicate_phone', message: 'An account with this phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_ngo_${Date.now()}`;

    // Create user in dim_users with status = 'DRAFT'
    await pool.query(
      `INSERT INTO dim_users (user_id, role_id, email, password_hash, full_name, phone_number, status, is_active)
       VALUES (?, 'ngo', ?, ?, ?, ?, 'DRAFT', TRUE)`,
      [userId, email.toLowerCase().trim(), passwordHash, fullName.trim(), phone.trim()]
    );

    // Initial draft in dim_ngos
    const ngoId = `ngo_${Date.now()}`;
    await pool.query(
      `INSERT INTO dim_ngos (ngo_id, ngo_user_id, ngo_name, organization_type, address, contact_number, service_radius_km, status, verification_status)
       VALUES (?, ?, ?, ?, 'Address pending', ?, 5.0, 'DRAFT', 'pending')`,
      [ngoId, userId, organizationName || fullName, organizationType || 'Trust', phone.trim()]
    );

    const token = jwt.sign(
      { userId, email: email.toLowerCase().trim(), role: 'ngo', status: 'DRAFT' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'NGO user registered successfully as draft',
      token,
      user: {
        id: userId,
        ngoId,
        email: email.toLowerCase().trim(),
        fullName,
        role: 'ngo',
        status: 'DRAFT',
      },
    });
  } catch (err) {
    console.error('Error registering NGO:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 2. NGO LOGIN WITH STRICT DB STATUS RESTRICTION
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'validation_error', message: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT u.*, n.ngo_id, n.status as ngo_status, n.verification_status, n.rejection_reason
       FROM dim_users u
       LEFT JOIN dim_ngos n ON u.user_id = n.ngo_user_id
       WHERE LOWER(u.email) = ? AND (LOWER(u.role_id) = 'ngo' OR u.role_id = 'NGO')`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid NGO credentials' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid NGO credentials' });
    }

    const statusUpper = String(user.ngo_status || user.status || 'DRAFT').toUpperCase();

    // STRICT STATUS ACCESS CONTROLS
    if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(statusUpper)) {
      return res.status(403).json({
        error: 'account_under_review',
        message: 'Your NGO account is currently under review.',
        status: statusUpper,
      });
    }

    if (statusUpper === 'REJECTED') {
      return res.status(403).json({
        error: 'account_rejected',
        message: `Your application was rejected: ${user.rejection_reason || 'Please review requirements and resubmit.'}`,
        rejectionReason: user.rejection_reason,
        status: 'REJECTED',
      });
    }

    if (statusUpper === 'DRAFT') {
      const token = jwt.sign(
        { userId: user.user_id, email: user.email, role: 'ngo', status: 'DRAFT' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(200).json({
        message: 'Incomplete onboarding wizard',
        token,
        status: 'DRAFT',
        requiresOnboarding: true,
        user: {
          id: user.user_id,
          ngoId: user.ngo_id,
          email: user.email,
          fullName: user.full_name,
          role: 'ngo',
          status: 'DRAFT',
        },
      });
    }

    // APPROVED or ACTIVE
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: 'ngo', status: statusUpper },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'NGO login successful',
      token,
      user: {
        id: user.user_id,
        ngoId: user.ngo_id,
        email: user.email,
        fullName: user.full_name,
        role: 'ngo',
        status: statusUpper,
      },
    });
  } catch (err) {
    console.error('Error logging in NGO:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 3. SAVE NGO DRAFT
router.post('/save-draft', authenticateNgo, async (req, res) => {
  try {
    const result = await store.saveNgoDraft(req.user.userId, req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error saving NGO draft:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 4. SUBMIT NGO ONBOARDING APPLICATION
router.post('/submit', authenticateNgo, async (req, res) => {
  try {
    const result = await store.submitNgoOnboarding(req.user.userId, req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error submitting NGO onboarding:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 5. GET NGO PROFILE
router.get('/profile', authenticateNgo, async (req, res) => {
  try {
    const profile = await store.getNgoFullProfile(req.user.userId);
    if (!profile) return res.status(404).json({ error: 'not_found', message: 'NGO profile not found.' });
    return res.status(200).json(profile);
  } catch (err) {
    console.error('Error fetching NGO profile:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 6. UPDATE NGO PROFILE
router.put('/profile', authenticateNgo, async (req, res) => {
  try {
    const updated = await store.updateNgoProfile(req.user.userId, req.body);
    return res.status(200).json({ message: 'NGO profile updated successfully', profile: updated });
  } catch (err) {
    console.error('Error updating NGO profile:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 7. GET NGO APPLICATION STATUS
router.get('/status', authenticateNgo, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.status, n.verification_status, n.rejection_reason, u.status as user_status
       FROM dim_ngos n
       JOIN dim_users u ON n.ngo_user_id = u.user_id
       WHERE n.ngo_user_id = ?`,
      [req.user.userId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'not_found', message: 'NGO status not found.' });

    const statusUpper = (rows[0].status || rows[0].verification_status || 'DRAFT').toUpperCase();
    return res.status(200).json({
      status: statusUpper,
      verificationStatus: rows[0].verification_status,
      rejectionReason: rows[0].rejection_reason,
      userStatus: rows[0].user_status,
    });
  } catch (err) {
    console.error('Error fetching NGO status:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 8. GET NGO IMPACT STATS
router.get('/impact-stats', authenticateNgo, async (req, res) => {
  try {
    const stats = await store.getNgoImpactStats(req.user.userId);
    return res.status(200).json(stats);
  } catch (err) {
    console.error('Error fetching NGO impact stats:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 9. GET AVAILABLE DONATIONS FOR CLAIMING
router.get('/donations/available', authenticateNgo, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, h.hotel_name, u.phone_number as merchant_phone
       FROM fact_donations d
       JOIN dim_hotels h ON d.hotel_id = h.hotel_id
       JOIN dim_users u ON d.merchant_user_id = u.user_id
       WHERE d.status IN ('DONATION_CREATED', 'NGO_NOTIFIED')
       ORDER BY d.created_at DESC`
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching available donations:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 10. ACCEPT DONATION BY NGO
router.post('/donations/:id/accept', authenticateNgo, async (req, res) => {
  try {
    const result = await store.acceptDonationByNgo(req.user.userId, req.params.id);
    if (result.error) {
      return res.status(400).json({ error: result.error, message: 'Could not accept donation' });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error accepting donation:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 11. UPDATE PICKUP STATUS
router.put('/donations/:id/status', authenticateNgo, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await store.updateNgoPickupStatus(req.user.userId, req.params.id, status);
    if (result.error) {
      return res.status(400).json({ error: result.error, message: 'Invalid status transition' });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error updating donation pickup status:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// 12. GET NGO DOCUMENTS
router.get('/documents', authenticateNgo, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ngo_documents WHERE ngo_user_id = ?', [req.user.userId]);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching NGO documents:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});
  return router;
};
