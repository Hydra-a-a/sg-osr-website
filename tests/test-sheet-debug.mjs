import { google } from 'googleapis';
import fs from 'fs';

async function main() {
    const envFile = fs.readFileSync('../.env.local', 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
    });

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = env.GOOGLE_SHEETS_DIRECTORY_ID;
    const range = 'News!A1:Z100';

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return;
        }

        fs.writeFileSync('sheet_dump_all.json', JSON.stringify(rows, null, 2));
        console.log('Dumped to sheet_dump_all.json');

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
