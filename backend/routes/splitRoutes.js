const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { Split, SplitShare, Person, SplitGroup, Transaction, SplitItem } = require("../models");
const { protect } = require("../middleware/authMiddleware");
const { buildSplit, round2 } = require("../utils/splitMath");
const { calculateItemWiseSplit } = require("../utils/itemSplit");

/** List all flatmates */
router.get("/people", protect, async (req, res) => {
  try {
    const people = await Person.findAll({
      where: { userId: req.user.id },
      order: [["archived", "ASC"], ["name", "ASC"]],
    });
    res.json(people);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Add a flatmate */
router.post("/people", protect, async (req, res) => {
  try {
    const { name, phone, color } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const person = await Person.create({
      name: String(name).trim(),
      phone: phone ? String(phone).replace(/\D/g, "") || null : null,
      color: color || "#6366f1",
      userId: req.user.id,
    });
    res.status(201).json(person);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Update a flatmate */
router.put("/people/:id", protect, async (req, res) => {
  try {
    const person = await Person.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!person) return res.status(404).json({ message: "Person not found" });
    const { name, phone, color, archived } = req.body;
    if (name !== undefined) person.name = String(name).trim();
    if (phone !== undefined) person.phone = phone ? String(phone).replace(/\D/g, "") || null : null;
    if (color !== undefined) person.color = color;
    if (archived !== undefined) person.archived = Boolean(archived);
    await person.save();
    res.json(person);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Delete a flatmate */
router.delete("/people/:id", protect, async (req, res) => {
  try {
    const deleted = await Person.destroy({ where: { id: req.params.id, userId: req.user.id } });
    if (!deleted) return res.status(404).json({ message: "Person not found" });
    res.json({ message: "Person deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** List groups */
router.get("/groups", protect, async (req, res) => {
  try {
    const groups = await SplitGroup.findAll({ where: { userId: req.user.id }, order: [["name", "ASC"]] });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Create group */
router.post("/groups", protect, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: "Name is required" });
    const group = await SplitGroup.create({ name: String(name).trim(), memberIds: Array.isArray(memberIds) ? memberIds : [], userId: req.user.id });
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Update group */
router.put("/groups/:id", protect, async (req, res) => {
  try {
    const group = await SplitGroup.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (req.body.name !== undefined) group.name = String(req.body.name).trim();
    if (req.body.memberIds !== undefined) group.memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Delete group */
router.delete("/groups/:id", protect, async (req, res) => {
  try {
    const deleted = await SplitGroup.destroy({ where: { id: req.params.id, userId: req.user.id } });
    if (!deleted) return res.status(404).json({ message: "Group not found" });
    res.json({ message: "Group deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** List all splits with their shares and items. */
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
        {
          model: SplitItem,
          as: "items",
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
 * Supports two modes:
 * - equal: divide whole bill evenly across splitCount people (legacy behavior)
 * - items: item-wise split where each item can go to all / specific people / just one person
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
      splitType = "equal", // "equal" | "items"
      items = [],
    } = req.body;

    const total = Number(amount);
    const parts = Math.max(1, Math.floor(Number(splitCount) || 1));

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!total || total <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    let myShare, shares, splitCountActual = parts;

    if (splitType === "items" && Array.isArray(items) && items.length > 0) {
      // Item-wise calculation
      const othersArr = Array.isArray(others) ? others : [];
      const peopleForCalc = othersArr.map((o) => ({
        id: o.personId || o.id || o.name,
        name: o.name,
      }));

      const result = calculateItemWiseSplit({
        items,
        people: peopleForCalc,
        userId: req.user.id,
      });

      myShare = result.myShare;
      shares = result.shares;

      // For display, splitCount can be 1 + number of people who owe or all people
      splitCountActual = 1 + (Array.isArray(others) ? others.length : 0) || 1;
    } else {
      // Legacy equal split
      if (parts > 20) {
        return res.status(400).json({ message: "Split count too large" });
      }
      const result = buildSplit({
        amount: total,
        splitCount: parts,
        others: Array.isArray(others) ? others.map((o) => o?.name || o).filter(Boolean) : [],
      });
      myShare = result.myShare;
      shares = result.shares.map((s, idx) => ({
        ...s,
        personId: (others[idx] && (others[idx].personId || others[idx].id)) || null,
      }));
      splitCountActual = parts;
    }

    let transactionId = null;

    // Log your share as a real transaction so it counts in budgets/charts.
    if (alsoAddToTransactions && myShare > 0) {
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
      splitCount: splitCountActual,
      source,
      category,
      date: date ? new Date(date) : new Date(),
      receiptUrl: receiptUrl || null,
      notes: notes ? String(notes).trim().slice(0, 200) : null,
      transactionId,
      userId: req.user.id,
    });

    // Save items if item-wise
    if (splitType === "items" && Array.isArray(items) && items.length > 0) {
      const itemRows = items.map((it) => ({
        name: String(it.name || "").trim(),
        amount: Number(it.amount || 0),
        splitMode: it.splitMode || "all",
        participantIds: it.participantIds || [],
        paidByOnlyId: it.paidByOnlyId || null,
        splitId: split.id,
        userId: req.user.id,
      }));
      await SplitItem.bulkCreate(itemRows);
    }

    // Create a share record for each person who owes you.
    const othersArr = Array.isArray(others) ? others : [];
    const shareRows = [];

    for (let i = 0; i < shares.length; i++) {
      const s = shares[i];
      // Find matching person from othersArr by personId or name
      const o = othersArr.find((x) => (x.personId === s.personId) || (x.name === s.name)) || {};
      shareRows.push({
        amount: s.amount,
        personName: o.name || s.name,
        personId: o.personId || s.personId || null,
        splitId: split.id,
        userId: req.user.id,
        settled: false,
      });
    }

    if (shareRows.length > 0) {
      await SplitShare.bulkCreate(shareRows);
    }

    const created = await Split.findByPk(split.id, {
      include: [
        { model: SplitShare, as: "shares" },
        { model: SplitItem, as: "items" },
      ],
    });

    // Push to UI if possible (matches the pattern used everywhere else).
    const io = req.app.get("io");
    if (io) {
      io.to(String(req.user.id)).emit("splitCreated", created);
    }

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
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
