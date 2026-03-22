/**
 * Narrative Formatters
 * Extracted from narrativeHelpers.js
 */

function fmtNPR(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return `NPR ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtLakh(val) {
  if (val == null || isNaN(val)) return 'N/A';
  const num = Number(val);
  const abs = Math.abs(num);
  if (abs >= 10000000) return `${(num / 10000000).toFixed(2)} crore`;
  if (abs >= 100000) return `${(num / 100000).toFixed(2)} lakh`;
  return num.toLocaleString('en-IN');
}

function pctWord(pct) {
  const abs = Math.abs(pct);
  if (abs >= 5) return 'significantly';
  if (abs >= 2) return 'noticeably';
  if (abs >= 0.5) return 'slightly';
  return 'barely';
}

module.exports = {
    fmtNPR,
    fmtLakh,
    pctWord
};
