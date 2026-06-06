const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { errorHandler } = require('../../src/middleware/errorHandler');

const mockPrisma = {
    refreshToken: {
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn()
    },
    user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
    },
    watchlist: {
        create: jest.fn()
    }
};

jest.mock('../../src/services/database/connection', () => ({
    prisma: mockPrisma
}));

jest.mock('bcrypt', () => ({
    compare: jest.fn(),
    hash: jest.fn().mockResolvedValue('bcrypt-hash')
}));

jest.mock('../../src/middleware/rateLimiter', () => ({
    loginLimiter: (req, res, next) => next(),
    refreshLimiter: (req, res, next) => next(),
    registrationLimiter: (req, res, next) => next()
}));

jest.mock('../../src/middleware/authMiddleware', () => ({
    REFRESH_TOKEN_EXPIRY_DAYS: 7,
    clearRefreshCookie: jest.fn((res) => res.clearCookie('refreshToken')),
    generateAccessToken: jest.fn(() => 'access-token'),
    requireAuth: (req, res, next) => {
        req.user = { userId: 1, email: 'user@example.com', role: 'user' };
        next();
    },
    setRefreshCookie: jest.fn((res, token) => res.cookie('refreshToken', token))
}));

jest.mock('../../src/services/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', require('../../src/routes/auth'));
app.use(errorHandler);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

describe('auth route security hardening', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.refreshToken.findMany.mockResolvedValue([]);
        mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });
        mockPrisma.watchlist.create.mockResolvedValue({ id: 1 });
    });

    it('rejects non-string registration fields before database lookup', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: { nested: true }, password: 123456789012, displayName: ['Admin'] })
            .expect(400);

        expect(res.body.error.message).toContain('Valid email');
        expect(res.body.error.message).toContain('Password is required');
        expect(res.body.error.message).toContain('Display name must be text');
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('normalizes registration input and stores only a refresh token hash', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            displayName: 'Person',
            role: 'user'
        });

        await request(app)
            .post('/api/auth/register')
            .send({
                email: ' Person@Example.COM ',
                password: 'StrongPass123',
                displayName: '<b>Person</b>\u0000'
            })
            .expect(201);

        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'person@example.com' }
        });
        expect(mockPrisma.user.create).toHaveBeenCalledWith({
            data: {
                email: 'person@example.com',
                passwordHash: 'bcrypt-hash',
                displayName: 'Person'
            }
        });
        expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                token: expect.stringMatching(/^[a-f0-9]{64}$/),
                userId: 1,
                expiresAt: expect.any(Date)
            })
        });
    });

    it('rejects overlong bcrypt passwords before hashing', async () => {
        const longPassword = `StrongPass123${'x'.repeat(80)}`;

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'person@example.com',
                password: longPassword,
                displayName: 'Person'
            })
            .expect(400);

        expect(res.body.error.message).toContain('72 bytes');
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('rejects overlong emails before database lookup', async () => {
        const longEmail = `${'a'.repeat(250)}@example.com`;

        await request(app)
            .post('/api/auth/register')
            .send({
                email: longEmail,
                password: 'StrongPass123',
                displayName: 'Person'
            })
            .expect(400);

        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects non-string login input before database lookup', async () => {
        await request(app)
            .post('/api/auth/login')
            .send({ email: { nested: true }, password: ['bad'] })
            .expect(400);

        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects overlong login passwords before bcrypt comparison', async () => {
        await request(app)
            .post('/api/auth/login')
            .send({
                email: 'person@example.com',
                password: `StrongPass123${'x'.repeat(80)}`
            })
            .expect(400);

        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('locks an account after ten failed password attempts', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            passwordHash: 'hash',
            failedLoginAttempts: 9,
            lockedUntil: null
        });
        bcrypt.compare.mockResolvedValue(false);

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'person@example.com', password: 'WrongPassword123' })
            .expect(403);

        expect(mockPrisma.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                failedLoginAttempts: 10,
                lockedUntil: expect.any(Date)
            }
        });
    });

    it('looks up refresh tokens by hash and rotates them', async () => {
        const rawRefreshToken = 'raw-refresh-token';
        mockPrisma.refreshToken.findUnique.mockResolvedValue({
            id: 7,
            token: sha256(rawRefreshToken),
            userId: 1,
            expiresAt: new Date(Date.now() + 60_000)
        });
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            displayName: 'Person',
            role: 'user'
        });

        await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`refreshToken=${rawRefreshToken}`])
            .expect(200);

        expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
            where: { token: sha256(rawRefreshToken) }
        });
        expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 7 } });
        expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                token: expect.stringMatching(/^[a-f0-9]{64}$/),
                userId: 1
            })
        });
    });
});
