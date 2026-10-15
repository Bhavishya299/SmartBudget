const { DataTypes } = require("sequelize");

/**
 * Postgres returns DECIMAL/NUMERIC columns as strings to preserve precision.
 * The frontend does arithmetic with these values (e.g. currentAmount + added),
 * so we expose them as real JS numbers via a getter.
 */
function moneyField(fieldName, { allowNull = false, defaultValue } = {}) {
  const attribute = {
    type: DataTypes.DECIMAL(15, 2),
    allowNull,
    get() {
      const value = this.getDataValue(fieldName);
      if (value === null || value === undefined) return value;
      return parseFloat(value);
    },
  };

  if (defaultValue !== undefined) attribute.defaultValue = defaultValue;

  return attribute;
}

/**
 * The original frontend was written against MongoDB and reads `_id` everywhere
 * (list keys, delete URLs, chart groupings). We keep returning `_id` alongside
 * the Postgres `id` so no frontend changes are required.
 */
function addUnderscoreId(model) {
  model.prototype.toJSON = function toJSON() {
    const values = { ...this.get({ plain: true }) };
    values._id = values.id;
    delete values.password;
    delete values.resetPasswordToken;
    delete values.resetPasswordExpire;
    return values;
  };
}

module.exports = { moneyField, addUnderscoreId };
