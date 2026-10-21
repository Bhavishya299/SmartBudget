const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

/**
 * One person's portion of a split, and whether they have paid it back.
 *
 * Rows are created one per flatmate when the split is saved. `settledAt` is
 * null while the money is still owed, which is what the reminder job and the
 * "pending" total are built on.
 */
const SplitShare = sequelize.define(
  "SplitShare",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    amount: moneyField("amount", { allowNull: false }),
    // Denormalised so a share still shows the right name if the person is
    // later renamed or archived.
    personName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    personId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    settled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    settledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // How the flatmate paid you back (cash / online), once they do.
    settledMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [["cash", "online", "card", "unspecified"]] },
    },
    // Set when an automatic reminder has been sent, so we don't nag daily
    // once one has gone out.
    lastRemindedAt: {
      type: DataTypes.DATE,
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
    tableName: "split_shares",
    timestamps: true,
    indexes: [{ fields: ["userId"] }, { fields: ["splitId"] }],
  }
);

addUnderscoreId(SplitShare);

module.exports = SplitShare;
