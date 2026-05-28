const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../services/utils/logger');

const resolveJwtSecret = () => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be configured in production');
    }
    return crypto.randomBytes(32).toString('hex');
};

const JWT_SECRET = resolveJwtSecret();
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Generate an access token for a user
 */
const generateAccessToken = (user) => {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Middleware: require a valid JWT Bearer token.
 * Attaches req.user = { userId, email, role }
 */
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: { message: 'Authentication required' }
        });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
        logger.debug(`Auth failed: ${err.message}`);
        return res.status(401).json({
            success: false,
            error: { message }
        });
    }
};

/**
 * Optional auth: if a valid token is present, attach req.user; otherwise proceed.
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
    } catch {
        // Token invalid — proceed without user
    }
    next();
};

/**
 * Set refresh token as httpOnly cookie
 */
const setRefreshCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });
};

/**
 * Clear refresh token cookie
 */
const clearRefreshCookie = (res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth'
    });
};

module.exports = {
    JWT_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_DAYS,
    generateAccessToken,
    requireAuth,
    optionalAuth,
    setRefreshCookie,
    clearRefreshCookie
};
