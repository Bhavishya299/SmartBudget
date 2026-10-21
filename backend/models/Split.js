const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { moneyField, addUnderscoreId } = require("./helpers");

/**
 * One split expense, e.g. a Rs.600 Zepto order divided 4 ways.
 *
 * `amount` is the full bill. `myShare` is the part that belongs to *you* and
 * is what gets counted in your own spending; the rest is money other people
 * owe you.
 */
const Split = sequelize.define(
  "Split",
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
    // The whole bill, not just your share.
    amount: moneyField("amount", { allowNull: false }),
    // Your own portion of the bill.
    myShare: moneyField("myShare", { allowNull: false, defaultValue: 0 }),
    // How many ways the bill was divided (2, 3, 4, ...).
    splitCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Where it was bought: zepto / blinkit / flipkart minutes / instamart /
    // offline. Free text so you can type anything else.
    source: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "offline",
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Other",
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Receipt screenshot hosted on Cloudinary.
    receiptUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    notes: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    // The transaction this split was logged against, if any. Kept so deleting
    // one side can clean up the other.
    transactionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "splits",
    timestamps: true,
    indexes: [{ fields: ["userId"] }, { fields: ["date"] }],
  }
);

addUnderscoreId(Split);

module.exports = Split;
