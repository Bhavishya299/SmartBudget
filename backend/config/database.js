const { Sequelize } = require("sequelize");
require("dotenv").config();

/**
 * MySQL connection.
 *
 * Preferred (works with Aiven, Clever Cloud, Railway, TiDB, etc.):
 *   DATABASE_URL=mysql://user:password@host:3306/dbname
 *
 * Local fallback (used when DATABASE_URL is not set):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *
 * Set DB_SSL=true when your hosted provider requires SSL.
 * If the connection string itself asks for SSL (e.g. ?ssl-mode=REQUIRED),
 * it is detected automatically and the unknown param is stripped for mysql2.
 */
let useSSL = String(process.env.DB_SSL).toLowerCase() === "true";
let databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const sslParam =
      parsed.searchParams.get("ssl-mode") || parsed.searchParams.get("ssl");

    if (sslParam && /required|verify|true/i.test(sslParam)) {
      useSSL = true;
    }

    // mysql2 does not understand ssl-mode / sslaccept -> remove them.
    parsed.searchParams.delete("ssl-mode");
    parsed.searchParams.delete("sslaccept");

    databaseUrl = parsed.toString();
  } catch (_) {
    // Leave the URL untouched if it cannot be parsed.
  }
}

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

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, commonOptions)
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
