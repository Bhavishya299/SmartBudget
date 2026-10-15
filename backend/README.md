# Budget App - Backend (Express + MySQL)

REST API for the Budget App: authentication, transactions, category budgets,
savings goals, analytics/stats, real-time updates (Socket.IO) and a WhatsApp
webhook for adding transactions by chat.

## Tech Stack

- **Node.js / Express** - HTTP API and routing
- **MySQL** - primary database
- **Sequelize** - ORM (models, associations, queries, aggregations)
- **JWT** - authentication
- **bcrypt** - password hashing
- **Socket.IO** - realtime push to the client
- **Nodemailer** - password-reset emails (optional)

## Database Schema

| Table | Key columns | Notes |
|-------|-------------|-------|
| `users` | `id (uuid)`, `name`, `email (unique)`, `phone (unique)`, `password`, `settings (json)`, `resetPasswordToken`, `resetPasswordExpire` | `settings` stores theme / currency / notifications |
| `transactions` | `id (uuid)`, `userId -> users.id`, `title`, `amount`, `currency`, `type`, `date`, `category`, `description` | `type` is `income` or `expense` |
| `budgets` | `id (uuid)`, `userId -> users.id`, `category`, `limit`, `month` (`YYYY-MM`) | unique per `(userId, category, month)` |
| `goals` | `id (uuid)`, `userId -> users.id`, `title`, `targetAmount`, `currentAmount`, `deadline`, `color` | |

Associations are defined in `models/index.js`. Tables are created automatically
on startup via `sequelize.sync()`, so a fresh database needs no manual SQL.

## Getting Started

```bash
cd backend
npm install
cp .env.example .env   # then edit .env
npm run dev            # nodemon, http://localhost:5000
```

### 1. Configure MySQL

Pick one option below and put it in `.env`.

**Option A - local MySQL (XAMPP / WAMP / phpMyAdmin / MySQL CLI).**

Create the database:

```sql
CREATE DATABASE budget_app;
```

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=budget_app
DB_USER=root
DB_PASSWORD=
DB_SSL=false
```

**Option B - hosted MySQL (PlanetScale, Railway, Clever Cloud, ...).**
Paste the connection string:

```env
DATABASE_URL=mysql://user:password@host:3306/dbname
DB_SSL=true
```

If `DATABASE_URL` is set it wins; otherwise the `DB_*` values are used.

### 2. Other environment variables

See `.env.example` for the full list: `JWT_SECRET`, `GOOGLE_CLIENT_ID`,
`SMTP_*` (optional) and the WhatsApp `WHATSAPP_*` / `PHONE_NUMBER_ID` (optional).

## API Overview

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/users/register` | - | Create account |
| POST | `/api/users/login` | - | Login, returns JWT |
| POST | `/api/users/google` | - | Google sign-in |
| POST | `/api/users/forgot-password` | - | Send reset email |
| PUT | `/api/users/reset-password/:token` | - | Reset password |
| GET | `/api/users/profile` | yes | Current user |
| PUT | `/api/users/profile` | yes | Update name/email/password |
| PUT | `/api/users/settings` | yes | Update theme/currency/etc. |
| POST | `/api/v1/add-transaction` | yes | Add transaction |
| GET | `/api/v1/get-transactions` | yes | List transactions |
| GET | `/api/v1/get-stats` | yes | Balance + prediction |
| DELETE | `/api/v1/delete-transaction/:id` | yes | Delete transaction |
| GET | `/api/stats` | yes | Income/expense/balance |
| GET | `/api/stats/insights` | yes | Category insights |
| GET | `/api/stats/charts` | yes | Monthly chart data |
| GET/POST | `/api/budgets` | yes | List / upsert budgets |
| DELETE | `/api/budgets/:id` | yes | Delete budget |
| GET/POST | `/api/goals` | yes | List / create goals |
| PUT/DELETE | `/api/goals/:id` | yes | Update / delete goal |
| GET/POST | `/webhook` | - | WhatsApp Cloud API |

## Notes

- API responses include both `id` and `_id` (the frontend was written against
  MongoDB's `_id`).
- Money columns are stored as `DECIMAL(15,2)` and returned as JS numbers.
- `reset-password.js` is a small utility to force-reset a user's password in dev:
  `node reset-password.js`.
