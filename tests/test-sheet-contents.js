const { google } = require('googleapis');
require('dotenv').config({ path: '../.env.local' });

async function getSheetData() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_DIRECTORY_ID,
        range: 'News!A2:F',
    });

    console.log("Raw Rows from News tab:");
    console.log(response.data.values);
}

getSheetData().catch(console.error);
