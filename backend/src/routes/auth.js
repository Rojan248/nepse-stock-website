const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateAccessToken, JWT_SECRET, REFRESH_TOKEN_EXPIRY_DAYS, requireAuth, setRefreshCookie, clearRefreshCookie } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/utils/logger');

const SALT_ROUNDS = 12;

// ==================== Validation Helpers ====================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const validateRegistration = (email, password) => {
    const errors = [];
    if (!email || !EMAIL_RE.test(email)) errors.push('Valid email is required');
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    return errors;
};

// ==================== Token Helpers ====================

const createRefreshToken = async (userId) => {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
    return token;
};

const cleanExpiredTokens = async (userId) => {
    await prisma.refreshToken.deleteMany({
        where: { userId, expiresAt: { lt: new Date() } }
    });
};

// ==================== Routes ====================

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body;

    const errors = validateRegistration(email, password);
    if (errors.length > 0) {
        return res.status(400).json({ success: false, error: { message: errors.join('; ') } });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
        return res.status(409).json({ success: false, error: { message: 'Email already registered' } });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
        data: {
            email: email.toLowerCase(),
            passwordHash,
            displayName: displayName || null
        }
    });

    // Auto-create a default watchlist
    await prisma.watchlist.create({
        data: { name: 'My Watchlist', userId: user.id }
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    logger.info(`New user registered: ${user.email}`);
    res.status(201).json({
        success: true,
        data: {
            user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
            accessToken
        }
    });
}));

// POST /api/auth/login (rate limited: 5 attempts per 15 min per IP)
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: { message: 'Email and password required' } });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
        return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    }

    await cleanExpiredTokens(user.id);
    const accessToken = generateAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    logger.info(`User logged in: ${user.email}`);
    res.json({
        success: true,
        data: {
            user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
            accessToken
        }
    });
}));

// POST /api/auth/refresh — silent refresh via httpOnly cookie
router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ success: false, error: { message: 'No refresh token' } });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
        if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
        clearRefreshCookie(res);
        return res.status(401).json({ success: false, error: { message: 'Invalid or expired refresh token' } });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
        clearRefreshCookie(res);
        return res.status(401).json({ success: false, error: { message: 'User not found' } });
    }

    // Rotate: delete old, create new
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, newRefreshToken);

    res.json({
        success: true,
        data: {
            accessToken: newAccessToken,
            user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role }
        }
    });
}));

// POST /api/auth/logout — clear httpOnly cookie
router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    clearRefreshCookie(res);
    res.json({ success: true, data: { message: 'Logged out' } });
}));

// GET /api/auth/me — get current user profile
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, email: true, displayName: true, role: true, createdAt: true }
    });
    if (!user) {
        return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }
    res.json({ success: true, data: user });
}));

module.exports = router;
