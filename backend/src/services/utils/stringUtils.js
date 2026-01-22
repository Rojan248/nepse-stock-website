/**
 * String Utility Functions
 */

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

    // Normalize unicode (NFKD decomposes characters)
    let key = companyName.normalize('NFKD');

    // Remove diacritical marks (combining characters)
    key = key.replace(/[\u0300-\u036f]/g, '');

    // Replace all non-alphanumeric ASCII characters with underscores
    key = key.replace(/[^A-Za-z0-9]/g, '_');

    // Convert to lowercase
    key = key.toLowerCase();

    // Collapse consecutive underscores
    key = key.replace(/_+/g, '_');

    // Trim leading/trailing underscores
    key = key.replace(/^_+|_+$/g, '');

    // If key is empty after processing, use fallback
    if (!key) {
        return fallbackId || `ipo_${Date.now()}`;
    }

    // Check for collisions if existingKeys map is provided
    if (existingKeys && existingKeys.has(key)) {
        // Append fallbackId or timestamp to make unique
        const suffix = fallbackId || Date.now().toString(36);
        key = `${key}_${suffix}`;
    }

    return key;
};

module.exports = {
    generateSafeKey
};
