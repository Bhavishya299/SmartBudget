const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { sequelize, Sequelize } = require('./models');
const { errorHandler } = require('./middleware/errorMiddleware');

// 🔥 ADD THESE 2 LINES
const http = require("http");
const { Server } = require("socket.io");

// Import Routes
const transactionRoutes = require('./routes/transactionRoutes');
const userRoutes = require('./routes/userRoutes');
const statsRoutes = require('./routes/statsRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const goalRoutes = require('./routes/goalRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();

// --- CORS -------------------------------------------------------------------
// Comma-separated list of browser origins allowed to call the API / open sockets.
// Leave unset (or "*") to allow every origin — the default, backwards compatible.
// Production example:
//   CORS_ORIGIN=https://smartbudget.vercel.app,http://localhost:5173
// Wildcards are supported, e.g. https://*.vercel.app
const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

function isOriginAllowed(origin) {
    // No Origin header: curl, Meta webhooks, server-to-server calls.
    if (!origin) return true;
    if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) return true;

    return allowedOrigins.some((allowed) => {
        if (allowed === origin) return true;
        if (!allowed.includes("*")) return false;

        const pattern = allowed
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*");
        return new RegExp(`^${pattern}$`).test(origin);
    });
}

const corsOptions = {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

// 🔥 ADD THIS (create server + socket)
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// Authenticate every socket with the same JWT used by the REST API.
// The room a client may join is derived from the token, never trusted from input.
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // allow connection; it just won't receive private events

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded?.id ? String(decoded.id) : null;
    } catch (_) {
        // Invalid/expired token: connect anonymously rather than hanging.
        socket.userId = null;
    }
    next();
});


// ✅ ADD THIS LINE HERE
app.set("io", io);

// 🔥 MAKE SOCKET AVAILABLE EVERYWHERE
io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    // Auto-join the authenticated user's room.
    if (socket.userId) {
        socket.join(socket.userId);
        console.log("👤 User joined room:", socket.userId);
    }

    // Backwards-compatible explicit join, restricted to the authenticated user.
    socket.on("join", (userId) => {
        const requested = userId ? String(userId) : null;
        if (!requested || !socket.userId || requested !== socket.userId) {
            return;
        }
        socket.join(requested);
        console.log("👤 User re-joined room:", requested);
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// --- 1. Middlewares ---
app.use(express.json()); 
app.use(cors(corsOptions)); 

// --- 2. Routes ---
app.use('/api/users', userRoutes);
app.use('/api/v1', transactionRoutes);
app.use('/api/stats', statsRoutes); 
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);

// ✅ WhatsApp webhook
app.use('/webhook', whatsappRoutes);

// --- 3. Health check (used by Render) ---
app.get("/", (req, res) => res.status(200).send("SmartBudget API is running ✅"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// --- 4. Error handler (must be after routes) ---
app.use(errorHandler);

// --- 4. Database Connection & Server Start ---
const PORT = process.env.PORT || 5000;

/**
 * Add columns introduced after the first deploy.
 *
 * `sequelize.sync()` only creates missing *tables*; it never adds columns to
 * an existing one. Rather than `alter: true` (which can rewrite unrelated
 * tables), we check the live schema and add only what is missing.
 */
async function runMigrations() {
    const qi = sequelize.getQueryInterface();

    const columns = await qi.describeTable("transactions").catch(() => null);
    if (columns && !columns.paymentMethod) {
        await qi.addColumn("transactions", "paymentMethod", {
            type: Sequelize.DataTypes.STRING,
            allowNull: false,
            defaultValue: "unspecified",
        });
        console.log("🛠️  Added column transactions.paymentMethod");
    }
}

sequelize
    .authenticate()
    .then(() => sequelize.sync()) // creates tables if they don't exist yet
    .then(() => runMigrations())
    .then(() => {
        // 🔥 CHANGE THIS LINE (use server instead of app)
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log('✅ MySQL Connected Successfully');
        });
    })
    .catch(err => {
        console.error('❌ MySQL Connection Error:', err.message);
        process.exit(1);
    });