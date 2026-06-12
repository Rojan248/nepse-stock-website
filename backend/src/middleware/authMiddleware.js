const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../services/utils/logger');
const { getSecretIssue } = require('../services/utils/securityConfig');
const { prisma } = require('../services/database/connection');

const resolveJwtSecret = () => {
    if (process.env.JWT_SECRET) {
        const issue = getSecretIssue('JWT_SECRET', process.env.JWT_SECRET);
        if (issue && process.env.NODE_ENV !== 'test') {
            throw new Error(issue);
        }
        return process.env.JWT_SECRET;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be configured in production');
    }
    return crypto.randomBytes(32).toString('hex');
};

const JWT_SECRET = resolveJwtSecret();
const JWT_ALGORITHM = 'HS256';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const LEGACY_REFRESH_COOKIE_NAME = 'refreshToken';
const HOST_REFRESH_COOKIE_NAME = '__Host-refreshToken';

const isProduction = () => process.env.NODE_ENV === 'production';
const getRefreshCookieName = () => (
    isProduction() ? HOST_REFRESH_COOKIE_NAME : LEGACY_REFRESH_COOKIE_NAME
);

const sendAuthFailure = (res, message) => res.status(401).json({
    success: false,
    error: { message }
});

const toTokenUser = (user) => ({
    userId: user.id,
    email: user.email,
    role: user.role
});

const getAccessTokenVersion = (value) => (
    Number.isSafeInteger(value) && value >= 0 ? value : 0
);

const verifyAccessToken = (token) => {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    if (!Number.isSafeInteger(decoded.userId) || decoded.userId <= 0) {
        throw new Error('Invalid token subject');
    }
    if (
        decoded.accessTokenVersion !== undefined
        && (!Number.isSafeInteger(decoded.accessTokenVersion) || decoded.accessTokenVersion < 0)
    ) {
        throw new Error('Invalid token version');
    }
    return decoded;
};

const findActiveTokenUser = async (decoded) => {
    const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
            id: true,
            email: true,
            role: true,
            lockedUntil: true,
            accessTokenVersion: true
        }
    });

    if (!user) return null;
    if (user.lockedUntil && user.lockedUntil > new Date()) return null;
    if (getAccessTokenVersion(decoded.accessTokenVersion) !== getAccessTokenVersion(user.accessTokenVersion)) {
        return null;
    }
    return user;
};

/**
 * Generate an access token for a user
 */
const generateAccessToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            accessTokenVersion: getAccessTokenVersion(user.accessTokenVersion)
        },
        JWT_SECRET,
        { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Middleware: require a valid JWT Bearer token.
 * Attaches req.user = { userId, email, role }
 */
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendAuthFailure(res, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAccessToken(token);
        const user = await findActiveTokenUser(decoded);
        if (!user) {
            return sendAuthFailure(res, 'Invalid token');
        }
        req.user = toTokenUser(user);
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
        logger.debug(`Auth failed: ${err.message}`);
        return sendAuthFailure(res, message);
    }
};

/**
 * Optional auth: if a valid token is present, attach req.user; otherwise proceed.
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAccessToken(token);
        const user = await findActiveTokenUser(decoded);
        if (user) req.user = toTokenUser(user);
    } catch {
        // Token invalid — proceed without user
    }
    next();
};

const getRefreshTokenFromRequest = (req) => {
    if (!req.cookies) return null;
    const currentToken = req.cookies[getRefreshCookieName()];
    if (currentToken) return currentToken;

    // Development/test keep the short cookie name so localhost HTTP remains easy.
    // Production intentionally ignores the legacy name to prevent sibling-domain cookie tossing.
    return isProduction() ? null : req.cookies[LEGACY_REFRESH_COOKIE_NAME] || null;
};

/**
 * Set refresh token as httpOnly cookie
 */
const setRefreshCookie = (res, token) => {
    res.cookie(getRefreshCookieName(), token, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'strict',
        path: isProduction() ? '/' : '/api/auth',
        maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });
};

/**
 * Clear refresh token cookie
 */
const clearRefreshCookie = (res) => {
    res.clearCookie(getRefreshCookieName(), {
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'strict',
        path: isProduction() ? '/' : '/api/auth'
    });

    if (isProduction()) {
        res.clearCookie(LEGACY_REFRESH_COOKIE_NAME, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/api/auth'
        });
    }
};

module.exports = {
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_DAYS,
    generateAccessToken,
    getRefreshCookieName,
    getRefreshTokenFromRequest,
    requireAuth,
    optionalAuth,
    setRefreshCookie,
    clearRefreshCookie
};
