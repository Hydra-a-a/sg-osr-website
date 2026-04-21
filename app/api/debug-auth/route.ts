import { NextResponse } from 'next/server';
import { getAuthorizedUsers } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
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

        return NextResponse.json({ 
            status: 'success', 
            diagnostics: {
                headersRaw: firstRow,
                firstDataRow: rows[1] || [],
            },
            totalUsers: userList.length,
        });
    } catch (error) {
        return NextResponse.json({ 
            status: 'error', 
            message: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}
