import { google } from 'googleapis';
import { getGoogleServiceAccountCredentials } from '@/lib/google-credentials';

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
        console.error("Error fetching Google Sheets data:", error);
        throw new Error("Failed to fetch data from Google Sheets");
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
        console.error("Error appending Google Sheets data:", error);
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
                valueInputOption: 'USER_ENTERED',
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
        console.error("Error updating Google Sheets cell:", error);
        throw new Error("Failed to update cell in Google Sheets");
    }
}