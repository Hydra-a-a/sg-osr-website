import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
    try {
        const ip = getClientIp(request);
        const limit = await checkRateLimit(`telemetry_${ip}`, 120, 60_000);
        if (!limit.success) {
            return NextResponse.json(
                { ok: false, error: 'Too many requests' },
                {
                    status: 429,
                    headers: {
                        ...NO_STORE_HEADERS,
                        'Retry-After': String(limit.retryAfter ?? 60),
                    },
                }
            );
        }

        const payload = await request.json();
        const event = String(payload?.event || '');
        const id = String(payload?.id || '');

        if (!event || !id) {
            return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE_HEADERS });
        }

        return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE_HEADERS });
    }
}
