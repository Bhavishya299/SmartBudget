const Transaction = require("../models/Transaction");

// 1. Add Transaction (Smart & User-Linked)
exports.addTransaction = async (req, res) => {
    const { title, amount, category, description, date, type, currency } = req.body;

    try {
        if (!title || !category || !description || !date || !amount) {
            return res.status(400).json({ message: 'All fields are required!' });
        }
        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number!' });
        }

        const transaction = await Transaction.create({
            title,
            amount,
            category,
            description,
            date,
            type,
            currency: currency || "INR",
            userId: req.user.id
        });

        // Push the new transaction to every open tab for this user.
        const io = req.app.get("io");
        if (io) {
            io.to(String(req.user.id)).emit("newTransaction", {
                _id: transaction.id,
                id: transaction.id,
                title: transaction.title,
                amount: transaction.amount,
                category: transaction.category,
                type: transaction.type,
                date: transaction.date
            });
        }

        res.status(201).json({ message: 'Transaction Added Successfully', transaction });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// 2. Get Transactions (only the logged-in user's data)
exports.getTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// 3. Delete Transaction
exports.deleteTransaction = async (req, res) => {
    const { id } = req.params;

    try {
        const transaction = await Transaction.findOne({
            where: { id, userId: req.user.id }
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        await transaction.destroy();

        res.status(200).json({ message: 'Transaction Deleted' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// 4. Get Smart Stats & Predictions
exports.getStats = async (req, res) => {
    try {
        const transactions = await Transaction.findAll({ where: { userId: req.user.id } });

        let totalIncome = 0;
        let totalExpenses = 0;

        transactions.forEach((t) => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpenses += t.amount;
        });

        const totalBalance = totalIncome - totalExpenses;

        // --- SMART PREDICTION ---
        const firstTx = await Transaction.findOne({
            where: { userId: req.user.id },
            order: [['date', 'ASC']]
        });

        const today = new Date();
        const startDate = firstTx ? new Date(firstTx.date) : today;

        const diffInMs = Math.abs(today - startDate);
        const daysActive = Math.max(1, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));

        const dailyAvg = totalExpenses / daysActive;

        let daysLeft =
            totalBalance > 0 && dailyAvg > 0
                ? Math.floor(totalBalance / dailyAvg)
                : 0;

        res.status(200).json({
            totalBalance,
            totalIncome,
            totalExpenses,
            prediction: {
                dailyAverage: dailyAvg.toFixed(2),
                estimatedDaysRemaining: daysLeft > 365 ? "365+" : daysLeft,
                status: daysLeft < 7 ? "Critical: Low Balance" : "Stable"
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};
