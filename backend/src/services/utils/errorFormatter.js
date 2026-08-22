/**
 * Compact single-line error description for logs.
 * Prisma error messages are multi-line and can render as empty
 * when interpolated naively; this keeps the code and a trimmed message.
 */
const describeError = (error) => {
    if (!error) return 'unknown error';
    const code = error.code ? `[${error.code}] ` : '';
    const message = String(error.message || error).replace(/\s+/g, ' ').trim();
    return `${code}${message.slice(0, 300)}`;
};

module.exports = {
    describeError
};
