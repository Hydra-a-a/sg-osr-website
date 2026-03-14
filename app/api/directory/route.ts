import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { OfficerSchema } from '@/schemas/directory';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';

// cache for an hour. don't hit google sheets every time or they ban us.
export const revalidate = 3600;

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`dir_api_${ip}`, 30, 60000); // 30 requests per minute per IP

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_INFO_ID;
        const RANGE = 'Officers!A2:G';

        if (!SPREADSHEET_ID) {
            return NextResponse.json(
                { error: 'Missing configuration: GOOGLE_SHEETS_INFO_ID' },
                { status: 500 }
            );
        }

        const rawData = await getSheetData(SPREADSHEET_ID, RANGE);

        if (!rawData || rawData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { validData, invalidCount } = parseSheetData({
            rows: rawData,
            schema: OfficerSchema,
            mapping: [
                { index: 0, key: 'id' },
                { index: 1, key: 'name', defaultValue: '' },
                { index: 2, key: 'position', defaultValue: '' },
                { index: 3, key: 'branch', defaultValue: '' },
                { index: 4, key: 'facebookUrl' },
                { index: 5, key: 'linkedinUrl' },
                { index: 6, key: 'priority', transform: (v) => parseInt(v, 10) }
            ],
            onError: (err, rowNum) => {
                console.warn(`Row ${rowNum} skipped:`, err);
            }
        });

        // Generate IDs for those missing them (assuming id was optional or needs a fallback)
        const finalData = validData.map((officer, index) => ({
            ...officer,
            id: officer.id || `auto-${index}`,
        }));

        return NextResponse.json({
            data: finalData,
            meta: {
                total: rawData.length,
                valid: finalData.length,
                invalid: invalidCount
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
