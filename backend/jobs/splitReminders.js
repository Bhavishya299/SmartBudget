const cron = require("node-cron");
const { Op } = require("sequelize");
const { SplitShare, Split, User } = require("../models");
const axios = require("axios");

async function sendReplyDirect(to, message) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.warn("⚠️  [split-reminders] Cannot send: WHATSAPP_TOKEN / PHONE_NUMBER_ID missing");
    return false;
  }
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (err) {
    console.error("❌ [split-reminders] send error:", err.response?.data?.error?.message || err.message);
    return false;
  }
}

function phoneForUser(user) {
  const p = String(user.phone || "").replace(/\D/g, "");
  return p.length >= 10 ? p : null;
}

/**
 * Daily reminder job.
 *
 * Finds unsettled split shares older than `daysPending` (default 3), sends a
 * single digest WhatsApp message to the account owner listing who owes how
 * much, marks `lastRemindedAt` so we don't spam every day once reminded.
 */
async function runSplitReminders(daysPending = 3) {
  const cutoff = new Date(Date.now() - daysPending * 24 * 60 * 60 * 1000);

  try {
    // Get unsettled shares that haven't been reminded yet (or never)
    const shares = await SplitShare.findAll({
      where: {
        settled: false,
        [Op.or]: [
          { lastRemindedAt: null },
          { lastRemindedAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
      include: [
        { model: Split, as: "split", required: true, where: { createdAt: { [Op.lt]: cutoff } } },
        { model: User, as: "user", required: true },
      ],
    });

    if (shares.length === 0) return;

    // Group by user
    const byUser = {};
    for (const s of shares) {
      const uid = s.userId;
      if (!byUser[uid]) byUser[uid] = { user: s.user, items: [] };
      byUser[uid].items.push(s);
    }

    for (const [uid, bucket] of Object.entries(byUser)) {
      const phone = phoneForUser(bucket.user);
      if (!phone) continue;

      // Aggregate per person
      const perPerson = {};
      for (const s of bucket.items) {
        const key = s.personName;
        perPerson[key] = (perPerson[key] || 0) + Number(s.amount || 0);
      }

      const lines = Object.entries(perPerson)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amt]) => `• ${name}: ₹${amt.toFixed(2)}`)
        .join("\n");

      const msg = `⏰ Money pending (Split expenses)

${lines}

Total: ₹${bucket.items.reduce((a, b) => a + Number(b.amount), 0).toFixed(2)}

Open SmartBudget → Splits to mark received when they pay you.`;

      const sent = await sendReplyDirect(phone, msg);
      if (sent) {
        const ids = bucket.items.map((s) => s.id);
        await SplitShare.update({ lastRemindedAt: new Date() }, { where: { id: ids } });
      }
    }

    console.log(`✅ [split-reminders] Processed reminders for ${Object.keys(byUser).length} user(s)`);
  } catch (err) {
    console.error("❌ [split-reminders] Error:", err.message);
  }
}

function startSplitReminders() {
  const days = Number(process.env.SPLIT_REMINDER_DAYS) || 3;
  // Run every day at 09:00 IST is not strictly possible with cron in UTC, so
  // run at 03:30 UTC (~09:00 IST) as a sensible default.
  cron.schedule("30 3 * * *", () => runSplitReminders(days), { timezone: "UTC" });
  console.log(`⏰ Split reminders scheduled (daily ~03:30 UTC, pending >= ${days} days)`);
}

module.exports = { startSplitReminders, runSplitReminders };
