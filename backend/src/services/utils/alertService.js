/**
 * Alert Service - Webhook-based Alerting
 * Sends notifications to Discord/Slack on failures
 */

const axios = require('axios');
const logger = require('./logger');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const ALERT_ENABLED = process.env.ALERT_ENABLED === 'true' || !!WEBHOOK_URL;

// Rate limiting - prevent alert spam
const alertCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per error type

// Daily digest state
const dailyStats = {
    successCount: 0,
    failureCount: 0,
    lastReset: new Date().toDateString(),
};

/**
 * Detect webhook type from URL
 * @param {string} url - Webhook URL
 * @returns {'discord'|'slack'|'generic'} Webhook type
 */
const detectWebhookType = (url) => {
    if (url.includes('discord.com') || url.includes('discordapp.com')) {
        return 'discord';
    }
    if (url.includes('hooks.slack.com')) {
        return 'slack';
    }
    return 'generic';
};

/**
 * Format message for specific webhook type
 * @param {string} message - Alert message
 * @param {'error'|'warning'|'success'|'info'} level - Alert level
 * @param {string} type - Webhook type
 * @returns {Object} Formatted payload
 */
const formatPayload = (message, level, type) => {
    const emoji = {
        error: '🚨',
        warning: '⚠️',
        success: '✅',
        info: 'ℹ️',
    };

    const colors = {
        error: 0xFF0000,   // Red
        warning: 0xFFA500, // Orange
        success: 0x00FF00, // Green
        info: 0x0000FF,    // Blue
    };

    const timestamp = new Date().toISOString();
    const prefix = emoji[level] || '📢';

    if (type === 'discord') {
        return {
            embeds: [{
                title: `${prefix} NEPSE Bot Alert`,
                description: message,
                color: colors[level],
                timestamp,
                footer: { text: 'NEPSE Stock Website' }
            }]
        };
    }

    if (type === 'slack') {
        return {
            blocks: [{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `${prefix} *NEPSE Bot:* ${message}`
                }
            }]
        };
    }

    // Generic JSON webhook
    return { message: `${prefix} ${message}`, level, timestamp };
};

/**
 * Send an alert to the configured webhook
 * @param {string} message - Alert message
 * @param {'error'|'warning'|'success'|'info'} level - Alert level
 * @param {string} errorKey - Unique key for rate limiting (optional)
 * @returns {Promise<boolean>} True if sent successfully
 */
const sendAlert = async (message, level = 'error', errorKey = null) => {
    // Check if alerting is enabled
    if (!ALERT_ENABLED || !WEBHOOK_URL) {
        logger.debug('[Alert] Alerting disabled or no webhook configured');
        return false;
    }

    // Rate limiting
    if (errorKey) {
        const lastAlert = alertCooldowns.get(errorKey);
        if (lastAlert && Date.now() - lastAlert < COOLDOWN_MS) {
            logger.debug(`[Alert] Rate limited: ${errorKey}`);
            return false;
        }
        alertCooldowns.set(errorKey, Date.now());
    }

    try {
        const webhookType = detectWebhookType(WEBHOOK_URL);
        const payload = formatPayload(message, level, webhookType);

        await axios.post(WEBHOOK_URL, payload, { timeout: 5000 });
        logger.info(`[Alert] Sent ${level} alert: ${message.substring(0, 50)}...`);
        return true;
    } catch (error) {
        logger.error(`[Alert] Failed to send alert: ${error.message}`);
        return false;
    }
};

/**
 * Record success for daily stats
 */
const recordSyncSuccess = () => {
    resetDailyStatsIfNeeded();
    dailyStats.successCount++;
};

/**
 * Record failure for daily stats
 */
const recordSyncFailure = () => {
    resetDailyStatsIfNeeded();
    dailyStats.failureCount++;
};

/**
 * Reset daily stats at midnight
 */
const resetDailyStatsIfNeeded = () => {
    const today = new Date().toDateString();
    if (dailyStats.lastReset !== today) {
        dailyStats.successCount = 0;
        dailyStats.failureCount = 0;
        dailyStats.lastReset = today;
    }
};

/**
 * Send daily digest summary
 * Call this at end of market day (e.g., 3:30 PM)
 */
const sendDailyDigest = async () => {
    if (!ALERT_ENABLED || !WEBHOOK_URL) return;

    resetDailyStatsIfNeeded();

    const { successCount, failureCount } = dailyStats;
    const total = successCount + failureCount;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

    const status = failureCount === 0 ? 'success' : (successRate >= 90 ? 'warning' : 'error');
    const message = `📊 **Daily Sync Report**
• Total Syncs: ${total}
• Successful: ${successCount}
• Failed: ${failureCount}
• Success Rate: ${successRate}%`;

    await sendAlert(message, status);
};

/**
 * Get alert service status
 */
const getAlertStatus = () => ({
    enabled: ALERT_ENABLED,
    webhookConfigured: !!WEBHOOK_URL,
    webhookType: WEBHOOK_URL ? detectWebhookType(WEBHOOK_URL) : null,
    dailyStats: { ...dailyStats },
    cooldownMs: COOLDOWN_MS,
});

module.exports = {
    sendAlert,
    recordSyncSuccess,
    recordSyncFailure,
    sendDailyDigest,
    getAlertStatus,
};
