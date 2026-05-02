import { NextResponse } from 'next/server';
import { fetchActiveAnnouncements } from '@/lib/announcements-server';

export const revalidate = 300;

export async function GET() {
    try {
        const data = await fetchActiveAnnouncements(12);
        return NextResponse.json(
            { data },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
                },
            },
        );
    } catch {
        return NextResponse.json({ data: [] }, { status: 200 });
    }
}
