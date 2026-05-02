import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { CommuteRequestSchema } from '@/schemas/commute';
import { resolveCommuteRoute } from '@/lib/commute-providers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        // 1. Feature Flag Check
        if (process.env.COMMUTER_MAPS_ENABLED === 'false') {
            throw new ApiError(404, 'FEATURE_DISABLED', 'Commuter Maps feature is currently disabled.');
        }

        // 2. Rate Limiting (15 req/min per IP)
        const ip = getClientIp(request);
        const limit = await checkRateLimit(`commute_maps_${ip}`, 15, 60_000);

        if (!limit.success) {
            throw new ApiError(429, 'RATE_LIMITED', 'Too many route requests. Please wait a moment before trying again.');
        }

        // 3. Request Validation
        let body;
        try {
            body = await request.json();
        } catch {
            throw new ApiError(400, 'INVALID_JSON', 'Invalid request body format.');
        }

        const validation = CommuteRequestSchema.safeParse(body);
        if (!validation.success) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid search parameters.', validation.error.flatten().fieldErrors);
        }

        const { origin, destination } = validation.data;

        // 4. Resolve Route (Google API or Curated Fallback)
        const commuteData = await resolveCommuteRoute(origin, destination);

        // 5. Return Envelope
        return NextResponse.json({
            data: commuteData,
        });

    } catch (error) {
        console.error('[Commute API] Request failed:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
