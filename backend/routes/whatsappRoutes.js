const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
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
  // =============================
  let amount = 0;
  let category = "general";
  let type = "expense";

  const clean = text.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const words = clean.split(/\s+/);

  const numMatch = clean.match(/\d+/);
  if (numMatch) amount = parseInt(numMatch[0]);

  const incomeKeywords = [
    "salary", "income", "received", "got", "earned", "bonus", "credit", "credited"
  ];

  const expenseKeywords = [
    "spent", "pay", "paid", "debit", "buy", "bought"
  ];

  if (incomeKeywords.some(k => clean.includes(k))) {
    type = "income";
  } else if (expenseKeywords.some(k => clean.includes(k))) {
    type = "expense";
  } else {
    type = "expense"; // default
  }

  const ignoreWords = [
    "spent", "on", "for", "received", "got", "earned", "paid", "pay", "from"
  ];

  const possible = words.filter(w => isNaN(w) && !ignoreWords.includes(w));

  if (possible.length > 0) {
    category = possible[possible.length - 1];
  }

  // 🔥 fallback: "food 200"
  if (words.length === 2 && !isNaN(words[1])) {
    category = words[0];
    amount = parseInt(words[1]);
    type = incomeKeywords.includes(words[0]) ? "income" : "expense";
  }

  // =============================
  // ❌ INVALID CASE
  // =============================
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    await sendReply(
      phoneRaw,
      `❌ Couldn't understand.

Try:
💸 Spent 200 on food
💰 Received 5000 salary
🍔 food 200`
    );
    return;
  }

  // =============================
  // 💾 SAVE TRANSACTION
  // =============================
  const transaction = await Transaction.create({
    title: category,
    amount,
    category,
    description: "WhatsApp entry",
    date: new Date(),
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
      amount,
      category,
      type
    });
  }

  // =============================
  // 📤 SEND REPLY
  // =============================
  await sendReply(
    phoneRaw,
    `✅ ${type === "income" ? "Income" : "Expense"} added

₹${amount} → ${category}`
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
