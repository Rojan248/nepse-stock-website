const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DANGEROUS_BODY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_BODY_DEPTH = 16;
const MAX_ARRAY_LENGTH = 500;
const MAX_CONTAINER_COUNT = 1000;

const isApiRequest = (req) => {
    const path = req.originalUrl || req.url || '';
    return path === '/api' || path.startsWith('/api/');
};

const hasRequestBody = (req) => {
    if (req.headers['transfer-encoding']) return true;
    const contentLength = Number.parseInt(req.headers['content-length'] || '0', 10);
    return Number.isFinite(contentLength) && contentLength > 0;
};

const isUnsafeMethod = (req) => !SAFE_METHODS.has(req.method);

const isJsonContainer = (value) => value !== null && typeof value === 'object';

const isPlainJsonObject = (value) => (
    isJsonContainer(value)
    && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
);

const rejectBody = (res, message) => res.status(400).json({
    success: false,
    error: { message }
});

const inspectJsonShape = (body) => {
    if (!isPlainJsonObject(body)) {
        return { error: 'JSON body must be an object' };
    }

    const stack = [{ value: body, depth: 0 }];
    let containers = 0;

    while (stack.length > 0) {
        const { value, depth } = stack.pop();
        containers++;

        if (containers > MAX_CONTAINER_COUNT) {
            return { error: 'JSON body is too complex' };
        }
        if (depth > MAX_BODY_DEPTH) {
            return { error: 'JSON body is too deeply nested' };
        }

        if (Array.isArray(value)) {
            if (value.length > MAX_ARRAY_LENGTH) {
                return { error: 'JSON array is too large' };
            }
            for (const item of value) {
                if (isJsonContainer(item)) stack.push({ value: item, depth: depth + 1 });
            }
            continue;
        }

        if (!isPlainJsonObject(value)) {
            return { error: 'JSON body contains an invalid object' };
        }

        for (const key of Object.keys(value)) {
            if (DANGEROUS_BODY_KEYS.has(key.toLowerCase())) {
                return { error: `Invalid JSON body property: ${key}` };
            }

            const child = value[key];
            if (isJsonContainer(child)) stack.push({ value: child, depth: depth + 1 });
        }
    }

    return { ok: true };
};

const jsonBodyShapeGuard = (req, res, next) => {
    if (!isApiRequest(req) || !isUnsafeMethod(req) || !hasRequestBody(req)) {
        return next();
    }

    const result = inspectJsonShape(req.body);
    if (result.error) {
        return rejectBody(res, result.error);
    }

    return next();
};

module.exports = {
    inspectJsonShape,
    jsonBodyShapeGuard
};
