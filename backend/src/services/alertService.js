const axios = require('axios');
const logger = require('./utils/logger');

// Cache to prevent alert spamming (debounce)
let lastAlertTime = 0;
const ALERT_COOLDOWN = 1000 * 60 * 30; // 30 minutes between alerts

/**
 * Send an alert to the configured webhook
 * @param {string} message - The error message to send
 * @param {string} level - 'error' | 'warning' | 'info'
 */
const sendAlert = async (message, level = 'error') => {
    const enabled = process.env.ALERT_ENABLED === 'true';
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!enabled || !webhookUrl) {
        return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN) {
        logger.debug('Alert suppressed due to cooldown');
        return;
    }

    try {
        const color = level === 'error' ? 15158332 : (level === 'warning' ? 15105570 : 3447003); // Red, Orange, Blue

        const payload = {
            embeds: [{
                title: `NEPSE API ${level.toUpperCase()}`,
                description: message,
                color: color,
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Env: ${process.env.NODE_ENV || 'development'}`
                }
            }]
        };

        await axios.post(webhookUrl, payload);
        lastAlertTime = now;
        logger.info(`Alert sent to webhook: ${message}`);
    } catch (error) {
        logger.error(`Failed to send alert webhook: ${error.message}`);
    }
};

module.exports = {
    sendAlert
};
