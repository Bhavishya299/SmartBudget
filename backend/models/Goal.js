const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

const Goal = sequelize.define(
  "Goal",
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetAmount: moneyField("targetAmount", { allowNull: false }),
    currentAmount: moneyField("currentAmount", { allowNull: false, defaultValue: 0 }),
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "#10b981",
    },
  },
  {
    tableName: "goals",
    timestamps: true,
    indexes: [{ fields: ["userId"] }],
  }
);

addUnderscoreId(Goal);

module.exports = Goal;
