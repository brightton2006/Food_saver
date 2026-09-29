# Food Saver — Backend

Express + Socket.io realtime API. Data lives in memory (see `src/data/store.js`),
so it resets whenever the server restarts — swap that one file for a real
database later without touching routes or sockets.

## Run it

```bash
cd backend
npm install
npm start
```

Server starts on **http://localhost:4000**. Health check: `GET /api/health`.

## What it does

- Every 3 seconds it sweeps all listings; when a listing's closing-window
  countdown hits zero **and stock is still left**, the listing flips to
  `expired_donatable` and an alert is broadcast to nearby NGO partners
  over Socket.io (`ngo:notification`) — this is the "counter time closed →
  notify NGO" behaviour.
- Claims decrement stock atomically server-side and broadcast to every
  connected client (`listing:updated`), so the web app and any mobile
  client always see the same numbers.

## REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/listings` | Active flash-sale feed |
| GET | `/api/listings/all` | Every listing (any status) |
| GET | `/api/listings/merchant/:merchantName` | One merchant's listings |
| POST | `/api/listings` | Post new surplus stock |
| POST | `/api/listings/:id/claim` | Customer claims a bundle → returns pickup token |
| GET | `/api/claims/merchant/:merchantName` | Merchant's collection queue |
| GET | `/api/claims/:token` | Look up a pickup token at the counter |
| POST | `/api/claims/:token/collect` | Mark a token as collected |
| GET | `/api/ngo/partners` | Seeded NGO directory |
| GET | `/api/ngo/notifications` | All rescue alerts |
| POST | `/api/ngo/notifications/:id/acknowledge` | NGO claims a rescue |

## Socket.io events (server → client)

`sync:snapshot`, `listing:created`, `listing:updated`, `claim:created`,
`claim:collected`, `ngo:notification`, `ngo:acknowledged`
