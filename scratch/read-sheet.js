const { google } = require('googleapis');
const credentials = require('../lib/google-credentials');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
    const auth = new google.auth.GoogleAuth({
        credentials: credentials.getGoogleServiceAccountCredentials(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheetId = process.env.GOOGLE_SHEETS_AUTH_ID;
    if (!spreadsheetId) {
        console.error("Missing GOOGLE_SHEETS_AUTH_ID");
        return;
    }
    
    const range = process.env.GOOGLE_SHEETS_AUTH_TAB || 'SL Access!A1:Z';
    
    console.log(`Fetching from sheet: ${spreadsheetId}, range: ${range}`);
    
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    
    console.log(`Found ${rows.length} rows.`);
    rows.forEach((row, idx) => {
        const rowStr = row.join(' | ');
        if (rowStr.includes('2023-100433')) {
            console.log(`Row ${idx + 1}: ${rowStr}`);
        }
    });
}
run();
