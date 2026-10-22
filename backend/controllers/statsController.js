const { fn, col } = require("sequelize");
const Transaction = require("../models/Transaction");

const getStats = async (req, res) => {
    try {
        const rows = await Transaction.findAll({
            attributes: ["type", [fn("SUM", col("amount")), "total"]],
            where: { userId: req.user.id },
            group: ["type"],
            raw: true
        });

        const totalIncome = parseFloat(rows.find(r => r.type === "income")?.total) || 0;
        const totalExpense = parseFloat(rows.find(r => r.type === "expense")?.total) || 0;

        const totalBalance = totalIncome - totalExpense;
        res.status(200).json({
            totalIncome,
            totalExpense,
            totalExpenses: totalExpense,
            balance: totalBalance,
            totalBalance
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getStats };
