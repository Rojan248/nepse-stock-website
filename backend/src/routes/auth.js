const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const {
    generateAccessToken,
    getRefreshTokenFromRequest,
    REFRESH_TOKEN_EXPIRY_DAYS,
    requireAuth,
    setRefreshCookie,
    clearRefreshCookie
} = require('../middleware/authMiddleware');
const { loginLimiter, registrationLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/utils/logger');

const SALT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$FDPRP8HzQmCHfKWx6Wnmxut1rXWyT/l3fjV94ywHHua45jcSOxQDS';
const INVALID_CREDENTIALS_RESPONSE = {
    success: false,
    error: { message: 'Invalid credentials' }
};
const REGISTRATION_PROCESSED_RESPONSE = {
    success: true,
    data: {
        message: 'Registration processed. Sign in to continue.'
    }
};

// ==================== Validation Helpers ====================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;
const MAX_DISPLAY_NAME_LENGTH = 80;

const normalizeEmail = (email) => {
    if (typeof email !== 'string') return null;
    const normalized = email.trim().toLowerCase();
    if (normalized.length > MAX_EMAIL_LENGTH) return null;
    return EMAIL_RE.test(normalized) ? normalized : null;
};

const sanitizeDisplayName = (displayName) => {
    if (displayName === undefined || displayName === null || displayName === '') {
        return { value: null };
    }
    if (typeof displayName !== 'string') {
        return { error: 'Display name must be text' };
    }

    const sanitized = displayName
        .replace(/<[^>]*>/g, '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .substring(0, MAX_DISPLAY_NAME_LENGTH);

    return { value: sanitized || null };
};

const validateRegistration = (email, password) => {
    const errors = [];
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) errors.push('Valid email is required');
    if (typeof password !== 'string' || password.length === 0) {
        errors.push('Password is required');
    } else {
        if (password.length < MIN_PASSWORD_LENGTH) {
            errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        }
        if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
            errors.push(`Password must be ${MAX_PASSWORD_BYTES} bytes or less`);
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
    }
    return { errors, email: normalizedEmail };
};

// ==================== Token Helpers ====================

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

const createRefreshToken = async (userId) => {
    // Clean expired ones first
    await cleanExpiredTokens(userId);

    // Enforce limit of 5 refresh tokens per user
    const tokens = await prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' }
    });

    if (tokens.length >= 5) {
        const deleteCount = tokens.length - 4; // leave room for the new one (total 5)
        const deleteIds = tokens.slice(0, deleteCount).map(t => t.id);
        await prisma.refreshToken.deleteMany({
            where: { id: { in: deleteIds } }
        });
    }

    const token = crypto.randomBytes(40).toString('hex');
    const hashedToken = hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: hashedToken, userId, expiresAt } });
    return token;
};

const cleanExpiredTokens = async (userId) => {
    await prisma.refreshToken.deleteMany({
        where: { userId, expiresAt: { lt: new Date() } }
    });
};

const revokeAccessTokens = async (userId) => {
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    await prisma.user.update({
        where: { id: userId },
        data: { accessTokenVersion: { increment: 1 } }
    });
};

const sendInvalidCredentials = (res) => {
    return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
};

const sendRegistrationProcessed = (res) => {
    return res.status(202).json(REGISTRATION_PROCESSED_RESPONSE);
};

const isPublicRegistrationEnabled = () => (
    process.env.NODE_ENV !== 'production'
    || process.env.PUBLIC_REGISTRATION_ENABLED === 'true'
);

// ==================== Routes ====================

// POST /api/auth/register (rate limited)
router.post('/register', registrationLimiter, asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body;

    const { errors, email: normalizedEmail } = validateRegistration(email, password);
    const displayNameResult = sanitizeDisplayName(displayName);
    if (displayNameResult.error) {
        errors.push(displayNameResult.error);
    }
    if (errors.length > 0) {
        return res.status(400).json({ success: false, error: { message: errors.join('; ') } });
    }

    if (!isPublicRegistrationEnabled()) {
        await bcrypt.hash(password, SALT_ROUNDS);
        logger.warn('Public registration request ignored because registration is disabled');
        return sendRegistrationProcessed(res);
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
        await bcrypt.hash(password, SALT_ROUNDS);
        logger.info(`Registration request processed for existing account: ${normalizedEmail}`);
        return sendRegistrationProcessed(res);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
        data: {
            email: normalizedEmail,
            passwordHash,
            displayName: displayNameResult.value
        }
    });

    // Auto-create a default watchlist
    await prisma.watchlist.create({
        data: { name: 'My Watchlist', userId: user.id }
    });

    logger.info(`New user registered: ${user.email}`);
    return sendRegistrationProcessed(res);
}));

// POST /api/auth/login (rate limited: 5 attempts per 15 min per IP)
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (
        !normalizedEmail
        || typeof password !== 'string'
        || password.length === 0
        || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES
    ) {
        return res.status(400).json({ success: false, error: { message: 'Email and password required' } });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_PASSWORD_HASH);

    if (!user) {
        return sendInvalidCredentials(res);
    }

    // Check if account is temporarily locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        logger.warn(`Locked account login attempt: ${user.email}`);
        return sendInvalidCredentials(res);
    }

    if (!valid) {
        const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
        let lockedUntil = null;

        if (newFailedAttempts >= 10) {
            lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
            logger.warn(`Account locked due to 10+ failed attempts: ${user.email}`);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: newFailedAttempts,
                lockedUntil,
                ...(lockedUntil ? { accessTokenVersion: { increment: 1 } } : {})
            }
        });

        if (newFailedAttempts >= 10) {
            return sendInvalidCredentials(res);
        }

        return sendInvalidCredentials(res);
    }

    // Reset failed login attempts on success
    if ((user.failedLoginAttempts || 0) > 0 || user.lockedUntil) {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null
            }
        });
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

// POST /api/auth/refresh — silent refresh via httpOnly cookie (rate limited)
router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
        return res.status(401).json({ success: false, error: { message: 'No refresh token' } });
    }

    const hashedToken = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { token: hashedToken } });
    if (!stored || stored.expiresAt < new Date()) {
        if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
        clearRefreshCookie(res);
        return res.status(401).json({ success: false, error: { message: 'Invalid or expired refresh token' } });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
        clearRefreshCookie(res);
        return res.status(401).json({ success: false, error: { message: 'Invalid or expired refresh token' } });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
        await prisma.refreshToken.delete({ where: { id: stored.id } });
        clearRefreshCookie(res);
        logger.warn(`Refresh blocked for locked account: ${user.email}`);
        return res.status(401).json({ success: false, error: { message: 'Invalid or expired refresh token' } });
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
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
        const hashedToken = hashToken(refreshToken);
        const stored = await prisma.refreshToken.findUnique({
            where: { token: hashedToken },
            select: { userId: true }
        });
        await prisma.refreshToken.deleteMany({ where: { token: hashedToken } });
        if (stored?.userId) {
            await revokeAccessTokens(stored.userId);
        }
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
        clearRefreshCookie(res);
        return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
    }
    res.json({ success: true, data: user });
}));

module.exports = router;
