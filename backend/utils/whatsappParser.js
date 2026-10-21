/**
 * WhatsApp message parser.
 *
 * Turns a short free-text message into a structured transaction:
 *   "300 on starbucks"      -> { amount: 300, category: "Food",          type: "expense", title: "Starbucks" }
 *   "24 on printing"        -> { amount: 24,  category: "Other",         type: "expense", title: "Printing" }
 *   "500 uber"              -> { amount: 500, category: "Transport",     type: "expense", title: "Uber" }
 *   "45000 salary credited" -> { amount: 45000, category: "Salary",      type: "income",  title: "Salary" }
 *
 * The category vocabulary deliberately mirrors (and extends) the keyword map
 * used by the frontend auto-categorizer in
 * `frontend/src/components/AddTransaction.jsx` so a WhatsApp entry lands in the
 * same bucket the UI would have picked.
 */

// Canonical category names — must match the frontend's expense/income lists.
const CATEGORY = {
  FOOD: "Food",
  TRANSPORT: "Transport",
  ENTERTAINMENT: "Entertainment",
  HOUSING: "Housing",
  HEALTHCARE: "Healthcare",
  UTILITIES: "Utilities",
  INSURANCE: "Insurance",
  PERSONAL: "Personal",
  SAVING: "Saving",
  OTHER: "Other",
  SALARY: "Salary",
  FREELANCE: "Freelance",
  INVESTMENT: "Investment",
  GIFT: "Gift",
};

/**
 * Merchant / item keyword -> category.
 * Keeping this as a flat list makes it easy to extend.
 */
const CATEGORY_KEYWORDS = [
  // ---- Food ----
  [CATEGORY.FOOD, [
    "swiggy", "zomato", "mcdonald", "mcdonalds", "kfc", "starbucks", "grocery",
    "groceries", "restaurant", "pizza", "burger", "cafe", "coffee", "tea",
    "canteen", "lunch", "dinner", "breakfast", "snack", "food", "bakery",
    "dominos", "domino", "subway", "dunkin", "chai", "eat", "meal", "zomato",
    "blinkit", "bigbasket", "zepto", "instamart", "bar", "beer",
  ]],

  // ---- Transport ----
  [CATEGORY.TRANSPORT, [
    "uber", "ola", "rapido", "petrol", "diesel", "gas", "cng", "fuel",
    "transit", "flight", "airfare", "train", "bus", "metro", "auto",
    "rickshaw", "taxi", "cab", "parking", "toll", "fastag", "irctc", "indigo",
    "railway", "vehicle", "bike", "car",
  ]],

  // ---- Entertainment ----
  [CATEGORY.ENTERTAINMENT, [
    "netflix", "spotify", "prime", "hotstar", "youtube", "movie", "cinema",
    "game", "gaming", "concert", "club", "party", "disney", "jiocinema",
    "bookmyshow", "pvr", "inox", "audible", "steam", "playstation",
  ]],

  // ---- Housing ----
  [CATEGORY.HOUSING, [
    "rent", "maintenance", "furniture", "repair", "society", "landlord",
    "mortgage", "home", "house", "maid", "cook", "cleaner",
  ]],

  // ---- Healthcare ----
  [CATEGORY.HEALTHCARE, [
    "pharmacy", "doctor", "hospital", "medicine", "clinic", "medical",
    "dentist", "dental", "gym", "fitness", "insurance", "lab", "test",
    "apollo", "medplus", "1mg", "physio", "therapy",
  ]],

  // ---- Utilities ----
  [CATEGORY.UTILITIES, [
    "electricity", "water", "wifi", "internet", "broadband", "mobile",
    "recharge", "phone", "bill", "utility", "dth", "gasbill", "cylinder",
    "postpaid", "prepaid", "jio", "airtel", "vi", "vodafone", "act", "broadband",
  ]],

  // ---- Personal / Shopping (miscellaneous daily spends) ----
  [CATEGORY.PERSONAL, [
    "clothes", "clothing", "shopping", "shoes", "amazon", "flipkart", "myntra",
    "ajio", "meesho", "salon", "barber", "haircut", "cosmetics", "perfume",
    "gift", "stationery", "printing", "printout", "xerox", "photocopy",
    "courier", "post", "shipping", "laundry", "dryclean", "tailor",
    "book", "books", "toy", "toys", "pet", "donation", "charity", "temple",
    "subscription", "annual", "fee", "fees", "fine", "penalty", "tax",
  ]],

  // ---- Saving / Investment ----
  [CATEGORY.SAVING, [
    "sip", "mutual", "mutualfund", "fd", "rd", "ppf", "nps", "savings",
    "saving", "deposit", "emergency",
  ]],

  [CATEGORY.INVESTMENT, [
    "stocks", "stock", "share", "shares", "crypto", "bitcoin", "gold",
    "invest", "investment", "trading",
  ]],

  // ---- Income ----
  [CATEGORY.SALARY, ["salary", "sal", "paycheck", "wages", "stipend"]],
  [CATEGORY.FREELANCE, ["freelance", "client", "project", "consulting", "gig"]],
  [CATEGORY.GIFT, ["gift", "cashback", "refund", "reward", "prize", "won"]],
];

