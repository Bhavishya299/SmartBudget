const { Op } = require("sequelize");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// ================= REGISTER =================
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // ✅ STRICT VALIDATION
        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (typeof password !== "string" || password.length < 4) {
            return res.status(400).json({ message: "Password must be at least 4 characters" });
        }

        const cleanEmail = email.trim().toLowerCase();

        const userExists = await User.findOne({ where: { email: cleanEmail } });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }

        // 🔐 HASH PASSWORD (SAFE)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 🔥 SAVE USER
        const user = await User.create({
            name,
            email: cleanEmail,
            password: hashedPassword,
            phone
        });

        console.log("✅ USER SAVED:", user.email);

        res.status(201).json({
            message: "User registered successfully"
        });

    } catch (error) {
        console.error("❌ REGISTER ERROR:", error.message);
        if (error.name === "SequelizeUniqueConstraintError") {
            return res.status(400).json({ message: "Email or phone already in use" });
        }
        res.status(500).json({ message: error.message });
    }
};


// ================= LOGIN =================

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email & password required" });
        }

        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({ where: { email: cleanEmail } });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error.message);
        res.status(500).json({ message: error.message });
    }
};
// ================= GOOGLE AUTH =================
exports.googleAuth = async (req, res) => {
    try {
        const credential = req.body.credential || req.body.token;

        if (!credential) {
            return res.status(400).json({ message: "No credential received" });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            return res.status(400).json({ message: "Invalid Google token" });
        }

        const email = payload.email.toLowerCase();
        const name = payload.name;

        let user = await User.findOne({ where: { email } });

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            user = await User.create({
                name,
                email,
                password: hashedPassword,
                phone: "0000000000" // 🔥 dummy phone to bypass validation
            });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("🔥 GOOGLE AUTH ERROR:", error.message);
        res.status(500).json({ message: error.message });
    }
};

// ================= PROFILE =================
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ================= UPDATE PROFILE =================
exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        if (req.body.name) user.name = req.body.name;
        if (req.body.email) user.email = req.body.email;

        if (req.body.password) {
            user.password = await bcrypt.hash(req.body.password, 10);
        }

        await user.save();

        res.json({
            id: user.id,
            name: user.name,
            email: user.email
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ================= SETTINGS =================
exports.updateSettings = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });

        user.settings = { ...(user.settings || {}), ...(req.body.settings || {}) };
        user.changed("settings", true);

        await user.save();

        res.json({ message: "Settings updated", settings: user.settings });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
    try {
        const email = req.body.email?.trim()?.toLowerCase();

        if (!email) {
            return res.status(400).json({ message: "Email required" });
        }

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: "No user found" });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');

        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);

        await user.save();

        const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

        await sendEmail({
            email: user.email,
            subject: 'Password Reset',
            message: `Reset your password:\n${resetUrl}`
        });

        res.json({ message: 'Email sent' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            where: {
                resetPasswordToken,
                resetPasswordExpire: { [Op.gt]: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        user.password = await bcrypt.hash(req.body.password, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpire = null;

        await user.save();

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
