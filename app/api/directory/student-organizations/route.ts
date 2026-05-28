import { NextResponse } from 'next/server';
import { fetchDirectoryData } from '@/app/api/directory/route';
import { toApiResponse } from '@/lib/api-errors';

export async function GET() {
    try {
        const payload = await fetchDirectoryData();
        return NextResponse.json({ leaders: payload.leaders, meta: payload.meta });
    } catch (error) {
        return toApiResponse(error);
    }
}

export const revalidate = 3600;
