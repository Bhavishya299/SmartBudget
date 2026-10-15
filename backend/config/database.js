const { Sequelize } = require("sequelize");
require("dotenv").config();

/**
 * MySQL connection.
 *
 * Preferred (works with PlanetScale, Clever Cloud, Railway, etc.):
 *   DATABASE_URL=mysql://user:password@host:3306/dbname
 *
 * Local fallback (used when DATABASE_URL is not set):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *
 * Set DB_SSL=true when your hosted provider requires SSL.
 */
const useSSL = String(process.env.DB_SSL).toLowerCase() === "true";

const commonOptions = {
  dialect: "mysql",
  logging: false,
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
      process.env.DB_NAME || "budget_app",
      process.env.DB_USER || "root",
      process.env.DB_PASSWORD || "",
      {
        ...commonOptions,
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 3306,
      }
    );

module.exports = { sequelize, Sequelize };
