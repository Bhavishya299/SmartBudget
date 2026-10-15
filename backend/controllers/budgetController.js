const { Op, fn, col } = require("sequelize");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const { isUuid } = require("../utils/validators");

// Get all budgets for a specific month (format: YYYY-MM) with amount spent
const getBudgets = async (req, res) => {
    try {
        const { month } = req.query; // '2023-10'
        if (!month) return res.status(400).json({ message: "Month is required (YYYY-MM)" });

        const userId = req.user.id;

        // Fetch user's budgets for the month
        const budgets = await Budget.findAll({ where: { userId, month } });

        // Calculate start and end date for the month
        const [year, m] = month.split('-');
        const startDate = new Date(year, m - 1, 1);
        const endDate = new Date(year, m, 1);

        // Group expenses for that month by category (replaces Mongo $group)
        const expenses = await Transaction.findAll({
            attributes: ["category", [fn("SUM", col("amount")), "spent"]],
            where: {
                userId,
                type: "expense",
                date: { [Op.gte]: startDate, [Op.lt]: endDate }
            },
            group: ["category"],
            raw: true
        });

        // Map spent amounts to budgets
        const expenseMap = {};
        expenses.forEach(e => {
            expenseMap[e.category] = parseFloat(e.spent);
        });

        const enhancedBudgets = budgets.map(b => ({
            ...b.toJSON(),
            spent: expenseMap[b.category] || 0
        }));

        res.status(200).json(enhancedBudgets);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// Create or update a budget for a category/month
const createOrUpdateBudget = async (req, res) => {
    try {
        const { category, limit, month } = req.body;
        if (!category || !limit || !month) {
            return res.status(400).json({ message: "Please provide category, limit, and month." });
        }

        const userId = req.user.id;

        let budget = await Budget.findOne({ where: { userId, category, month } });

        if (budget) {
            budget.limit = limit;
            await budget.save();
        } else {
            budget = await Budget.create({ userId, category, limit, month });
        }

        res.status(200).json(budget);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

// Delete a budget
const deleteBudget = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(404).json({ message: "Budget not found" });

        const budget = await Budget.findOne({ where: { id, userId: req.user.id } });

        if (!budget) return res.status(404).json({ message: "Budget not found" });

        await budget.destroy();

        res.status(200).json({ message: "Budget deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

module.exports = { getBudgets, createOrUpdateBudget, deleteBudget };
