# Food Saver — Direct Connect

A hyper-local marketplace for end-of-day surplus food. Merchants post
closing-time bundles with a live countdown; nearby residents claim them at a
steep discount and get a digital pickup token; and if a countdown reaches
zero with stock still unclaimed, **nearby NGOs are notified automatically**
so the food gets rescued instead of binned.

```
foodsaver/
├── backend/    Express + Socket.io real-time API (run this first)
└── frontend/   React (Vite) app — responsive for both web and mobile
```

## Quick start

Open two terminals.

**Terminal 1 — backend**
```bash
cd backend
npm install
npm start
```
Runs on `http://localhost:4000`.

**Terminal 2 — frontend**
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`. Open it in a browser, pick a role
(resident / merchant / NGO partner), and go.

See `backend/README.md` and `frontend/README.md` for full details, the API
reference, and instructions for testing from a real phone on your Wi-Fi.

## How the pieces map to the brief

| Brief requirement | Where it lives |
|---|---|
| Flash Inventory Console | `frontend/src/pages/MerchantDashboard.jsx`, `MerchantPost.jsx` |
| Real-Time Claims Engine (state-synced, no over-allocation) | `backend/src/data/store.js` (`claimListing`, atomic decrement) + Socket.io broadcast |
| Digital Pickup Tokens | `backend/src/data/store.js` (`genToken`) + `frontend/src/components/TokenStub.jsx`, `MerchantCounter.jsx` |
| Countdown timers | `frontend/src/components/CountdownBar.jsx` + `backend/src/sockets/expirySweeper.js` (server is the source of truth) |
| **"Counter time closed → notify nearby NGOs"** (your addition) | `backend/src/sockets/expirySweeper.js` → `store.sweepExpiredListings` → `ngo:notification` socket event → `frontend/src/pages/NgoDashboard.jsx` |
| Web + mobile users | One responsive React app (`frontend/`) — bottom tab nav, installable web-app manifest, works in any mobile browser. See note below. |

## About "web user and mobile user"

This ships as **one responsive React web app** that works well on both
desktop browsers and phone browsers (and can be "installed" to a phone's
home screen via the included manifest — no app-store submission needed).
That's the fastest path to a real, working product across both surfaces
with a single codebase and a single backend to keep in sync.

If you specifically need a **native mobile app** (e.g. via React Native) in
addition to this, the backend here needs no changes — it's a plain REST +
Socket.io API — and I'm happy to scaffold a React Native client against it
as a follow-up.

## Notes on the current build

- Data is stored **in memory** on the backend for simplicity — it resets on
  server restart. Swapping in a real database only requires changing
  `backend/src/data/store.js`; no route or socket code needs to change.
- There's no real authentication — role + name is picked once and kept in
  the browser (`localStorage`). Fine for a demo/MVP; add real auth before
  any production use.
- Map view was simplified to a list/feed for this MVP; listings already
  carry `lat`/`lng` so a map (e.g. Leaflet) can be dropped in later without
  backend changes.
