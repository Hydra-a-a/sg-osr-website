import { google } from 'googleapis';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    const envFile = fs.readFileSync(join(__dirname, '../.env.local'), 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
        if (line.includes('=')) {
            const parts = line.split('=');
            env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
        }
    });

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: env.GOOGLE_SHEETS_DIRECTORY_ID,
        range: 'News!A2:F',
    });

    fs.writeFileSync(join(__dirname, 'sheet-dump.json'), JSON.stringify(response.data.values, null, 2));
    console.log("Saved to sheet-dump.json!");
}

main().catch(console.error);
