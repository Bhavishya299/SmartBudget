const { fn, col, literal } = require("sequelize");
const Transaction = require("../models/Transaction");

const getChartData = async (req, res) => {
    try {
        // MySQL: MONTH(date) returns 1-12
        const monthExpr = literal("MONTH(`date`)");

        const rows = await Transaction.findAll({
            attributes: [
                [monthExpr, "month"],
                "type",
                [fn("SUM", col("amount")), "total"]
            ],
            where: { userId: req.user.id },
            group: [monthExpr, "type"],
            order: [[monthExpr, "ASC"]],
            raw: true
        });

        // Keep the same shape the charts component already expects: { _id: { month, type }, total }
        const chartData = rows.map(row => ({
            _id: {
                month: Number(row.month),
                type: row.type
            },
            total: parseFloat(row.total)
        }));

        res.status(200).json(chartData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getChartData };
