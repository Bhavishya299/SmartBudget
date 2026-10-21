const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { Split, SplitShare, Person, Transaction } = require("../models");
const { protect } = require("../middleware/authMiddleware");
const { buildSplit, round2 } = require("../utils/splitMath");

/** List all splits with their shares. */
router.get("/", protect, async (req, res) => {
  try {
    const splits = await Split.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: SplitShare,
          as: "shares",
          required: false,
        },
      ],
      order: [
        ["date", "DESC"],
        ["createdAt", "DESC"],
      ],
    });
    res.json(splits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Summary of what is still owed to you. */
router.get("/summary", protect, async (req, res) => {
  try {
    const shares = await SplitShare.findAll({
      where: { userId: req.user.id, settled: false },
      include: [{ model: Split, as: "split", required: true }],
    });

    let totalOwed = 0;
    const byPerson = {};
    const items = [];

    for (const share of shares) {
      const amt = Number(share.amount || 0);
      totalOwed += amt;

      const key = share.personId || share.personName;
      if (!byPerson[key]) {
        byPerson[key] = {
          personId: share.personId,
          personName: share.personName,
          amount: 0,
          count: 0,
        };
      }
      byPerson[key].amount = round2(byPerson[key].amount + amt);
      byPerson[key].count += 1;

      items.push({
        shareId: share.id,
        personName: share.personName,
        personId: share.personId,
        amount: amt,
        title: share.split?.title,
        source: share.split?.source,
        date: share.split?.date,
        splitId: share.splitId,
        settled: false,
      });
    }

    // Sort largest first so you know who to remind first.
    items.sort((a, b) => b.amount - a.amount);

    res.json({
      totalOwed: round2(totalOwed),
      byPerson: Object.values(byPerson).sort((a, b) => b.amount - a.amount),
      items,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Create a split expense.
 *
 * - Divides the bill evenly across splitCount people (you + others).
 * - Creates a Split row and one SplitShare row per other person.
 * - Optionally creates a Transaction for *your share* so it shows up in your
 *   normal spending (same pattern as a regular expense).
 */
router.post("/", protect, async (req, res) => {
  try {
    const {
      title,
      amount,
      splitCount = 2,
      others = [],
      source = "offline",
      category = "Other",
      date,
      receiptUrl,
      notes,
      alsoAddToTransactions = true,
      paymentMethod,
    } = req.body;

    const total = Number(amount);
    const parts = Math.max(1, Math.floor(Number(splitCount) || 1));

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!total || total <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    if (parts > 20) {
      return res.status(400).json({ message: "Split count too large" });
    }

    const { myShare, shares } = buildSplit({
      amount: total,
      splitCount: parts,
      others: Array.isArray(others) ? others.map((o) => o?.name || o).filter(Boolean) : [],
    });

    let transactionId = null;

    // Log your share as a real transaction so it counts in budgets/charts.
    if (alsoAddToTransactions) {
      const tx = await Transaction.create({
        title: `Split: ${String(title).trim()}`,
        amount: myShare,
        category,
        description: notes ? String(notes).trim().slice(0, 100) : "Split expense",
        date: date ? new Date(date) : new Date(),
        type: "expense",
        paymentMethod: paymentMethod || "unspecified",
        userId: req.user.id,
      });
      transactionId = tx.id;
    }

    const split = await Split.create({
      title: String(title).trim(),
      amount: total,
      myShare,
      splitCount: parts,
      source,
      category,
      date: date ? new Date(date) : new Date(),
      receiptUrl: receiptUrl || null,
      notes: notes ? String(notes).trim().slice(0, 200) : null,
      transactionId,
      userId: req.user.id,
    });

    // Create a share record for each person who owes you.
    const othersArr = Array.isArray(others) ? others : [];
    const shareRows = [];

    for (let i = 0; i < shares.length; i++) {
      const s = shares[i];
      const o = othersArr[i] || {};
      shareRows.push({
        amount: s.amount,
        personName: o.name || s.name,
        personId: o.personId || null,
        splitId: split.id,
        userId: req.user.id,
        settled: false,
      });
    }

    if (shareRows.length > 0) {
      await SplitShare.bulkCreate(shareRows);
    }

    const created = await Split.findByPk(split.id, {
      include: [{ model: SplitShare, as: "shares" }],
    });

    // Push to UI if possible (matches the pattern used everywhere else).
    const io = req.app.get("io");
    if (io) {
      io.to(String(req.user.id)).emit("splitCreated", created);
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Mark a share as received / settled. */
router.patch("/shares/:id/settle", protect, async (req, res) => {
  try {
    const share = await SplitShare.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!share) return res.status(404).json({ message: "Share not found" });

    const { settled = true, settledMethod = "unspecified" } = req.body;

    share.settled = Boolean(settled);
    if (share.settled) {
      share.settledAt = new Date();
      share.settledMethod = settledMethod;
    } else {
      share.settledAt = null;
      share.settledMethod = null;
    }

    await share.save();
    res.json(share);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Delete a split and all its shares. */
router.delete("/:id", protect, async (req, res) => {
  try {
    const split = await Split.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!split) return res.status(404).json({ message: "Split not found" });

    // Shares are deleted by onDelete: CASCADE on the association, but be
    // defensive just in case.
    await SplitShare.destroy({ where: { splitId: split.id, userId: req.user.id } });
    await split.destroy();

    res.json({ message: "Split deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
