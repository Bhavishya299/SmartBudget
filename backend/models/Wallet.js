const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

const Wallet = sequelize.define(
  "Wallet",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    cashBalance: moneyField("cashBalance", { allowNull: false, defaultValue: 0 }),
    bankBalance: moneyField("bankBalance", { allowNull: false, defaultValue: 0 }),
  },
  {
    tableName: "wallets",
    timestamps: true,
    indexes: [{ fields: ["userId"], unique: true }],
  }
);

addUnderscoreId(Wallet);

module.exports = Wallet;
