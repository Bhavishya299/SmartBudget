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

**Backend (Render / Railway / Fly.io)**
- Build: `npm install` · Start: `npm start`
- Set all `backend/.env` variables in the host's dashboard.
- Point it at a MySQL database (Render does not offer MySQL — use Aiven, Clever Cloud,
  Railway, TiDB Cloud, or a self-hosted MySQL) via `DATABASE_URL` + `DB_SSL=true`.

**Frontend (Vercel / Netlify)**
- Build: `npm run build` · Output: `dist`
- Set `VITE_GOOGLE_CLIENT_ID` (and the API base URL if it differs) in the dashboard.

---

## 📜 Scripts

| Location  | Command | Description |
|-----------|---------|-------------|
| backend   | `npm run dev` | Start with nodemon |
| backend   | `npm start`   | Start in production |
| frontend  | `npm run dev` | Vite dev server |
| frontend  | `npm run build` | Production build |
