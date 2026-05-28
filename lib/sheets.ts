import { google } from 'googleapis';
import { getGoogleServiceAccountCredentials } from '@/lib/google-credentials';
import { redactErrorForLog } from '@/lib/security';

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
    if (sheetsClient) {
        return sheetsClient;
    }

    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleServiceAccountCredentials(),
        // needed write access or the forms would crash
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

export async function getSheetData(spreadsheetId: string, range: string) {
    const sheets = getSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.get(
            {
                spreadsheetId,
                range,
            },
            {
                timeout: 8000, // don't let vercel hang forever or we get billed
                headers: {
                    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            }
        );

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            return [];
        }
        return rows;
    } catch (error: any) {
        // Stop hiding the error behind a generic message so we can debug rate limits or bad ranges!
        const errMsg = error?.response?.data?.error?.message || error?.message || 'Unknown Google API Error';
        console.error("Error fetching Google Sheets data:", errMsg, redactErrorForLog(error));
        throw new Error(`Google API Error: ${errMsg}`);
    }
}

export async function getSheetDataWithHyperlinks(spreadsheetId: string, range: string) {
    const sheets = getSheetsClient();

    const parseSheetTitleFromRange = (a1Range: string): string => {
        const normalizedRange = (a1Range || '').trim();
        if (!normalizedRange) {
            return '';
        }

        if (normalizedRange.startsWith("'")) {
            const quotedEnd = normalizedRange.indexOf("'!");
            if (quotedEnd > 1) {
                return normalizedRange.slice(1, quotedEnd).replace(/''/g, "'");
            }
        }

        const bangIndex = normalizedRange.indexOf('!');
        if (bangIndex > 0) {
            return normalizedRange.slice(0, bangIndex);
        }

        return '';
    };

    const extractUrlFromCellRuns = (cell: any): string => {
        const textRunUrl = (cell?.textFormatRuns || [])
            .map((run: any) => run?.format?.link?.uri || '')
            .find((value: string) => /^https?:\/\//i.test(value));
        if (textRunUrl) {
            return textRunUrl;
        }

        const chipRunUrl = (cell?.chipRuns || [])
            .map((run: any) => run?.chip?.richLinkProperties?.uri || '')
            .find((value: string) => /^https?:\/\//i.test(value));
        if (chipRunUrl) {
            return chipRunUrl;
        }

        return '';
    };

    try {
        const response = await sheets.spreadsheets.get(
            {
                spreadsheetId,
                ranges: [range],
                includeGridData: true,
            },
            {
                timeout: 8000,
                headers: {
                    'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            }
        );

        const requestedSheetTitle = parseSheetTitleFromRange(range);
        const requestedSheet = requestedSheetTitle
            ? response.data.sheets?.find((sheet) => sheet.properties?.title === requestedSheetTitle)
            : undefined;

        const rowData = requestedSheet?.data?.[0]?.rowData || response.data.sheets?.[0]?.data?.[0]?.rowData || [];
        return rowData.map((row) =>
            (row.values || []).map((cell) => {
                const hyperlink = cell.hyperlink;
                if (hyperlink) {
                    return hyperlink;
                }

                const runUrl = extractUrlFromCellRuns(cell);
                if (runUrl) {
                    return runUrl;
                }

                const formula = cell.userEnteredValue?.formulaValue || '';
                const hyperlinkMatch = formula.match(/^=\s*HYPERLINK\(\s*"([^"]+)"\s*,/i);
                if (hyperlinkMatch?.[1]) {
                    return hyperlinkMatch[1];
                }

                const effectiveValue = cell.effectiveValue?.stringValue || cell.effectiveValue?.numberValue?.toString() || '';
                return effectiveValue || cell.formattedValue || '';
            })
        );
    } catch (error) {
        console.error('Error fetching Google Sheets hyperlink data:', redactErrorForLog(error));
        throw new Error('Failed to fetch hyperlink data from Google Sheets');
    }
}

export async function appendSheetData(spreadsheetId: string, range: string, values: any[][]) {
    const sheets = getSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.append(
            {
                spreadsheetId,
                range,
                valueInputOption: 'RAW',
                requestBody: {
                    values,
                },
            },
            {
                timeout: 8000 // don't let vercel hang forever or we get billed
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error appending Google Sheets data:", redactErrorForLog(error));
        throw new Error("Failed to append data to Google Sheets");
    }
}

export async function updateSheetCell(spreadsheetId: string, range: string, values: any[][]) {
    const sheets = getSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.update(
            {
                spreadsheetId,
                range,
                valueInputOption: 'RAW',
                requestBody: {
                    values,
                },
            },
            {
                timeout: 8000
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error updating Google Sheets cell:", redactErrorForLog(error));
        throw new Error("Failed to update cell in Google Sheets");
    }
}

export async function getSpreadsheetSheetTitles(spreadsheetId: string): Promise<string[]> {
    const sheets = getSheetsClient();

    try {
        const response = await sheets.spreadsheets.get(
            {
                spreadsheetId,
                fields: 'sheets(properties(title))',
            },
            {
                timeout: 8000,
            }
        );

        return (response.data.sheets || [])
            .map((sheet) => sheet.properties?.title || '')
            .filter((title) => title.trim().length > 0);
    } catch (error) {
        console.error('Error fetching spreadsheet metadata:', redactErrorForLog(error));
        return [];
    }
}

export async function batchUpdateSheetData(
    spreadsheetId: string,
    data: Array<{ range: string; values: any[][] }>
) {
    const sheets = getSheetsClient();

    if (!Array.isArray(data) || data.length === 0) {
        return { totalUpdatedCells: 0 };
    }

    try {
        const response = await sheets.spreadsheets.values.batchUpdate(
            {
                spreadsheetId,
                requestBody: {
                    valueInputOption: 'RAW',
                    data,
                },
            },
            {
                timeout: 8000,
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error batch updating Google Sheets data:', redactErrorForLog(error));
        throw new Error('Failed to batch update data in Google Sheets');
    }
}