const INCOME_KEYWORDS = [
  "salary", "income", "received", "receive", "got", "get", "earned", "earn",
  "bonus", "credit", "credited", "deposited", "deposit", "refund", "cashback",
  "win", "won", "prize", "reimburse", "reimbursement", "stipend", "dividend",
  "interest", "profit",
];

const EXPENSE_KEYWORDS = [
  "spent", "spend", "paid", "pay", "debit", "debited", "buy", "bought",
  "purchase", "purchased", "bill", "expense", "cost", "charged",
];

/** Words that carry no category meaning on their own. */
const STOP_WORDS = new Set([
  "spent", "spend", "on", "for", "at", "to", "from", "of", "in", "the", "a",
  "an", "and", "received", "receive", "got", "get", "earned", "earn", "paid",
  "pay", "debit", "debited", "credit", "credited", "buy", "bought", "purchase",
  "purchased", "bill", "expense", "cost", "charged", "income", "amount", "rs",
  "inr", "rupees", "rupee", "today", "yesterday", "salary",
]);

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

function titleCase(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Extract an amount. Understands plain numbers, decimals, commas, and
 * shorthand like "1k" / "2.5k" / "1l" (lakh). Takes the largest match so
 * "300 on 2 coffees" still resolves to 300 rather than 2.
 */
function extractAmount(raw) {
  const text = raw.toLowerCase();

  // 1k / 2.5k / 3l
  const shorthand = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(k|l|lakh|lac|cr|crore)\b/g)];
  if (shorthand.length) {
    let best = 0;
    for (const m of shorthand) {
      const n = parseFloat(m[1]);
      const mult = m[2] === "k" ? 1e3 : ["l", "lakh", "lac"].includes(m[2]) ? 1e5 : 1e7;
      best = Math.max(best, Math.round(n * mult));
    }
    if (best > 0) return best;
  }

  // Plain numbers. Match a full number including comma-grouped thousands
  // (e.g. "2,500") and decimals. Require the comma groups to be well formed
  // so "2,500" doesn't get split into "2" and "500".
  const numbers = [];
  for (const m of text.matchAll(/\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = text[start - 1];
    const after = text[end];

    // Skip anything that looks like part of a date or time.
    const looksLikeDate =
      before === "/" || before === "-" || before === ":" ||
      after === "/" || after === ":";

    if (looksLikeDate) continue;

    const value = parseFloat(m[0].replace(/,/g, ""));
    if (Number.isFinite(value)) numbers.push(value);
  }

  if (!numbers.length) return null;

  // Prefer the largest number: "spent 300 on 2 coffees" -> 300.
  const best = Math.max(...numbers);
  return Number.isSafeInteger(best) ? best : Math.round(best);
}

/**
 * Resolve a date from natural language ("today", "yesterday", "24 oct",
 * "2026-10-24"). Defaults to now.
 */
function extractDate(raw) {
  const text = raw.toLowerCase();
  const now = new Date();

  if (/\byesterday\b/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }

  if (/\b(today|now)\b/.test(text)) return now;

  // "5 oct" / "5 october" / "oct 5"
  const dayMonth = text.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+([a-z]{3,9})\b/);
  const monthDay = text.match(/\b([a-z]{3,9})\s+(\d{1,2})\b/);

  const tryBuild = (day, monthName) => {
    const month = MONTHS[monthName];
    const dayNum = parseInt(day, 10);
    if (month === undefined || !dayNum || dayNum < 1 || dayNum > 31) return null;
    const d = new Date(now.getFullYear(), month, dayNum);
    // If the date is in the future, assume it meant last year.
    if (d.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
      d.setFullYear(d.getFullYear() - 1);
    }
    return d;
  };

  if (dayMonth) {
    const built = tryBuild(dayMonth[1], dayMonth[2]);
    if (built) return built;
  }
  if (monthDay) {
    const built = tryBuild(monthDay[2], monthDay[1]);
    if (built) return built;
  }

  // ISO-ish: 2026-10-24 or 24-10-2026 or 24/10/2026
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    if (!isNaN(d.getTime())) return d;
  }
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (dmy) {
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    if (!isNaN(d.getTime())) return d;
  }

  return now;
}

