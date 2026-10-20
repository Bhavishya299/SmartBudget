# SmartBudget 💰

A full-stack personal budget & expense tracker with Google sign-in, real-time updates, charts,
and a **WhatsApp bot** that lets you log transactions by simply texting.

> Text `100 shopping` to the WhatsApp number → ₹100 is instantly added to your account.

---

## ✨ Features

- 🔐 **Authentication** — email/password (JWT) and Google Sign-In
- 💸 **Transactions** — add, edit, delete income & expenses
- 📊 **Budgets & Goals** — set monthly budgets and savings goals
- 📈 **Dashboard** — charts, insights and spending stats
- ⚡ **Real-time updates** via Socket.IO
- 💬 **WhatsApp logging** — `spent 200 on food`, `received 5000 salary`, `food 200`

---

## ⚡ Realtime Updates

Transactions created anywhere — including via WhatsApp — appear instantly without a refresh.

- The backend authenticates each Socket.IO connection with the same JWT as the REST API and
  joins it to a private room named after the authenticated user's `id`.
- When a transaction is created (REST or WhatsApp), the backend emits `newTransaction` to that room.
- The frontend `SocketProvider` (`src/context/SocketContext.jsx`) connects to `VITE_API_URL`
  (or `http://localhost:5000`), joins the room, and increments a `version` counter.
  Pages (dashboard, transactions, charts, insights, monthly summary, subscriptions, profile)
  refetch whenever `version` changes.
- The socket disconnects on logout and reconnects on login; duplicate events are ignored by id.

## 🧱 Tech Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Frontend  | React + Vite + Tailwind CSS, Chart.js, Socket.IO    |
| Backend   | Node.js + Express                                   |
| Database  | **MySQL** via **Sequelize** ORM                     |
| Auth      | JWT + Google OAuth                                  |
| Realtime  | Socket.IO                                           |
| Messaging | WhatsApp Cloud API (Meta)                           |

---

## 📁 Project Structure

```
SmartBudget/
├── backend/
│   ├── config/         # Sequelize MySQL connection
│   ├── controllers/    # Route logic
│   ├── middleware/     # Auth & error handling
│   ├── models/         # Sequelize models (User, Transaction, Budget, Goal)
│   ├── routes/         # REST routes + WhatsApp webhook
│   ├── server.js       # App entry point
│   ├── reset-password.js
│   └── .env.example
└── frontend/
    ├── src/
    └── .env.example
```

---

## 🚀 Getting Started (local)

### 1. Prerequisites
- Node.js 18+
- MySQL 8 running locally

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit .env
npm run dev
```

Create the database (tables are auto-created by Sequelize on startup):

```sql
CREATE DATABASE budget_app;
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # then edit .env
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

---

## 🔑 Environment Variables

### `backend/.env`
| Variable | Description |
|---|---|
| `PORT` | Server port (default `5000`) |
| `DATABASE_URL` | MySQL URL `mysql://user:pass@host:3306/db` (optional; overrides `DB_*`) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Local MySQL connection |
| `DB_SSL` | `true` for hosted MySQL that requires SSL |
| `JWT_SECRET` | Long random string for signing tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `SMTP_*` | Optional email (password reset) |
| `WHATSAPP_VERIFY_TOKEN` | Any secret string; must match the value in Meta |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API access token |
| `PHONE_NUMBER_ID` | Meta WhatsApp phone number ID |

### `frontend/.env`
| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID |
| `VITE_API_URL` | Backend base URL. Leave empty for local dev (`http://localhost:5000`). Set to your deployed backend in production. |

---

## 💬 WhatsApp Bot Setup

1. Create an app at [developers.facebook.com](https://developers.facebook.com) → add **WhatsApp**.
2. In **API Setup**, copy the **Phone number ID** and an **access token** into `backend/.env`.
3. Choose your own **Verify token**, put it in `WHATSAPP_VERIFY_TOKEN`.
4. Expose the backend publicly over **HTTPS** (e.g. `ngrok http 5000`, or a deployed URL).
5. In **WhatsApp → Configuration → Webhook**, set:
   - Callback URL: `https://<your-public-url>/webhook`
   - Verify token: same value as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.
6. Make sure the phone number on your Budget App profile matches your WhatsApp number.

Supported message formats:
```
100 shopping
spent 200 on food
received 5000 salary
food 200
```

---

## ☁️ Deployment

The repo ships a **`render.yaml`** blueprint so the backend can be deployed in a few clicks.

### 1. Create a free MySQL database (Aiven)
1. Sign up at [aiven.io](https://aiven.io) and create a **MySQL** service (free plan).
2. Wait for it to start, then copy the **Service URI**:
   ```
   mysql://avnadmin:PASSWORD@mysql-xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED
   ```
3. Under the service's **Allowed IP addresses**, add `0.0.0.0/0` (Render uses dynamic IPs).

### 2. Deploy the backend (Render)
1. Render Dashboard → **New → Blueprint** → connect this GitHub repo (`render.yaml`).
2. Fill in the environment variables the blueprint marks as secrets:
   - `DATABASE_URL` → the Aiven Service URI above
   - `GOOGLE_CLIENT_ID`
   - `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`
   - (optional) `SMTP_*`
3. Deploy. Render builds `backend/` and runs `npm start`; tables are auto-created on first boot.
4. Note your URL, e.g. `https://smartbudget-api.onrender.com`.

### 3. Deploy the frontend (Vercel / Netlify)

**Vercel project settings**

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variables (Project → Settings → Environment Variables):

- `VITE_API_URL = https://<your-backend>.onrender.com`
- `VITE_GOOGLE_CLIENT_ID = ...`

**Client-side routing (refresh / direct URLs).**

`frontend/vercel.json` rewrites every unmatched path to `/index.html`, so refreshing
`/dashboard`, opening `/transactions` directly, etc. loads the SPA instead of returning 404.
If the Vercel project's **Root Directory** is the repository root instead of `frontend`, the
root `vercel.json` supplies the same rewrite plus the monorepo install/build/output settings.

The rewrite does **not** touch API traffic: the frontend calls the backend through the absolute
`VITE_API_URL`, so no `/api/*` request is made to the Vercel domain.

After editing `vercel.json` or environment variables, **redeploy** — Vercel does not apply
config changes to existing deployments.

**Verify in production**

1. Open `https://<your-app>.vercel.app/dashboard` directly → the app loads (and redirects to `/`
   when you are not logged in).
2. Refresh that page → same result, no 404.
3. DevTools → Network: the document is `200 text/html`; files under `/assets/*` are `200`
   JavaScript/CSS.
4. API requests go to `https://<your-backend>.onrender.com`, not the Vercel domain.

**Local check**

```bash
cd frontend
npm run build
npm run preview
# open http://localhost:4173/dashboard and refresh
```

`vite preview` applies the same SPA fallback as the Vercel rewrite.

**Netlify** (if used instead): add `frontend/public/_redirects` containing
`/*  /index.html  200` and set the publish directory to `dist`.

### 4. Point Meta's webhook at the backend
- Callback URL: `https://smartbudget-api.onrender.com/webhook`
- Verify token: same as `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the `messages` field.

> Render's **free** web services sleep after ~15 minutes of inactivity. The first WhatsApp
> message after a sleep may be delayed while it wakes up (Meta retries), so for a
> production-grade bot consider a paid instance.

---

## 📜 Scripts

| Location  | Command | Description |
|-----------|---------|-------------|
| backend   | `npm run dev` | Start with nodemon |
| backend   | `npm start`   | Start in production |
| frontend  | `npm run dev` | Vite dev server |
| frontend  | `npm run build` | Production build |
