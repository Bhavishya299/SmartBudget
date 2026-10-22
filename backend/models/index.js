const { sequelize, Sequelize } = require("../config/database");
const User = require("./User");
const Transaction = require("./Transaction");
const Budget = require("./Budget");
const Goal = require("./Goal");
const Person = require("./Person");
const SplitGroup = require("./SplitGroup");
const Split = require("./Split");
const SplitShare = require("./SplitShare");
const SplitItem = require("./SplitItem");
const Wallet = require("./Wallet");

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

// ---- Flatmate splits ----
User.hasMany(Person, { foreignKey: "userId", as: "people", onDelete: "CASCADE" });
Person.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(SplitGroup, { foreignKey: "userId", as: "splitGroups", onDelete: "CASCADE" });
SplitGroup.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Split, { foreignKey: "userId", as: "splits", onDelete: "CASCADE" });
Split.belongsTo(User, { foreignKey: "userId", as: "user" });

// Deleting a split removes its shares, so no orphaned "owed" rows survive.
Split.hasMany(SplitShare, { foreignKey: "splitId", as: "shares", onDelete: "CASCADE" });
SplitShare.belongsTo(Split, { foreignKey: "splitId", as: "split" });

User.hasMany(SplitShare, { foreignKey: "userId", as: "splitShares", onDelete: "CASCADE" });
SplitShare.belongsTo(User, { foreignKey: "userId", as: "user" });

SplitShare.belongsTo(Person, { foreignKey: "personId", as: "person" });

Split.hasMany(SplitItem, { foreignKey: "splitId", as: "items", onDelete: "CASCADE" });
SplitItem.belongsTo(Split, { foreignKey: "splitId", as: "split" });

User.hasOne(Wallet, { foreignKey: "userId", as: "wallet", onDelete: "CASCADE" });
Wallet.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Transaction,
  Budget,
  Goal,
  Person,
  SplitGroup,
  Split,
  SplitShare,
  SplitItem,
  Wallet,
};
