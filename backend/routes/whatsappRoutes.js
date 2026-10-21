const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { parseMessage } = require("../utils/whatsappParser");
const axios = require("axios");

// =============================
// 🔹 VERIFY WEBHOOK
// =============================
router.get("/", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔎 Webhook verify attempt:", {
  mode,
  tokenReceived: Boolean(token),
  tokenConfigured: Boolean(VERIFY_TOKEN)
});

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verification failed. WHATSAPP_VERIFY_TOKEN in .env must exactly match the token in Meta.");
  return res.sendStatus(403);
});

// =============================
// 🔹 RECEIVE MESSAGE
// Acknowledge immediately (Meta requires a fast 200), then process.
// =============================
router.post("/", (req, res) => {
  res.sendStatus(200);

  handleIncoming(req).catch((err) => {
    console.error("❌ WhatsApp handler error:", err.message);
  });
});

async function handleIncoming(req) {
  const io = req.app.get("io");

  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (value?.metadata?.phone_number_id) {
    console.log(
      "📇 Webhook phone_number_id:",
      value.metadata.phone_number_id,
      "| configured:",
      process.env.PHONE_NUMBER_ID || "(empty)"
    );
  }

  if (!message || message.type !== "text") {
    return; // ignore statuses / non-text
  }
  const text = (message.text?.body || "").trim().toLowerCase();

  // 🔥 DUPLICATE PREVENTION
  global.processedMessages = global.processedMessages || new Set();
  if (global.processedMessages.has(message.id)) return;
  global.processedMessages.add(message.id);

 const phoneRaw = String(message.from || "").replace(/\D/g, "");
const last10 = phoneRaw.slice(-10);

if (last10.length !== 10) {
  console.log("❌ Invalid WhatsApp sender number");
  return;
}

const orConditions = [
  { phone: phoneRaw },
  { phone: `+${phoneRaw}` },
  { phone: { [Op.like]: `%${last10}` } }
];

const user = await User.findOne({
  where: { [Op.or]: orConditions }
});

  if (!user) {
    console.log(
      "❌ No user linked to",
      phoneRaw,
      "(last10:",
      last10 + "). The phone saved on your profile must match this WhatsApp number."
    );
    await sendReply(
      phoneRaw,
      "❌ This WhatsApp number isn't linked to a Budget App account.\n\nOpen the app, set your profile phone number to this number, then try again."
    );
    return;
  }

  // =============================
  // 🔥 SMART PARSER
  // Delegated to utils/whatsappParser.js so the rules stay testable.
  // Handles "300 on starbucks" -> Food, "24 on printing" -> Personal, etc.
  // =============================
  const parsed = parseMessage(text);

  if (!parsed.ok) {
    await sendReply(
      phoneRaw,
      `❌ Couldn't understand that.

Include an amount and what you spent it on, for example:
💸 300 on starbucks
💸 spent 24 on printing
💸 500 uber
💰 45000 salary credited

Tip: add a date like "yesterday" or "24 oct" to backdate it.`
    );
    return;
  }

  const { amount, category, type, title, description, date } = parsed;

  // =============================
  // 💾 SAVE TRANSACTION
  // =============================
  const transaction = await Transaction.create({
    title,
    amount,
    category,
    description,
    date,
    type,
    userId: user.id
  });

  console.log("💾 Saved transaction:", transaction.id, "for user", user.id);

  // =============================
  // 🔴 SOCKET UPDATE
  // =============================
  if (io) {
    io.to(user.id.toString()).emit("newTransaction", {
      _id: transaction.id,
      id: transaction.id,
      title,
      amount,
      category,
      type,
      date: transaction.date
    });
  }

  // =============================
  // 📤 SEND REPLY
  // =============================
  const dateLabel = new Date(date).toDateString();
  await sendReply(
    phoneRaw,
    `✅ ${type === "income" ? "Income" : "Expense"} added

₹${amount} → ${category}
📝 ${title}
📅 ${dateLabel}`
  );
}

// =============================
// 🔹 SEND WHATSAPP REPLY
// =============================
async function sendReply(to, message) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.warn("⚠️ Cannot send reply: WHATSAPP_TOKEN / PHONE_NUMBER_ID missing in .env");
    return;
  }

  try {
    console.log("📤 Sending reply to", to, "...");

    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Reply sent:", res.data?.messages?.[0]?.id);
  } catch (err) {
    console.error("❌ Reply error:", JSON.stringify(err.response?.data || err.message, null, 2));
  }
}

module.exports = router;
