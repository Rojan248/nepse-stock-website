const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('../services/utils/logger');

// Use env variable or default relative to this file
// This file is in src/utils, so data is in ../../../data
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', '..', 'data');

/**
 * Write JSON to file atomically (Async)
 * Writes to .tmp file first, then renames
 * @param {string} filename - Filename (e.g. 'stocks.json')
 * @param {any} data - Data to write
 */
async function safeWriteJson(filename, data) {
    const targetPath = path.join(DATA_DIR, filename);
    const tempPath = `${targetPath}.tmp`;

    try {
        // 1. Write to a temporary file first
        await fsPromises.writeFile(tempPath, JSON.stringify(data, null, 2));

        // 2. Atomic rename (overwrites targetPath instantly)
        await fsPromises.rename(tempPath, targetPath);

        logger.debug(`[Storage] Successfully saved ${filename}`);
        return true;
    } catch (error) {
        logger.error(`[Storage] Failed to save ${filename}: ${error.message}`);
        // Attempt to clean up temp file if rename failed
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) { }
        throw error;
    }
}

/**
 * Write JSON to file atomically (Sync)
 * Used for shutdown persistence
 * @param {string} filename - Filename (e.g. 'stocks.json')
 * @param {any} data - Data to write
 */
function safeWriteJsonSync(filename, data) {
    const targetPath = path.join(DATA_DIR, filename);
    const tempPath = `${targetPath}.tmp`;

    try {
        // 1. Write to a temporary file first
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));

        // 2. Atomic rename
        fs.renameSync(tempPath, targetPath);

        logger.debug(`[Storage] Successfully saved ${filename} (Sync)`);
        return true;
    } catch (error) {
        logger.error(`[Storage] Failed to save ${filename} (Sync): ${error.message}`);
        // Attempt to clean up temp file if rename failed
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) { }
        throw error;
    }
}

module.exports = {
    safeWriteJson,
    safeWriteJsonSync,
    saveData: safeWriteJson, // Alias to satisfy the requirement
    DATA_DIR
};
