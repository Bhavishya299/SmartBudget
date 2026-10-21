const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

const Transaction = sequelize.define(
  "Transaction",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    amount: moneyField("amount", { allowNull: false }),
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "INR",
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "expense",
      validate: { isIn: [["expense", "income"]] },
    },
    paymentMethod: {
      // How the money moved. "upi" is folded into "online" so there is a
      // single value for all digital payments.
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "unspecified",
      validate: { isIn: [["cash", "online", "card", "unspecified"]] },
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "transactions",
    timestamps: true,
    indexes: [{ fields: ["userId"] }],
  }
);

addUnderscoreId(Transaction);

module.exports = Transaction;
