import { ApiError } from '@/lib/api-errors';

function getConfiguredProductionOrigin(): string | null {
    const configuredOrigin = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    if (!configuredOrigin || process.env.NODE_ENV !== 'production') {
        return null;
    }

    try {
        return new URL(configuredOrigin).origin;
    } catch {
        return null;
    }
}

function getRequestOrigin(request: Request): string | null {
    try {
        return new URL(request.url).origin;
    } catch {
        return null;
    }
}

export function resolveExpectedSameOrigin(request: Request): string | null {
    return getConfiguredProductionOrigin() || getRequestOrigin(request);
}

export function requireSameOriginRequest(request: Request): void {
    const expectedOrigin = resolveExpectedSameOrigin(request);
    const originHeader = request.headers.get('origin');

    if (!expectedOrigin || !originHeader) {
        throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
    }

    try {
        const actualOrigin = new URL(originHeader).origin;
        if (actualOrigin !== expectedOrigin) {
            throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
        }
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(403, 'FORBIDDEN', 'Forbidden');
    }
}
