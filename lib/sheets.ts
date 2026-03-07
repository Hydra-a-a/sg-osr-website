import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    // needed write access or the forms would crash
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function getSheetData(spreadsheetId: string, range: string) {
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