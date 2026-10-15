const { fn, col, literal } = require("sequelize");
const Transaction = require("../models/Transaction");

const getInsights = async (req, res) => {
    try {
        const userId = req.user.id;

        // Expense totals grouped by category
        const categoryData = await Transaction.findAll({
            attributes: ["category", [fn("SUM", col("amount")), "total"]],
            where: { userId, type: "expense" },
            group: ["category"],
            order: [[literal("SUM(`amount`)"), "DESC"]],
            raw: true
        });

        // Totals grouped by type (income vs expense)
        const totals = await Transaction.findAll({
            attributes: ["type", [fn("SUM", col("amount")), "total"]],
            where: { userId },
            group: ["type"],
            raw: true
        });

        const income = parseFloat(totals.find(t => t.type === "income")?.total) || 0;
        const expense = parseFloat(totals.find(t => t.type === "expense")?.total) || 0;

        let message = "Your finances look stable!";
        if (expense > income) message = "Warning: You are spending more than you earn!";
        else if (expense > income * 0.8) message = "High Alert: You've spent 80% of your income.";

        res.status(200).json({
            highestCategory: categoryData[0]?.category || "None",
            savingsRate: income > 0 ? (((income - expense) / income) * 100).toFixed(2) : 0,
            message,
            breakdown: categoryData.map(c => ({ _id: c.category, total: parseFloat(c.total) }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getInsights };