/**
 * Reduce a token to a rough stem so plurals match their singular keyword.
 * The goal is only to bridge simple plurals (books/book, coffees/coffee),
 * so it deliberately stays conservative.
 */
function stem(word) {
  const w = word;

  // groceries -> grocery, batteries -> battery
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";

  // boxes -> box, dishes -> dish  (es after s/x/z/ch/sh)
  if (w.length > 4 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);

  // coffees -> coffee, addresses -> address: a trailing "es" preceded by a
  // consonant only drops the "s" (coffees -> coffee, not coffe).
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -1);

  // books -> book
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);

  return w;
}

/** Find a category from the merchant/item keywords, longest keyword first. */
function detectCategory(tokens) {
  const stems = tokens.map(stem);
  let best = null;
  let bestLen = 0;

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      // Match whole tokens only, so "gas" doesn't fire on "gasket", while
      // still letting "coffees" match the "coffee" keyword.
      const hit = stems.includes(kw) || tokens.includes(kw);
      if (!hit) continue;
      if (kw.length > bestLen) {
        best = category;
        bestLen = kw.length;
      }
    }
  }

  return best;
}

/**
 * Parse a WhatsApp message body.
 *
 * @param {string} raw  message text
 * @returns {{ok: true, amount: number, type: string, category: string, title: string, description: string, date: Date}
 *          | {ok: false, reason: string}}
 */
function parseMessage(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, reason: "empty" };

  const lower = text.toLowerCase();

  // Text used for amount detection keeps commas so "2,500" survives intact.
  const forAmount = lower
    .replace(/[₹$€£]/g, " ")
    .replace(/[^a-z0-9\s/,.\-:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const amount = extractAmount(forAmount);

  // Text used for tokens/category drops punctuation entirely.
  const cleaned = lower
    .replace(/[₹$€£]/g, " ")
    .replace(/[^a-z0-9\s/\-:.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (amount === null || amount <= 0) {
    return { ok: false, reason: "no-amount" };
  }

  // ---- income vs expense ----
  let type = "expense";
  const isIncome = INCOME_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`).test(cleaned));
  const isExpense = EXPENSE_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`).test(cleaned));

  if (isIncome && !isExpense) type = "income";
  else if (isIncome && isExpense) {
    // Both present: trust the more explicit income signal only if it comes
    // from a clear income word like "salary" or "received".
    const strong = ["salary", "received", "credit", "credited", "refund", "cashback"]
      .some((k) => new RegExp(`\\b${k}\\b`).test(cleaned));
    type = strong ? "income" : "expense";
  }

  // ---- tokens describing what was bought ----
  // Drop pure numbers, digit+unit shorthands (1k, 1.5k, 3l), stop words and
  // anything that is only a date fragment.
  const tokens = cleaned
    .split(" ")
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 1)
    .filter((t) => !/^\d+(\.\d+)?[kl]?$/.test(t))   // numbers & shorthands
    .filter((t) => !STOP_WORDS.has(t))
    .filter((t) => !MONTHS[t])
    .filter((t) => !/^\d+$/.test(t));

  // ---- category ----
  let category = detectCategory(tokens);

  if (!category) {
    if (type === "income") {
      category = detectCategory([...tokens]) || CATEGORY.SALARY;
    } else {
      category = CATEGORY.OTHER;
    }
  }

  // Income keywords must win over merchant keywords (e.g. "salary credited").
  if (type === "income") {
    const incomeHit = detectCategory(tokens);
    const incomeOnly = [CATEGORY.SALARY, CATEGORY.FREELANCE, CATEGORY.INVESTMENT, CATEGORY.GIFT];
    category = incomeOnly.includes(incomeHit) ? incomeHit : (detectCategory(tokens) && incomeOnly.includes(category) ? category : CATEGORY.SALARY);
  }

  // ---- title: the merchant / item, not the number ----
  let title = tokens.length ? tokens.map(titleCase).join(" ") : titleCase(category);
  if (title.length > 50) title = title.slice(0, 50).trim();

  const date = extractDate(cleaned);

  return {
    ok: true,
    amount,
    type,
    category,
    title: title || titleCase(category),
    description: "WhatsApp entry",
    date,
  };
}

module.exports = { parseMessage, CATEGORY, CATEGORY_KEYWORDS };
