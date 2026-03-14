const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local since dotenv is not in this script's environment
function loadEnv() {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            // Handle escaped newlines in private key
            value = value.replace(/\\n/g, '\n');
            process.env[key] = value;
        }
    });
}

loadEnv();

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function testConnectivity() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_AUTH_ID;
    const authTab = process.env.GOOGLE_SHEETS_AUTH_TAB || 'SL Access!A1:E10';

    console.log(`Checking Spreadsheet: ${spreadsheetId}`);
    console.log(`Using Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL}`);

    try {
        const metadata = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        const sheetNames = metadata.data.sheets.map(s => s.properties.title);
        console.log('Successfully connected! Available sheet tabs:', sheetNames.join(', '));

        const targetTab = sheetNames.includes('SL Access') ? 'SL Access' : (sheetNames.includes('Authorized_Users') ? 'Authorized_Users' : sheetNames[0]);
        console.log(`Testing read on tab: ${targetTab}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${targetTab}!A1:E10`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in the sheet.');
        } else {
            console.log('Found headers:', rows[0].join(' | '));
            console.log(`Total rows retrieved: ${rows.length}`);
        }
    } catch (err) {
        console.error('FAILED to connect to Google Sheets:', err.message);
        if (err.message.includes('403')) {
            console.error('TIP: Ensure the service account email is added as an "Editor" to the Google Sheet.');
        }
    }
}

testConnectivity();
