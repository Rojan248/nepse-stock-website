const repository = require('./summaryRepository');
const { startOfNepalDate } = require('./tradingCalendar');

const toFiniteNumber = (value, fallback = 0) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
};

function normalizeBudgetUsd(value) {
    return Math.max(0, toFiniteNumber(value, 0));
}

function buildBudgetResult({ budgetUsd, spentUsd, pendingCostUsd = 0, dayStart }) {
    const projectedSpendUsd = Number((spentUsd + pendingCostUsd).toFixed(8));
    const remainingUsd = Number(Math.max(0, budgetUsd - projectedSpendUsd).toFixed(8));

    return {
        enforced: budgetUsd > 0,
        allowed: budgetUsd <= 0 || projectedSpendUsd < budgetUsd,
        budgetUsd,
        spentUsd,
        pendingCostUsd,
        projectedSpendUsd,
        remainingUsd,
        dayStart
    };
}

async function getDailyBudgetState(config = {}, options = {}) {
    const budgetUsd = normalizeBudgetUsd(config.dailyBudgetUsd);
    const dayStart = options.dayStart || startOfNepalDate(options.now || new Date());
    const pendingCostUsd = normalizeBudgetUsd(options.pendingCostUsd);

    if (budgetUsd <= 0) {
        return buildBudgetResult({ budgetUsd, spentUsd: 0, pendingCostUsd, dayStart });
    }

    const spentUsd = await repository.getEstimatedCostSince(dayStart);
    return buildBudgetResult({
        budgetUsd,
        spentUsd: normalizeBudgetUsd(spentUsd),
        pendingCostUsd,
        dayStart
    });
}

async function enforceDailyBudget(config, options = {}) {
    const state = await getDailyBudgetState(config, options);
    if (!state.enforced || state.allowed) return state;
    return {
        ...state,
        reason: 'budget-exceeded'
    };
}

function budgetSkippedResult(state) {
    return {
        skipped: true,
        reason: state.reason || 'budget-exceeded',
        budgetUsd: state.budgetUsd,
        spentUsd: state.spentUsd,
        remainingUsd: state.remainingUsd
    };
}

module.exports = {
    enforceDailyBudget,
    getDailyBudgetState,
    budgetSkippedResult,
    normalizeBudgetUsd
};
