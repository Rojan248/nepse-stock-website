const crypto = require('crypto');
const jwt = require('jsonwebtoken');

jest.mock('../../src/services/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const mockPrisma = {
    user: {
        findUnique: jest.fn()
    }
};

jest.mock('../../src/services/database/connection', () => ({
    prisma: mockPrisma
}));

const loadAuthMiddleware = () => {
    jest.resetModules();
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.NODE_ENV = 'test';
    return require('../../src/middleware/authMiddleware');
};

describe('auth middleware JWT verification', () => {
    const originalEnv = process.env;

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.clearAllMocks();
        jest.resetModules();
    });

    it('signs access tokens with HS256 and accepts active users', async () => {
        const { generateAccessToken, requireAuth } = loadAuthMiddleware();
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            lockedUntil: null,
            accessTokenVersion: 0
        });
        const token = generateAccessToken({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            accessTokenVersion: 0
        });

        expect(jwt.decode(token, { complete: true }).header.alg).toBe('HS256');
        expect(jwt.decode(token).accessTokenVersion).toBe(0);

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toMatchObject({ userId: 1, email: 'person@example.com', role: 'user' });
        expect(res.status).not.toHaveBeenCalled();
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 1 },
            select: {
                id: true,
                email: true,
                role: true,
                lockedUntil: true,
                accessTokenVersion: true
            }
        });
    });

    it('rejects unsigned alg none tokens even when the payload shape is valid', async () => {
        const { requireAuth } = loadAuthMiddleware();
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            userId: 1,
            email: 'person@example.com',
            role: 'user',
            exp: Math.floor(Date.now() / 1000) + 900
        })).toString('base64url');
        const unsignedToken = `${header}.${payload}.`;

        const req = { headers: { authorization: `Bearer ${unsignedToken}` } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Invalid token' }
        });
    });

    it('rejects validly signed tokens for deleted users', async () => {
        const { generateAccessToken, requireAuth } = loadAuthMiddleware();
        mockPrisma.user.findUnique.mockResolvedValue(null);
        const token = generateAccessToken({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            accessTokenVersion: 0
        });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Invalid token' }
        });
    });

    it('rejects validly signed tokens for locked users', async () => {
        const { generateAccessToken, requireAuth } = loadAuthMiddleware();
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
            accessTokenVersion: 0
        });
        const token = generateAccessToken({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            accessTokenVersion: 0
        });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Invalid token' }
        });
    });

    it('rejects validly signed tokens after the user access-token version changes', async () => {
        const { generateAccessToken, requireAuth } = loadAuthMiddleware();
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            lockedUntil: null,
            accessTokenVersion: 2
        });
        const token = generateAccessToken({
            id: 1,
            email: 'person@example.com',
            role: 'user',
            accessTokenVersion: 1
        });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Invalid token' }
        });
    });
});
