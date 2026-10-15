const { sequelize, Sequelize } = require("../config/database");
const User = require("./User");
const Transaction = require("./Transaction");
const Budget = require("./Budget");
const Goal = require("./Goal");

// ---- Associations (replaces MongoDB "ref" + populate) ----
User.hasMany(Transaction, {
  foreignKey: "userId",
  as: "transactions",
  onDelete: "CASCADE",
});
Transaction.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Budget, {
  foreignKey: "userId",
  as: "budgets",
  onDelete: "CASCADE",
});
Budget.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Goal, {
  foreignKey: "userId",
  as: "goals",
  onDelete: "CASCADE",
});
Goal.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = { sequelize, Sequelize, User, Transaction, Budget, Goal };
