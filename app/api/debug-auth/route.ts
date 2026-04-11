import { NextResponse } from 'next/server';
import { getAuthorizedUsers } from '@/lib/auth';
import { getSheetData } from '@/lib/sheets';
import { getAuthSheetConfig } from '@/lib/portal-mode';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const users = await getAuthorizedUsers();
        
        // Let's also do a raw fetch to debug the headers exactly
        const config = getAuthSheetConfig();
        const rawRows = config ? await getSheetData(config.spreadsheetId, config.range) : [];
        const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
        const firstRow = rows[0] || [];
        
        // Convert Map to array of objects for JSON serialization
        const userList = Array.from(users.entries()).map(([email, data]) => ({
            email,
            role: data.role,
        }));

        const specificUser = users.get('2023-100433@rtu.edu.ph') || 'NOT_FOUND';

        return NextResponse.json({ 
            status: 'success', 
            specificUserSearch: {
                email: '2023-100433@rtu.edu.ph',
                result: specificUser
            },
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
