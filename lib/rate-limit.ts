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

interface RateLimitResult {
    success: boolean;
    remaining: number;
    retryAfter?: number;
}

// Clean up expired entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStore() {
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        for (const key in store) {
            if (store[key].resetTime < now) {
                delete store[key];
            }
        }
        lastCleanup = now;
    }
}

export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitResult {
    cleanupStore();

    const now = Date.now();
    const record = store[identifier];

    if (!record || now > record.resetTime) {
        store[identifier] = { count: 1, resetTime: now + windowMs };
        return { success: true, remaining: limit - 1 };
    }

    if (record.count >= limit) {
        return { success: false, remaining: 0 };
    }

    record.count += 1;
    return { success: true, remaining: limit - record.count };
}

async function upstashIncrAndExpire(key: string, windowSeconds: number): Promise<number | null> {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return null;
    }

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    const encodedKey = encodeURIComponent(key);
    const incrRes = await fetch(`${url}/incr/${encodedKey}`, { headers, cache: 'no-store' });
    if (!incrRes.ok) {
        return null;
    }

    const incrJson = await incrRes.json() as { result?: number | string };
    const count = Number(incrJson.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) {
        return null;
    }

    if (count === 1) {
        await fetch(`${url}/expire/${encodedKey}/${windowSeconds}`, {
            method: 'POST',
            headers,
            cache: 'no-store',
        });
    }

    return count;
}

/**
 * Dedicated rate limiter for login attempts.
 * Allows 5 attempts per IP per 15-minute window.
 */
export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
    return checkRateLimit(`auth:${ip}`, 5, 15 * 60 * 1000);
}

export async function checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    try {
        const sharedCount = await upstashIncrAndExpire(identifier, windowSeconds);

        if (sharedCount !== null) {
            if (sharedCount > limit) {
                return { success: false, remaining: 0, retryAfter: windowSeconds };
            }

            return {
                success: true,
                remaining: Math.max(0, limit - sharedCount),
                retryAfter: windowSeconds,
            };
        }
    } catch {
    }

    return rateLimit(identifier, limit, windowMs);
}
