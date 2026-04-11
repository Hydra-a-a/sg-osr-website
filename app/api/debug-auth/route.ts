import { NextResponse } from 'next/server';
import { getAuthorizedUsers } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const users = await getAuthorizedUsers();
        return NextResponse.json({
            count: users.size,
            users: Object.fromEntries(users)
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
    }
}
