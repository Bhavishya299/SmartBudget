const Goal = require("../models/Goal");
const { isUuid } = require("../utils/validators");

const getGoals = async (req, res) => {
    try {
        const goals = await Goal.findAll({
            where: { userId: req.user.id },
            order: [["deadline", "ASC"]]
        });
        res.status(200).json(goals);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

const createGoal = async (req, res) => {
    try {
        const { title, targetAmount, deadline, color } = req.body;
        if (!title || !targetAmount || !deadline) {
            return res.status(400).json({ message: "Title, target amount, and deadline are required." });
        }

        const goal = await Goal.create({
            userId: req.user.id,
            title,
            targetAmount,
            deadline,
            color
        });

        res.status(201).json(goal);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

const updateGoal = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(404).json({ message: "Goal not found" });

        const goal = await Goal.findOne({ where: { id, userId: req.user.id } });

        if (!goal) return res.status(404).json({ message: "Goal not found" });

        // Only allow updating known fields
        const allowed = ["title", "targetAmount", "currentAmount", "deadline", "color"];
        allowed.forEach(field => {
            if (req.body[field] !== undefined) goal[field] = req.body[field];
        });

        await goal.save();

        res.status(200).json(goal);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

const deleteGoal = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(404).json({ message: "Goal not found" });

        const goal = await Goal.findOne({ where: { id, userId: req.user.id } });

        if (!goal) return res.status(404).json({ message: "Goal not found" });

        await goal.destroy();

        res.status(200).json({ message: "Goal deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

module.exports = { getGoals, createGoal, updateGoal, deleteGoal };
