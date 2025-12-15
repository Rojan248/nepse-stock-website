const {
    handleFetchError,
    handleDatabaseError,
    createErrorResponse,
    logAndRecover
} = require('../../src/services/utils/errorHandler');

// Mock logger
jest.mock('../../src/services/utils/logger', () => ({
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

describe('Error Handler Utilities', () => {
    describe('handleFetchError', () => {
        it('should handle network errors', () => {
            const error = new Error('Network Error');
            error.code = 'ECONNREFUSED';

            const result = handleFetchError(error);

            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('message');
            expect(result).toHaveProperty('timestamp');
        });

        it('should handle HTTP errors', () => {
            const error = new Error('Request failed');
            error.response = { status: 500, statusText: 'Internal Server Error' };

            const result = handleFetchError(error);

            expect(result.type).toBe('HTTP_ERROR');
            expect(result.status).toBe(500);
        });

        it('should handle timeout errors', () => {
            const error = new Error('Timeout');
            error.code = 'ECONNABORTED';

            const result = handleFetchError(error);

            expect(result.type).toBe('TIMEOUT_ERROR');
        });
    });

    describe('handleDatabaseError', () => {
        it('should handle validation errors', () => {
            const error = new Error('Validation failed');
            error.name = 'ValidationError';
            error.errors = { field1: {} };

            const result = handleDatabaseError(error);

            expect(result.type).toBe('VALIDATION_ERROR');
        });

        it('should handle duplicate key errors', () => {
            const error = new Error('Duplicate key');
            error.code = 11000;

            const result = handleDatabaseError(error);

            expect(result.type).toBe('DUPLICATE_KEY_ERROR');
        });
    });

    describe('createErrorResponse', () => {
        it('should create standardized error response', () => {
            const response = createErrorResponse(400, 'Bad Request');

            expect(response.success).toBe(false);
            expect(response.error.code).toBe(400);
            expect(response.error.message).toBe('Bad Request');
            expect(response.error).toHaveProperty('timestamp');
        });

        it('should include details when provided', () => {
            const response = createErrorResponse(400, 'Bad Request', { field: 'test' });

            expect(response.error.details).toEqual({ field: 'test' });
        });
    });

    describe('logAndRecover', () => {
        it('should return fallback value', () => {
            const error = new Error('Test error');
            const fallback = { default: true };

            const result = logAndRecover(error, fallback, 'Test operation');

            expect(result).toEqual(fallback);
        });
    });
});
