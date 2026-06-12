const USER_RESOURCE_LIMITS = Object.freeze({
    watchlists: 25,
    watchlistItems: 250,
    portfolios: 25,
    tradesPerPortfolio: 500,
    alerts: 100
});

class ResourceQuotaError extends Error {
    constructor(label, limit) {
        super(`${label} limit reached (${limit})`);
        this.name = 'ResourceQuotaError';
        this.label = label;
        this.limit = limit;
    }
}

const quotaExceeded = (res, label, limit) => res.status(409).json({
    success: false,
    error: { message: `${label} limit reached (${limit})` }
});

const assertResourceLimit = ({ count, limit, label }) => {
    if (count >= limit) {
        throw new ResourceQuotaError(label, limit);
    }
};

const assertResourceCapacity = ({ currentCount, requestedCount, limit, label }) => {
    if (currentCount + requestedCount > limit) {
        throw new ResourceQuotaError(label, limit);
    }
};

const isResourceQuotaError = (error) => error?.name === 'ResourceQuotaError'
    && error.label
    && Number.isInteger(error.limit);

const sendResourceQuotaError = (res, error) => {
    if (!isResourceQuotaError(error)) return false;
    quotaExceeded(res, error.label, error.limit);
    return true;
};

module.exports = {
    ResourceQuotaError,
    USER_RESOURCE_LIMITS,
    assertResourceCapacity,
    assertResourceLimit,
    quotaExceeded,
    sendResourceQuotaError
};
