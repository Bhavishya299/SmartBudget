const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { sequelize } = require('./models');
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

// 🔥 ADD THIS (create server + socket)
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});


// ✅ ADD THIS LINE HERE
app.set("io", io);

// 🔥 MAKE SOCKET AVAILABLE EVERYWHERE
io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    // 🔥 USER JOINS THEIR OWN ROOM
    socket.on("join", (userId) => {
        console.log("👤 User joined room:", userId);
        socket.join(userId);
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// --- 1. Middlewares ---
app.use(express.json()); 
app.use(cors()); 

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

sequelize
    .authenticate()
    .then(() => sequelize.sync()) // creates tables if they don't exist yet
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