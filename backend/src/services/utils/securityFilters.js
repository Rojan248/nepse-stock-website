/**
 * Unified Security Filtering Logic for NEPSE
 */

const isEquitySecurity = (security) => {
    if (!security) return false;

    const symbol = (security.symbol || '').toUpperCase();
    const sectorId = security.sectorId || security.indexId;
    const sector = (security.sector || security.sectorName || '').toLowerCase();
    const companyName = (security.companyName || security.securityName || '').toLowerCase();
    const instrumentType = (security.instrumentType || '').toLowerCase();
    const instrumentName = (security.instrumentName || '').toLowerCase();

    // === STEP 1: Explicit Type/Status Check ===
    if (instrumentType && instrumentType !== 'equity' && instrumentType !== 'ordinary share') {
        return false;
    }

    // Must be Active
    if (security.status && security.status !== 'A' && security.status !== 'Active') {
        return false;
    }

    // === STEP 2: Sector-based Filtering ===
    if (sectorId === 66 || sector === 'mutual fund' || sector.includes('mutual fund')) {
        return false;
    }
    if (sector.includes('bond') || sector.includes('debenture')) {
        return false;
    }

    // === STEP 3: Smart Name Filtering (Funds/Schemes) ===
    const fundKeywords = ['fund', 'scheme', 'yojana', 'kosh', 'units'];
    if (fundKeywords.some(k => companyName.includes(k))) {
        const powerKeywords = ['pariyojana', 'project', 'hydro', 'hydropower', 'jalvidhyut', 'jalbidhyut', 'koshi'];
        if (!powerKeywords.some(k => companyName.includes(k))) {
            return false;
        }
    }

    // === STEP 4: Symbol Pattern Filtering ===
    if (/^[A-Z]{2,5}F\d*$/.test(symbol)) {
        const mfSuffixes = ['MF', 'LBS', 'LBSL'];
        if (!mfSuffixes.some(s => symbol.endsWith(s))) {
            return false;
        }
    }

    if (/[BD]\d{2,4}$/.test(symbol)) return false;
    if (/EB\d{2}$/.test(symbol)) return false;
    if (/\d{2}[_/]\d{2}/.test(symbol)) return false;
    if (/SY$/.test(symbol)) return false;
    if (/SF$/.test(symbol)) return false;

    if (symbol.endsWith('PO')) return false;

    // === STEP 5: Name Pattern Filtering ===
    if (companyName.includes('debenture') || companyName.includes('bond')) return false;
    if (instrumentName.includes('debenture') || instrumentName.includes('bond')) return false;
    if (companyName.includes('%')) return false;

    if (instrumentName.includes('promoter') || companyName.includes('promoter')) {
        return false;
    }

    return true;
};

module.exports = {
    isEquitySecurity
};
