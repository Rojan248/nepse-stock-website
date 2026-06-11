const USER_RESOURCE_LIMITS = Object.freeze({
    watchlists: 25,
    watchlistItems: 250,
    portfolios: 25,
    tradesPerPortfolio: 500,
    alerts: 100
});

const quotaExceeded = (res, label, limit) => res.status(409).json({
    success: false,
    error: { message: `${label} limit reached (${limit})` }
});

const ensureResourceLimit = async ({ count, limit, label, res }) => {
    if (count >= limit) {
        quotaExceeded(res, label, limit);
        return false;
    }
    return true;
};

module.exports = {
    USER_RESOURCE_LIMITS,
    ensureResourceLimit,
    quotaExceeded
};
