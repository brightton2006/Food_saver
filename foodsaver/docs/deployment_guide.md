# FoodSaver Direct Connect - Deployment & Operations Guide

> [!TIP]
> This guide outlines the step-by-step procedure for deploying FoodSaver Direct Connect to production environments.

---

## 1. Stack & Infrastructure Overview

- **Frontend**: React + Vite (Deploy on **Vercel** or **Netlify**)
- **Backend API & Realtime Engine**: Node.js + Express + Socket.IO (Deploy on **Render** or **Railway**)
- **Database**: Managed MySQL 8.x (e.g., **Aiven**, **PlanetScale**, **AWS RDS**, or **Railway MySQL**)

---

## 2. Managed MySQL Database Setup

1. Provision a MySQL 8.0 instance on your cloud provider (Aiven, Railway, or AWS RDS).
2. Set the connection environment variables:
   ```env
   DB_HOST=your-mysql-host.cloud.com
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_secure_password
   DB_NAME=foodsaver_db
   ```
3. Run schema initialization & migration:
   ```bash
   cd backend
   node src/database/initDb.js
   node src/database/migrations/v2_production_upgrade.js
   ```

---

## 3. Backend Deployment (Render / Railway)

1. Connect your repository to Render or Railway.
2. Set Build Command: `npm install`
3. Set Start Command: `node server.js`
4. Set Environment Variables:
   ```env
   PORT=4000
   NODE_ENV=production
   JWT_SECRET=your_super_secret_jwt_key_2026
   DB_HOST=...
   DB_PORT=3306
   DB_USER=...
   DB_PASSWORD=...
   DB_NAME=...
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   ```

---

## 4. Frontend Deployment (Vercel / Netlify)

1. Connect your repository to Vercel or Netlify.
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`
4. Set Environment Variables:
   ```env
   VITE_API_URL=https://your-backend-service.onrender.com
   ```
5. Enable HTTPS and test service worker registration at `https://your-app-domain.vercel.app`.
