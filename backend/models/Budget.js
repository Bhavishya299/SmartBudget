const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

const Budget = sequelize.define(
  "Budget",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    limit: moneyField("limit", { allowNull: false }),
    month: {
      // Format: 'YYYY-MM'
      type: DataTypes.STRING(7),
      allowNull: false,
    },
  },
  {
    tableName: "budgets",
    timestamps: true,
    indexes: [
      // A user can only have one budget per category per month.
      { unique: true, fields: ["userId", "category", "month"] },
    ],
  }
);

addUnderscoreId(Budget);

module.exports = Budget;
