import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { OfficerSchema } from '@/schemas/directory';
import { rateLimit } from '@/lib/rate-limit';

// cache for an hour. don't hit google sheets every time or they ban us.
export const revalidate = 3600;

export async function GET(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const limit = rateLimit(`dir_api_${ip}`, 30, 60000); // 30 requests per minute per IP

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DIRECTORY_ID;
        const RANGE = 'Officers!A2:G';

        if (!SPREADSHEET_ID) {
            return NextResponse.json(
                { error: 'Missing configuration: GOOGLE_SHEETS_DIRECTORY_ID' },
                { status: 500 }
            );
        }

        const rawData = await getSheetData(SPREADSHEET_ID, RANGE);

        if (!rawData || rawData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const validOfficers: any[] = [];
        const validationErrors: any[] = [];

        rawData.forEach((row, index) => {
            // dumping sheet rows into the object
            const officerData = {
                id: row[0] || `auto-${index}`,
                name: row[1] || '',
                position: row[2] || '',
                branch: row[3] || '',
                facebookUrl: row[4] || undefined,
                linkedinUrl: row[5] || undefined,
                priority: row[6] ? parseInt(row[6], 10) : undefined,
            };

            const result = OfficerSchema.safeParse(officerData);

            if (result.success) {
                validOfficers.push(result.data);
            } else {
                // someone messed up the sheet formatting again
                console.warn(`Row ${index + 2} skipped:`, result.error.format());
                validationErrors.push({ row: index + 2 });
            }
        });

        return NextResponse.json({
            data: validOfficers,
            meta: {
                total: rawData.length,
                valid: validOfficers.length,
                invalid: validationErrors.length
            }
        });

    } catch (error) {
        console.error('Directory API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch directory data' },
            { status: 500 }
        );
    }
}
