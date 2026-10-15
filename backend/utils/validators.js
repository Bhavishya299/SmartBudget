const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres rejects malformed UUIDs with a database error, which would surface
 * as a 500. We guard route params so bad ids return a clean 404 instead.
 */
const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

module.exports = { isUuid };
