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
const authMiddleware = require('../../src/middleware/authMiddleware');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', require('../../src/routes/auth'));
app.use(errorHandler);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

describe('auth route security hardening', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalPublicRegistrationEnabled = process.env.PUBLIC_REGISTRATION_ENABLED;

    beforeEach(() => {
        jest.clearAllMocks();
        bcrypt.compare.mockReset();
        mockPrisma.refreshToken.findMany.mockResolvedValue([]);
        mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });
        mockPrisma.watchlist.create.mockResolvedValue({ id: 1 });
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalPublicRegistrationEnabled === undefined) {
            delete process.env.PUBLIC_REGISTRATION_ENABLED;
        } else {
            process.env.PUBLIC_REGISTRATION_ENABLED = originalPublicRegistrationEnabled;
        }
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

    it('normalizes registration input without issuing a session token', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            displayName: 'Person',
            role: 'user'
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: ' Person@Example.COM ',
                password: 'StrongPass123',
                displayName: '<b>Person</b>\u0000'
            })
            .expect(202);

        expect(res.body).toEqual({
            success: true,
            data: { message: 'Registration processed. Sign in to continue.' }
        });
        expect(res.headers['set-cookie']).toBeUndefined();
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
        expect(mockPrisma.watchlist.create).toHaveBeenCalledWith({
            data: { name: 'My Watchlist', userId: 1 }
        });
        expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
        expect(authMiddleware.generateAccessToken).not.toHaveBeenCalled();
        expect(authMiddleware.setRefreshCookie).not.toHaveBeenCalled();
    });

    it('returns the same generic registration response for existing accounts', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            passwordHash: 'hash'
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'person@example.com',
                password: 'StrongPass123',
                displayName: 'Different Person'
            })
            .expect(202);

        expect(res.body).toEqual({
            success: true,
            data: { message: 'Registration processed. Sign in to continue.' }
        });
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123', 12);
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
        expect(mockPrisma.watchlist.create).not.toHaveBeenCalled();
        expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
        expect(authMiddleware.generateAccessToken).not.toHaveBeenCalled();
        expect(authMiddleware.setRefreshCookie).not.toHaveBeenCalled();
    });

    it('ignores public registration in production unless explicitly enabled', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.PUBLIC_REGISTRATION_ENABLED;

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'person@example.com',
                password: 'StrongPass123',
                displayName: 'Person'
            })
            .expect(202);

        expect(res.body).toEqual({
            success: true,
            data: { message: 'Registration processed. Sign in to continue.' }
        });
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123', 12);
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
        expect(mockPrisma.watchlist.create).not.toHaveBeenCalled();
        expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
        expect(authMiddleware.generateAccessToken).not.toHaveBeenCalled();
        expect(authMiddleware.setRefreshCookie).not.toHaveBeenCalled();
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

    it('uses a dummy bcrypt comparison and generic response for unknown login emails', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        bcrypt.compare.mockResolvedValue(false);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'missing@example.com', password: 'WrongPassword123' })
            .expect(401);

        expect(res.body.error.message).toBe('Invalid credentials');
        expect(bcrypt.compare).toHaveBeenCalledWith(
            'WrongPassword123',
            expect.stringMatching(/^\$2b\$12\$/)
        );
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('keeps locked account responses generic', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            passwordHash: 'hash',
            failedLoginAttempts: 10,
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
        });
        bcrypt.compare.mockResolvedValue(true);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'person@example.com', password: 'CorrectPassword123' })
            .expect(401);

        expect(res.body.error.message).toBe('Invalid credentials');
        expect(bcrypt.compare).toHaveBeenCalledWith('CorrectPassword123', 'hash');
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('locks an account after ten failed password attempts without exposing lock state', async () => {
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
            .expect(401);

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

    it('revokes refresh tokens for locked accounts instead of minting a new access token', async () => {
        const rawRefreshToken = 'raw-refresh-token';
        mockPrisma.refreshToken.findUnique.mockResolvedValue({
            id: 8,
            token: sha256(rawRefreshToken),
            userId: 1,
            expiresAt: new Date(Date.now() + 60_000)
        });
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            displayName: 'Person',
            role: 'user',
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`refreshToken=${rawRefreshToken}`])
            .expect(401);

        expect(res.body.error.message).toBe('Invalid or expired refresh token');
        expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 8 } });
        expect(authMiddleware.clearRefreshCookie).toHaveBeenCalled();
        expect(authMiddleware.generateAccessToken).not.toHaveBeenCalled();
        expect(authMiddleware.setRefreshCookie).not.toHaveBeenCalled();
        expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('revokes stale refresh tokens for deleted users without revealing account state', async () => {
        const rawRefreshToken = 'raw-refresh-token';
        mockPrisma.refreshToken.findUnique.mockResolvedValue({
            id: 9,
            token: sha256(rawRefreshToken),
            userId: 1,
            expiresAt: new Date(Date.now() + 60_000)
        });
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`refreshToken=${rawRefreshToken}`])
            .expect(401);

        expect(res.body.error.message).toBe('Invalid or expired refresh token');
        expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 9 } });
        expect(authMiddleware.clearRefreshCookie).toHaveBeenCalled();
        expect(authMiddleware.generateAccessToken).not.toHaveBeenCalled();
        expect(authMiddleware.setRefreshCookie).not.toHaveBeenCalled();
        expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('keeps auth/me generic if the authenticated user disappears mid-request', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer access-token')
            .expect(401);

        expect(res.body.error.message).toBe('Invalid token');
        expect(authMiddleware.clearRefreshCookie).toHaveBeenCalled();
    });
});
