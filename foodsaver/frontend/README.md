# Food Saver — Frontend

A single React (Vite) app that serves **both web and mobile users**: it's fully
responsive (bottom tab nav, touch-sized targets, viewport-fit layout) and
installable as a home-screen app on phones via the included web manifest
(Add to Home Screen). There's no separate mobile codebase to maintain.

## Run it

```bash
cd frontend
npm install
npm run dev
```

Opens on **http://localhost:5173**. Make sure the backend is running first
(see `../backend/README.md`) — by default the app talks to
`http://localhost:4000`. To point it elsewhere (e.g. your machine's LAN IP
so you can test from an actual phone), copy `.env.example` to `.env` and
set `VITE_API_URL`.

## Testing on a real phone

1. Find your computer's LAN IP (e.g. `192.168.1.20`).
2. `VITE_API_URL=http://192.168.1.20:4000` in `frontend/.env`.
3. `npm run dev -- --host` (already configured to listen on all interfaces).
4. On your phone, visit `http://192.168.1.20:5173` on the same Wi-Fi network.
5. Optional: use the browser's "Add to Home Screen" to install it like an app.

## How the three roles work

There's no signup flow — pick a role and a name on the landing screen and
it's remembered in this browser:

- **Resident (customer)** — browse the live flash-sale feed, claim a bundle,
  get a ticket-style pickup token, view past claims under "My pickups".
- **Merchant** — post surplus stock with a claim countdown, watch claims and
  "NGO notified" events arrive live, verify pickup tokens at the counter.
- **NGO partner** — a real-time feed of listings whose countdown hit zero
  with stock still unclaimed, with a one-tap "we'll collect this".

## Build for production

```bash
npm run build
```

Outputs static files to `frontend/dist/` — deploy that folder to any static
host (Netlify, Vercel, S3 + CloudFront, nginx, etc.), pointed at your
deployed backend via `VITE_API_URL` at build time.
