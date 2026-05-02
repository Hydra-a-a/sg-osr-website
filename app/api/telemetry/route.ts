import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const event = String(payload?.event || '');
        const id = String(payload?.id || '');

        if (!event || !id) {
            return NextResponse.json({ ok: false }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
}
