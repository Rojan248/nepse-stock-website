/**
 * String Utility Functions
 */

/**
 * Purify string sequentially
 * @param {string} str
 */
const normalizeString = (str) => {
    return str.normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '_')
        .toLowerCase()
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

/**
 * Resolves key collisions using a fallback or timestamp suffix
 */
const resolveCollisionKey = (key, fallbackId, existingKeys) => {
    if (!existingKeys || !existingKeys.has(key)) return key;
    const suffix = fallbackId || Date.now().toString(36);
    return `${key}_${suffix}`;
};

/**
 * Generate a safe, normalized key from a company name
 * - Normalizes unicode to NFKD form
 * - Replaces non-alphanumeric characters with underscores
 * - Converts to lowercase
 * - Collapses consecutive underscores
 * - Trims leading/trailing underscores
 * @param {string} companyName - The company name to normalize
 * @param {string} fallbackId - Fallback ID if name is empty/missing
 * @param {Map} existingKeys - Map of existing keys to check for collisions
 * @returns {string} A safe, unique key
 */
const generateSafeKey = (companyName, fallbackId = null, existingKeys = null) => {
    if (!companyName || typeof companyName !== 'string') {
        return fallbackId || `ipo_${Date.now()}`;
    }

    let key = normalizeString(companyName);

    // If key is empty after processing, use fallback
    if (!key) {
        return fallbackId || `ipo_${Date.now()}`;
    }

    return resolveCollisionKey(key, fallbackId, existingKeys);
};

module.exports = {
    generateSafeKey
};
