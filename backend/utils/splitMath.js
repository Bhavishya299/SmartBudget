/**
 * Pure helpers for dividing a bill between people.
 *
 * Kept separate from the route so the rounding rules can be tested directly.
 * Money must never be lost or invented: the shares always add up to exactly
 * the bill, even when it does not divide evenly.
 */

/** Round to 2 decimals the same way money is stored (avoid float drift). */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Split `amount` into `count` equal parts.
 *
 * Example: 100 / 3 -> [33.34, 33.33, 33.33]
 *
 * The leftover paise from rounding are given to the first share(s), so the
 * parts always sum to exactly `amount`. This prevents the classic bug where
 * 3 x 33.33 = 99.99 and a paisa vanishes.
 *
 * @param {number} amount  total to divide
 * @param {number} count   number of parts (must be >= 1)
 * @returns {number[]}     `count` amounts summing to `amount`
 */
function divideEvenly(amount, count) {
  const total = round2(amount);
  const parts = Math.max(1, Math.floor(Number(count) || 1));

  const base = Math.floor((total * 100) / parts) / 100;
  const shares = new Array(parts).fill(round2(base));

  // Distribute the remaining paise one at a time.
  let remainder = Math.round((total - base * parts) * 100);
  for (let i = 0; i < parts && remainder > 0; i++) {
    shares[i] = round2(shares[i] + 0.01);
    remainder -= 1;
  }

  return shares;
}

/**
 * Build the full share breakdown for a split.
 *
 * You are treated as one of the `splitCount` people, so a Rs.600 bill split 4
 * ways means your share is Rs.150 and each of the other three owes Rs.150.
 * The `others` list holds exactly the flatmates in the group, so if you pick 4
 * ways you should pass 3 others.
 *
 * @param {object}   params
 * @param {number}   params.amount       the whole bill
 * @param {number}   params.splitCount   how many ways (including you)
 * @param {string[]} params.others       names of the other people
 * @returns {{myShare: number, shares: {name: string, amount: number}[], total: number}}
 */
function buildSplit({ amount, splitCount, others = [] }) {
  const total = round2(amount);
  const parts = Math.max(1, Math.floor(Number(splitCount) || 1));

  const all = divideEvenly(total, parts);
  const myShare = all[0];
  const owed = all.slice(1);

  // If fewer names were supplied than there are owed portions, name the extras
  // generically rather than dropping the money on the floor.
  const shares = owed.map((value, index) => ({
    name: others[index] || `Person ${index + 2}`,
    amount: value,
  }));

  return {
    myShare,
    shares,
    // Sum of everything others owe you. Derived from the shares, so it can
    // never disagree with the rows we actually save.
    othersTotal: round2(shares.reduce((sum, s) => sum + s.amount, 0)),
    total,
  };
}

/** Total currently owed to you across a list of shares. */
function pendingTotal(shares = []) {
  return round2(
    shares
      .filter((s) => !s.settled)
      .reduce((sum, s) => sum + Number(s.amount || 0), 0)
  );
}

module.exports = { divideEvenly, buildSplit, pendingTotal, round2 };
