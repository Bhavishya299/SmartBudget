/**
 * Pure helpers for item-wise splitting.
 * 
 * Example:
 * Items:
 * - Potato 41 split "all" with [Yash, Tanmay, Siddharth]
 * - Curd 35 split "single" for Yash only
 * - Curd 35 split "custom" for Yash, Tanmay
 * 
 * Result: potato gives everyone 41/4, Yash gets +35 (single) + 17.5 (custom), etc.
 */

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate how much each person owes based on item breakdown.
 * 
 * @param {Object} params
 * @param {Array} params.items - Array of {name, amount, splitMode, participantIds, paidByOnlyId}
 * @param {Array} params.people - All people in split [{id, name}]
 * @param {string} params.userId - Current user's id
 * @returns {{myShare: number, shares: Array<{personId, name, amount}>, total: number}}
 */
function calculateItemWiseSplit({ items = [], people = [], userId }) {
  if (!items.length) {
    return { myShare: 0, shares: [], total: 0 };
  }

  const total = round2(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  
  // Track what each person owes
  const owed = {}; // key = personId or "user" or person name
  const personMap = {};
  people.forEach(p => {
    personMap[p.id || p._id] = p.name;
    owed[p.id || p._id] = 0;
  });
  owed["user"] = 0; // you

  for (const item of items) {
    const amount = round2(Number(item.amount || 0));
    if (amount <= 0) continue;

    if (item.splitMode === "all") {
      // Split among everyone including you
      const everyone = ["user", ...people.map(p => p.id || p._id)].filter(Boolean);
      const count = everyone.length;
      if (count === 0) continue;
      
      // Distribute evenly
      const base = Math.floor((amount * 100) / count) / 100;
      const shares = new Array(count).fill(round2(base));
      let remainder = Math.round((amount - base * count) * 100);
      for (let i = 0; i < count && remainder > 0; i++) {
        shares[i] = round2(shares[i] + 0.01);
        remainder -= 1;
      }
      
      everyone.forEach((id, idx) => {
        owed[id] += shares[idx];
      });
    } else if (item.splitMode === "single") {
      // Only this specific person pays the full amount
      const who = item.paidByOnlyId || "user";
      owed[who] += amount;
    } else if (item.splitMode === "custom") {
      // Split between specific people + maybe you
      const participants = item.participantIds || [];
      const count = participants.length;
      if (count === 0) continue;
      
      const base = Math.floor((amount * 100) / count) / 100;
      const shares = new Array(count).fill(round2(base));
      let remainder = Math.round((amount - base * count) * 100);
      for (let i = 0; i < count && remainder > 0; i++) {
        shares[i] = round2(shares[i] + 0.01);
        remainder -= 1;
      }
      
      participants.forEach((id, idx) => {
        owed[id] += shares[idx];
      });
    }
  }

  const myShare = round2(owed["user"] || 0);
  
  const shares = [];
  for (const [id, amountOwed] of Object.entries(owed)) {
    if (id === "user") continue;
    if (amountOwed <= 0) continue;
    shares.push({
      personId: personMap[id] ? id : null,
      name: personMap[id] || id,
      amount: round2(amountOwed),
    });
  }
  
  // Sort by amount descending
  shares.sort((a, b) => b.amount - a.amount);

  return {
    myShare,
    shares,
    total,
  };
}

module.exports = { calculateItemWiseSplit, round2 };
