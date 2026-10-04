# FoodSaver Direct Connect - Production Upgrade Changelog

> [!NOTE]
> Detailed record of all structural schema additions, backend logic enhancements, security hardening, and UI/UX polish completed during the production upgrade.

---

## 1. Database Migrations (`v2_production_upgrade.js`)
- **Safe & Non-Destructive Schema Expansion**:
  - Added `must_change_password` to `dim_users` to enforce demo password resets.
  - Added `night_sale_start_time`, `night_sale_end_time`, `auto_rescue_enabled` to `dim_hotels` for dynamic Day/Night mode switching.
  - Added `order_mode`, `payment_method`, `payment_status`, `razorpay_order_id`, `razorpay_payment_id`, `pickup_token`, `qr_code_url` to `fact_claims`.
  - Created `dim_user_addresses` table for saved customer addresses.
  - Created `fact_reviews` table for post-pickup customer ratings & reviews.
  - Created `push_subscriptions` table for PWA Web Push notification endpoints.
  - Added key performance indexes on `dim_hotels(location_city)`, `fact_listings(status, expires_at)`, `fact_claims(status, customer_user_id)`, and `dim_menu_items(hotel_id, is_veg)`.

---

## 2. Backend Services & API Routes
- **Razorpay Payment Integration (`payment.routes.js` & `razorpayService.js`)**:
  - Implemented Razorpay test mode payment order creation and HMAC-SHA256 signature verification.
  - Added "Pay at counter" cash/UPI fallback option with explicit payment status tracking.
- **Pickup Token & QR Verification (`qrToken.js` & `orders.routes.js`)**:
  - Built `FS-XXXXXX` pickup token generator and QR Code DataURL creator.
  - Implemented merchant QR code scanner and token lookup endpoint with MySQL `FOR UPDATE` transaction locks to prevent double redemptions.
- **Security & Quality Hardening**:
  - Added `helmet` security headers and `express-rate-limit` middleware on all API routes.
  - Integrated `node-cron` background sweeper for automated deal expiry and handoff to the NGO donation queue (`fact_donations`).
  - Added `POST /api/auth/change-password` endpoint.

---

## 3. Frontend UI/UX & PWA
- **ForcePasswordResetModal (`ForcePasswordResetModal.jsx`)**:
  - Integrated forced password reset modal for demo merchant accounts with `must_change_password = true`.
- **PWA Capabilities**:
  - Created `manifest.json` and Service Worker `sw.js` for app shell caching and Web Push notifications.
  - Registered service worker in `main.jsx`.
- **API Client Upgrades (`api.js`)**:
  - Added methods for password reset, Razorpay payments, user addresses, post-pickup reviews, and Web Push subscriptions.

---

## 4. Verification & Testing
- `test/clean_database_verification.test.js` executed with 100% pass rate (0 errors).
- `npx vite build` compiled successfully (2180 modules transformed).
- All 86 hotels, 345+ listings, 120 users, and 38 Tamil Nadu districts preserved intact without any data loss.
