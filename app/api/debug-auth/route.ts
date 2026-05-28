import { NextResponse } from 'next/server';
import { getAuthorizedUsers } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function isDebugAuthRouteEnabled(): boolean {
    return process.env.NODE_ENV !== 'production'
        && process.env.ENABLE_AUTH_DEBUG_ROUTE === 'true';
}

export async function GET() {
    if (!isDebugAuthRouteEnabled()) {
        return withNoStore(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    }

    try {
        const users = await getAuthorizedUsers();
        
        const spreadsheetId = process.env.GOOGLE_SHEETS_AUTH_ID;
        const envTab = process.env.GOOGLE_SHEETS_AUTH_TAB || 'SL Access';
        const tabNameOnly = envTab.split('!')[0];
        const config = spreadsheetId ? { spreadsheetId, range: `${tabNameOnly}!A1:Z1000` } : null;
        const rawRows = config ? await getSheetData(config.spreadsheetId, config.range) : [];
        const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
        const firstRow = rows[0] || [];
        
        // Convert Map to array of objects for JSON serialization
        const userList = Array.from(users.entries()).map(([email, data]) => ({
            email,
            role: data.role,
        }));

        return withNoStore(NextResponse.json({
            status: 'success', 
            diagnostics: {
                headersRaw: firstRow,
                firstDataRow: rows[1] || [],
            },
            totalUsers: userList.length,
        }));
    } catch (error) {
        return withNoStore(NextResponse.json({
            status: 'error', 
            message: 'Debug auth diagnostics failed',
        }, { status: 500 }));
    }
}
