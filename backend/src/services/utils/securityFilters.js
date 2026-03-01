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
const NON_EQUITY_NAME_KEYWORDS = ['debenture', 'bond', 'promoter', 'mutual fund', 'scheme'];

// Symbol-suffix patterns that indicate non-equity instruments
const NON_EQUITY_SYMBOL_PATTERNS = [
    /[BD]\d{2,4}$/,       // bonds/debentures like ADBLD83, BOKD86
    /EB\d{2}$/,           // e.g. EBLD91
    /\d{2}[_/]\d{2}/,     // e.g. NICAD85/86, GBILD86/87
    /SY\d*$/,             // e.g. CSY, GSY, KSY, RSY, GBIMESY2
    /SF$/,                // e.g. various SF-suffix
    /MF\d*$/,             // e.g. CMF2, MMF1 (MF + optional digits)
    /ED$/,                // e.g. NIFRAGED
    /MF$/,                // any ending in MF
    /D\d{2}$/,            // bonds with D and 2 digits like BOKD86
    /^\w{2,4}MF\d*$/      // catching CMF, CMF1, CMF2, etc.
];

// Regex for fund-style symbols: 2-5 uppercase letters followed by F and optional digits
const FUND_SYMBOL_PATTERN = /^[A-Z]{2,5}F\d*$/;

// Fund suffixes that legitimate equity companies may use — exclude these from fund check
const SAFE_FUND_SUFFIXES = ['LBSL', 'LBS'];

// Known non-equity symbols that don't follow any predictable regex pattern.
// These are mutual funds, debentures, promoter shares, or preferred stock
// whose symbols resemble ordinary equities.
const NON_EQUITY_BLACKLIST = new Set([
    // Mutual funds with tricky symbols
    'LUK', 'KDBY', 'NICFC', 'H8020', 'NIBLSTF', 'NMB50',
    'SIGS1', 'SIGS2', 'SIGS3', 'SFMF', 'C30MF', 'CMF1', 'CMF2',
    // Promoter / preferred shares
    'GBIMEP', 'HEIP', 'HIDCLP', 'NIMBPO', 'RBCLPO', 'SNMAPO', 'MLBLPO',
    'HNBPO', 'NBPO',
    // Debentures with unusual patterns
    'SCBD', 'PBD85', 'PBD88', 'BOKD86', 'EBLD91',
    // Misc non-equity
    'HLICF', 'EMLBF', 'RMF1', 'RMF2', 'SBCF', 'GIMES1'
]);

// Known equity symbols that might falsely trigger the fund/debenture regex (like NMBMF, SWMF)
const EQUITY_WHITELIST = new Set([
    'NMBMF', 'SWMF'
]);

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
    || sector.includes('debenture')
    || sector.includes('others');

/** True when company name contains fund keywords but NOT power-sector keywords */
const isFundByName = (name) =>
    FUND_KEYWORDS.some(k => name.includes(k))
    && !POWER_KEYWORDS.some(k => name.includes(k));

/** True when symbol looks like a fund code (e.g. ABCF1) excluding known safe suffixes */
const isFundBySymbol = (symbol) =>
    FUND_SYMBOL_PATTERN.test(symbol)
    && !SAFE_FUND_SUFFIXES.some(s => symbol.endsWith(s));

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

    if (EQUITY_WHITELIST.has(symbol)) return true;
    if (NON_EQUITY_BLACKLIST.has(symbol)) return false;
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
