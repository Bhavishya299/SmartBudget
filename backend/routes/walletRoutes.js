const express = require("express");
const router = express.Router();
const { Wallet } = require("../models");
const { protect } = require("../middleware/authMiddleware");

/** Get or create wallet */
router.get("/", protect, async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id, cashBalance: 0, bankBalance: 0 });
    }
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Set/update cash and bank balances (manual top-up/reset) */
router.put("/", protect, async (req, res) => {
  try {
    const { cashBalance, bankBalance } = req.body;
    let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id });
    }

    if (cashBalance !== undefined) wallet.cashBalance = Number(cashBalance) || 0;
    if (bankBalance !== undefined) wallet.bankBalance = Number(bankBalance) || 0;

    await wallet.save();
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
