// Indian Rupees amount to words (integer rupees; legacy recovery invoice uses rounded total).

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen"
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelow1000(n) {
  if (n <= 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r ? `${TENS[t]} ${ONES[r]}`.trim() : TENS[t];
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = `${ONES[h]} Hundred`;
  return r ? `${head} ${wordsBelow1000(r)}`.trim() : head;
}

function wordsIndianInteger(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Zero";

  const parts = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;

  if (crore) parts.push(`${wordsBelow1000(crore)} Crore`);
  if (lakh) parts.push(`${wordsBelow1000(lakh)} Lakh`);
  if (thousand) parts.push(`${wordsBelow1000(thousand)} Thousand`);
  if (rest) parts.push(wordsBelow1000(rest));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * @param {number|string} amount — rounded to nearest rupee for wording (legacy ROUND total)
 * @returns {string} e.g. "Fifteen Thousand"
 */
export function amountToWordsInr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  const rupees = Math.round(n);
  return wordsIndianInteger(rupees);
}
