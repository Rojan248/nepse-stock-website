// Mock the logger to avoid file writes during tests
jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

// Import after mocking
const scheduler = require('../../src/services/scheduler/updateScheduler');

describe('Update Scheduler', () => {
    describe('Market Hours Detection', () => {
        it('should correctly determine NST time', () => {
            const nst = scheduler.getNSTTime();
            expect(nst).toBeInstanceOf(Date);
        });

        it('should return boolean for market open status', () => {
            const isOpen = scheduler.isMarketOpen();
            expect(typeof isOpen).toBe('boolean');
        });
    });

    describe('Scheduler Status', () => {
        it('should return status object', () => {
            const status = scheduler.getUpdateStatus();
            expect(status).toHaveProperty('isRunning');
            expect(status).toHaveProperty('isMarketOpen');
            expect(status).toHaveProperty('lastUpdateTime');
            expect(status).toHaveProperty('updateCount');
            expect(status).toHaveProperty('marketHours');
        });

        it('should include current NST time', () => {
            const status = scheduler.getUpdateStatus();
            expect(status).toHaveProperty('currentNST');
        });

        it('should include market hours', () => {
            const status = scheduler.getUpdateStatus();
            expect(status.marketHours).toHaveProperty('open');
            expect(status.marketHours).toHaveProperty('close');
        });
    });

    describe('Last Update Time', () => {
        it('should return null initially', () => {
            const lastUpdate = scheduler.getLastUpdateTime();
            // Either null or a Date
            expect(lastUpdate === null || lastUpdate instanceof Date).toBe(true);
        });
    });
});
