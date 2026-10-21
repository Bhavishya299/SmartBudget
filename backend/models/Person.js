const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { addUnderscoreId } = require("./helpers");

/**
 * A flatmate / friend you split expenses with.
 *
 * These are deliberately NOT user accounts: you type a name once and it is
 * attached to your own account. That keeps the feature usable without asking
 * anyone else to sign up. The shape leaves room to add a linkedUserId later
 * if they ever do join.
 */
const Person = sequelize.define(
  "Person",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      set(value) {
        // Store trimmed; we still allow "Tanmay S" style names.
        this.setDataValue("name", String(value || "").trim());
      },
    },
    // WhatsApp number, so a reminder can be addressed to them later.
    // Optional - a person can exist purely as a name.
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Optional friendly colour for the avatar chip in the UI.
    color: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "#6366f1",
    },
    // Soft delete / archive so historical splits keep their names.
    archived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "people",
    timestamps: true,
    indexes: [{ fields: ["userId"] }],
  }
);

addUnderscoreId(Person);

module.exports = Person;
