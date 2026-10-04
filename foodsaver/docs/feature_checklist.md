# FoodSaver Direct Connect - Feature Completion Checklist

> [!NOTE]
> All features listed below are fully implemented, end-to-end verified with authentic database data (86 hotels, 345+ listings, 120 users, 38 Tamil Nadu districts), and tested.

---

## 1. Customer Role
- [x] **Authentication**: Sign up, login, JWT token management, forced demo password reset modal.
- [x] **Profile & Saved Addresses**: View and update profile, manage saved delivery/pickup addresses (`dim_user_addresses`).
- [x] **District & Hotel Discovery**: Filter by 38 Tamil Nadu districts, Leaflet map view, search bar, veg/non-veg filter, price, rating.
- [x] **Day Mode Menu & Cart**: Browse regular hotel menu, add items to cart, select quantity.
- [x] **Night Mode Surplus Rescue**: Live discounted listings feed, countdown timers (`MinutesRemaining`), left quantity, original vs discounted price, pickup window.
- [x] **Checkout & Payments**: Razorpay payment gateway integration in test mode + "Pay at counter" cash/UPI option with status tracking.
- [x] **Order Tracking & Stepper**: Live tracking screen (`Placed` > `Accepted` > `Preparing` > `Ready` > `Collected`).
- [x] **Pickup Token & QR Code**: Unique `FS-XXXXXX` pickup token with interactive QR code modal scanned by merchant.
- [x] **Map Route to Hotel**: Leaflet routing panel displaying route and distance to hotel.
- [x] **Ratings & Reviews**: Post-pickup modal to rate 1-5 stars and write feedback; recalculates hotel average rating.
- [x] **Notifications**: In-app notification bell + Web Push service worker notifications.

---

## 2. Merchant Role
- [x] **Registration & Onboarding**: Document upload (FSSAI/GST) and administrative approval status workflow.
- [x] **Menu Management**: Add, edit, remove menu items, images, price, veg/non-veg tags, availability.
- [x] **Live Order Board**: Real-time Socket.IO order board with Web Audio sound alert, order status transitions (`Accept`, `Preparing`, `Ready`, `Collected`).
- [x] **Pickup Verification & QR Scanner**: Camera QR code scanner (`html5-qrcode`) and manual `FS-XXXXXX` token verification modal.
- [x] **Night Deal Creation**: Convert menu or custom surplus items into discounted night deals with original price, discount %, quantity, pickup window, and controls to edit/pause/close early.
- [x] **Auto-Expiry Handoff**: Unsold listings at pickup deadline automatically transfer to the NGO donation queue (`fact_donations`).
- [x] **Analytics Dashboard**: Sales overview, total rescued portions, Day vs Night earnings breakdown with charts.

---

## 3. NGO Role
- [x] **Registration & Verification**: Onboarding wizard, registration details, administrative approval workflow.
- [x] **Live Expiring Surplus Queue**: Real-time list of unclaimed surplus food near NGO radius with one-click claim button.
- [x] **Bulk Claim & Handover**: Instant claim confirmation, pickup location details, and order history.
- [x] **Donation Receipt / Certificate**: Printable and downloadable donation receipt certificate.

---

## 4. Admin Role
- [x] **Merchant & NGO Approvals**: Modal interface to inspect submitted documents, approve, reject with reason, or put under review.
- [x] **User, Hotel & Listing Management**: Full CRUD management over all platform entities without touching or deleting authentic data.
- [x] **Impact Metrics Dashboard**: Food saved (kg), meals rescued, total platform revenue, NGO donations, district-wise stats.
- [x] **Audit Logs**: Comprehensive audit trail of system actions.

---

## 5. System Logic, Security & PWA
- [x] **Dynamic Day/Night Switching**: Controlled by merchant operating hours and surplus start times.
- [x] **Race-Condition Safety**: MySQL database transactions (`FOR UPDATE`) preventing over-selling of last portions.
- [x] **Background Cron Jobs**: `node-cron` sweeper handling deal expiry, NGO queue handoff, and reminder notifications.
- [x] **Geocoding & Fallback**: `KNOWN_CITIES` fallback map for all 38 Tamil Nadu districts + cached Nominatim results.
- [x] **AI Chatbot**: FoodSaver AI Chatbot querying live real data for nearby deals and order status.
- [x] **PWA Integration**: `manifest.json`, Service Worker `sw.js` for offline shell caching and Web Push notifications.
- [x] **Security Hardening**: Demo password reset enforcement, Rate limiting (`express-rate-limit`), Helmet security headers, CORS protection, bcrypt + JWT.
- [x] **Localization**: English (`en`), Tamil (`ta`), and Hindi (`hi`) translation toggle.
