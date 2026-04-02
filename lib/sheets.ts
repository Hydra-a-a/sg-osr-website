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
                timeout: 8000 // don't let vercel hang forever or we get billed
            }
        );

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            return [];
        }
        return rows;
    } catch (error) {
        console.error("Error fetching Google Sheets data:", redactErrorForLog(error));
        throw new Error("Failed to fetch data from Google Sheets");
    }
}

export async function getSheetDataWithHyperlinks(spreadsheetId: string, range: string) {
    const sheets = getSheetsClient();

    try {
        const response = await sheets.spreadsheets.get(
            {
                spreadsheetId,
                ranges: [range],
                includeGridData: true,
            },
            {
                timeout: 8000,
            }
        );

        const rowData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
        return rowData.map((row) =>
            (row.values || []).map((cell) => {
                const hyperlink = cell.hyperlink;
                if (hyperlink) {
                    return hyperlink;
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