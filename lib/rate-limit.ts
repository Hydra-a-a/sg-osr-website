/**
 * Simple in-memory rate limiter for serverless environments.
 * Note: In Vercel serverless, memory is not shared across instances. 
 * For true global rate limiting, a service like Upstash Redis would be required.
 * However, this provides a basic defense against single-instance abuse.
 */

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    }
}

const store: RateLimitStore = {};

export function rateLimit(identifier: string, limit: number, windowMs: number): { success: boolean, remaining: number } {
    const now = Date.now();
    const record = store[identifier];

    if (!record) {
        store[identifier] = { count: 1, resetTime: now + windowMs };
        return { success: true, remaining: limit - 1 };
    }

    if (now > record.resetTime) {
        store[identifier] = { count: 1, resetTime: now + windowMs };
        return { success: true, remaining: limit - 1 };
    }

    if (record.count >= limit) {
        return { success: false, remaining: 0 };
    }

    record.count += 1;
    return { success: true, remaining: limit - record.count };
}
