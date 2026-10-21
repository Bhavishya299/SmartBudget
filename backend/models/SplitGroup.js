const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { addUnderscoreId } = require("./helpers");

/**
 * A saved set of people you split with, e.g. "Flat 302".
 *
 * Storing the groups means you pick "Flat 302" once instead of re-selecting
 * Yash / Tanmay / Siddharth for every expense.
 */
const SplitGroup = sequelize.define(
  "SplitGroup",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // The people in this group, stored as a JSON array of Person ids.
    // A join table would be more "correct", but this list is small, always
    // read whole, and never queried by member - so a JSON array is simpler
    // and avoids an extra table on the free database tier.
    memberIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "split_groups",
    timestamps: true,
    indexes: [{ fields: ["userId"] }],
  }
);

addUnderscoreId(SplitGroup);

module.exports = SplitGroup;
