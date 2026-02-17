/**
 * Unified Security Filtering Logic for NEPSE
 *
 * Each filtering concern is extracted into a small predicate so that
 * isEquitySecurity itself stays flat (no nested conditionals).
 */

// ── Lookup Tables ───────────────────────────────────────────────────
const EQUITY_TYPES = ['equity', 'ordinary share'];
const ACTIVE_STATUSES = ['A', 'Active'];
const FUND_KEYWORDS = ['fund', 'scheme', 'yojana', 'kosh', 'units'];
const POWER_KEYWORDS = ['pariyojana', 'project', 'hydro', 'hydropower', 'jalvidhyut', 'jalbidhyut', 'koshi'];
const MF_SUFFIXES = ['MF', 'LBS', 'LBSL'];
const NON_EQUITY_NAME_KEYWORDS = ['debenture', 'bond', 'promoter'];
const FUND_SYMBOL_PATTERN = /^[A-Z]{2,5}F\d*$/;
const NON_EQUITY_SYMBOL_PATTERNS = [
    /[BD]\d{2,4}$/,
    /EB\d{2}$/,
    /\d{2}[_/]\d{2}/,
    /SY$/,
    /SF$/,
];

// ── Predicate Helpers ───────────────────────────────────────────────

/** True when instrument type is present but not an equity type */
const isNonEquityType = (type) =>
    type && !EQUITY_TYPES.includes(type);

/** True when status is present but not an active status */
const isInactiveStatus = (status) =>
    status && !ACTIVE_STATUSES.includes(status);

/** True when sector/sectorId indicates mutual fund, bond, or debenture */
const isExcludedSector = (sectorId, sector) =>
    sectorId === 66
    || sector.includes('mutual fund')
    || sector.includes('bond')
    || sector.includes('debenture');

/** True when company name contains fund keywords but NOT power-sector keywords */
const isFundByName = (name) =>
    FUND_KEYWORDS.some(k => name.includes(k))
    && !POWER_KEYWORDS.some(k => name.includes(k));

/** True when symbol looks like a fund code (e.g. ABCF1) excluding known suffixes */
const isFundBySymbol = (symbol) =>
    FUND_SYMBOL_PATTERN.test(symbol)
    && !MF_SUFFIXES.some(s => symbol.endsWith(s));

/** True when symbol matches a non-equity regex pattern or ends with PO */
const hasNonEquitySymbol = (symbol) =>
    NON_EQUITY_SYMBOL_PATTERNS.some(p => p.test(symbol))
    || symbol.endsWith('PO');

/** True when company name or instrument name contains non-equity keywords or '%' */
const hasNonEquityName = (companyName, instrumentName) =>
    NON_EQUITY_NAME_KEYWORDS.some(k => companyName.includes(k) || instrumentName.includes(k))
    || companyName.includes('%');

// ── Main Filter ─────────────────────────────────────────────────────

const isEquitySecurity = (security) => {
    if (!security) return false;

    const symbol = (security.symbol || '').toUpperCase();
    const sectorId = security.sectorId || security.indexId;
    const sector = (security.sector || security.sectorName || '').toLowerCase();
    const companyName = (security.companyName || security.securityName || '').toLowerCase();
    const instrumentType = (security.instrumentType || '').toLowerCase();
    const instrumentName = (security.instrumentName || '').toLowerCase();

    if (isNonEquityType(instrumentType)) return false;
    if (isInactiveStatus(security.status)) return false;
    if (isExcludedSector(sectorId, sector)) return false;
    if (isFundByName(companyName)) return false;
    if (isFundBySymbol(symbol)) return false;
    if (hasNonEquitySymbol(symbol)) return false;
    if (hasNonEquityName(companyName, instrumentName)) return false;

    return true;
};

module.exports = {
    isEquitySecurity
};
