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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function testInfoSheet() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_INFO_ID;
    console.log(`Checking Info Spreadsheet: ${spreadsheetId}`);

    try {
        const metadata = await sheets.spreadsheets.get({ spreadsheetId });
        const tabs = metadata.data.sheets.map(s => s.properties.title);
        console.log(`Successfully connected! Available sheet tabs: ${tabs.join(', ')}`);
        
        // Test reading News tab headers
        if (tabs.includes('News')) {
            const newsData = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: 'News!A1:Z1',
            });
            console.log('News headers found:', newsData.data.values[0].join(' | '));
        } else {
            console.log('News tab not found. Testing first available tab headers.');
            const newsData = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${tabs[0]}!A1:Z1`,
            });
            console.log(`${tabs[0]} headers found:`, newsData.data.values[0].join(' | '));
        }
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

testInfoSheet();
