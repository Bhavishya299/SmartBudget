const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

/**
 * Individual item in an item-wise split.
 * 
 * Examples:
 * - Potato Rs.41 split with everyone -> splitMode: "all"
 * - Curd Rs.35 for just you -> splitMode: "single" (paidByOnlyId = you or a specific person)
 * - Curd Rs.35 split between 2 people -> splitMode: "custom" with participantIds
 */
const SplitItem = sequelize.define(
  "SplitItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    amount: moneyField("amount", { allowNull: false }),
    // all | custom | single
    splitMode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "all",
      validate: { isIn: [["all", "custom", "single"]] },
    },
    // For splitMode = "custom" - array of person IDs (and we treat "you" separately)
    participantIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    // For splitMode = "single" - who bears the full amount
    paidByOnlyId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    splitId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "split_items",
    timestamps: true,
    indexes: [{ fields: ["splitId"] }, { fields: ["userId"] }],
  }
);

addUnderscoreId(SplitItem);

module.exports = SplitItem;
