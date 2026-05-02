/**
 * Seed Script: Populates the "Commuter Routes" tab in your Google Sheet
 * with real curated Metro Manila transit routes for RTU students.
 *
 * Usage: npx tsx scripts/seed-commuter-routes.ts
 *
 * Column schema (A–J):
 *   A: Origin Aliases (comma-separated)
 *   B: Destination Aliases (comma-separated)
 *   C: Step 1 (FORMAT: "MODE: instruction")
 *   D: Step 2
 *   E: Step 3
 *   F: Step 4
 *   G: Fare Range (e.g. "25-40")
 *   H: Duration Range (e.g. "60-90")
 *   I: Notes
 *   J: Visibility (true/false)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const CURATED_ROUTES: string[][] = [
    // ─── PITX → RTU Boni ───
    [
        'PITX, Paranaque Integrated Terminal Exchange, Paranaque Terminal',
        'RTU Boni, RTU Main, RTU Mandaluyong, Rizal Technological University',
        'BUS: From PITX, take any EDSA-bound bus (Jasper Jean, Jam Liner, or Five Star). Ride to Taft/EDSA stop near MRT Taft Ave station (~₱30, 30-45 min).',
        'MRT: Board MRT-3 at Taft Ave station heading north. Alight at Boni station (~₱16 student, 20 min).',
        'WALK: Exit Boni MRT via the south exit. Cross the footbridge near Jollibee/7-Eleven. Walk straight to RTU Main Gate (~5 min).',
        '',
        '46-76',
        '55-70',
        'MRT closes ~10PM. After hours, take a bus all the way to Mandaluyong and walk or take a tricycle.',
        'true',
    ],
    // ─── RTU Boni → PITX ───
    [
        'RTU Boni, RTU Main, RTU Mandaluyong, Rizal Technological University',
        'PITX, Paranaque Integrated Terminal Exchange, Paranaque Terminal',
        'WALK: From RTU Main Gate, walk to Boni MRT station via the footbridge near Jollibee (~5 min).',
        'MRT: Board MRT-3 at Boni station heading south. Alight at Taft Ave station (~₱16 student, 20 min).',
        'BUS: From Taft/EDSA, take any PITX-bound bus (Jasper Jean, Five Star). Ride all the way to PITX (~₱30, 30-45 min).',
        '',
        '46-76',
        '55-70',
        'Last full southbound MRT trip ~9:15PM.',
        'true',
    ],
    // ─── Pasay (Taft) → RTU Boni ───
    [
        'Pasay, Taft, Taft Avenue, EDSA Taft, LRT Taft, MRT Taft',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'MRT: Board MRT-3 at Taft Ave station heading north. Alight at Boni station (~₱16 student, 20 min).',
        'WALK: Exit Boni MRT south exit. Cross the footbridge near Jollibee. Walk to RTU Main Gate (~5 min).',
        '',
        '',
        '16-20',
        '25-30',
        'Fastest route to RTU. MRT can be crowded 7-9AM.',
        'true',
    ],
    // ─── SM Bicutan → RTU Boni ───
    [
        'SM Bicutan, Bicutan, Lower Bicutan, Upper Bicutan',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'JEEP: From SM Bicutan, take a jeep or UV Express to Sucat/SLEX. Transfer to an EDSA-bound jeep going to MRT Magallanes (~₱15-20, 15-20 min).',
        'MRT: Board MRT-3 at Magallanes station heading north. Alight at Boni station (~₱20 student, 25 min).',
        'WALK: Exit Boni MRT south exit. Cross to RTU Main Gate (~5 min).',
        '',
        '35-55',
        '45-60',
        'Alternatively, take a P2P bus if available on the Bicutan-Mandaluyong route.',
        'true',
    ],
    // ─── Alabang → RTU Boni ───
    [
        'Alabang, Starmall Alabang, South Station Alabang, Festival Mall, Alabang Town Center',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'BUS: From Alabang/South Station, take a northbound bus via EDSA (Jasper Jean, RRCG). Ride to MRT Magallanes (~₱25-35, 30-40 min).',
        'MRT: Board MRT-3 at Magallanes heading north. Alight at Boni station (~₱20 student, 25 min).',
        'WALK: Cross footbridge from Boni MRT to RTU Main Gate (~5 min).',
        '',
        '45-75',
        '60-75',
        'P2P buses from Starmall Alabang to Megamall may be faster — walk from Megamall to Shaw then one MRT stop to Boni.',
        'true',
    ],
    // ─── Cubao → RTU Boni ───
    [
        'Cubao, Araneta, Gateway, Farmers, Ali Mall, MRT Cubao',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'MRT: Board MRT-3 at Cubao-Araneta station heading south. Alight at Boni station (~₱16 student, 10-15 min).',
        'WALK: Exit Boni MRT south exit. Cross to RTU Main Gate (~5 min).',
        '',
        '',
        '16-20',
        '15-20',
        'Very short MRT ride. Only 3 stops from Cubao to Boni.',
        'true',
    ],
    // ─── RTU Boni → Cubao ───
    [
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'Cubao, Araneta, Gateway, Farmers, Ali Mall',
        'WALK: From RTU Main Gate, walk to Boni MRT station (~5 min).',
        'MRT: Board MRT-3 at Boni heading north. Alight at Cubao-Araneta station (~₱16 student, 10-15 min).',
        '',
        '',
        '16-20',
        '15-20',
        'Quick northbound ride.',
        'true',
    ],
    // ─── Binangonan → RTU Boni ───
    [
        'Binangonan, Rizal, Binangonan Rizal',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'JEEP: From Binangonan town proper, take a jeep to Angono junction or SM Taytay (~₱15, 20-30 min).',
        'UV: Take a UV Express (Taytay-Cubao or Antipolo-Cubao route) to MRT Cubao/Santolan (~₱50-65, 40-60 min).',
        'MRT: Board MRT-3 heading south. Alight at Boni station (~₱20 student, 15 min).',
        'WALK: Cross to RTU Main Gate (~5 min).',
        '85-120',
        '90-120',
        'Travel time varies heavily with EDSA traffic. Leave early (before 6AM) to avoid 2+ hour commutes.',
        'true',
    ],
    // ─── Tanay → RTU Boni ───
    [
        'Tanay, Tanay Rizal',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'JEEP: From Tanay town, take a jeep to Antipolo (Sumulong Highway route, ~₱25, 30-45 min).',
        'UV: From Antipolo/SM Masinag, take a UV Express to MRT Santolan or Cubao (~₱55-70, 45-60 min).',
        'MRT: Board MRT-3 heading south from Santolan/Cubao. Alight at Boni station (~₱20 student, 15-20 min).',
        'WALK: Cross to RTU Main Gate (~5 min).',
        '100-140',
        '105-150',
        'Longest route. Consider leaving before 5:30AM for 7:30AM classes.',
        'true',
    ],
    // ─── RTU Boni → RTU Pasig ───
    [
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'RTU Pasig, RTU College of Engineering Pasig',
        'JEEP: From RTU Main Gate, walk to EDSA-Shaw Blvd area. Take a Pasig-bound jeep along Shaw Blvd (~₱12, 15-20 min).',
        'WALK: Alight near RTU Pasig campus gate (~2 min).',
        '',
        '',
        '12-15',
        '20-25',
        'Alternatively, take a tricycle from Boni area to RTU Pasig (~₱30-50).',
        'true',
    ],
    // ─── PITX → RTU Pasig ───
    [
        'PITX, Paranaque Integrated Terminal Exchange',
        'RTU Pasig, RTU College of Engineering Pasig',
        'BUS: From PITX, take an EDSA-bound bus to MRT Taft Ave station (~₱30, 30-45 min).',
        'MRT: Board MRT-3 at Taft Ave heading north. Alight at Shaw Blvd station (~₱20 student, 25 min).',
        'JEEP: From Shaw MRT, take a Pasig-bound jeep along Shaw Blvd to RTU Pasig campus (~₱12, 10-15 min).',
        '',
        '62-90',
        '70-90',
        'Shaw station is closer to RTU Pasig than Boni.',
        'true',
    ],
    // ─── Quiapo/Manila → RTU Boni ───
    [
        'Quiapo, Manila, Recto, LRT Central, Carriedo, Divisoria',
        'RTU Boni, RTU Main, RTU Mandaluyong',
        'LRT: From any LRT-1 station (e.g., Carriedo), ride to EDSA/Taft Ave station (~₱15 student, 15-20 min).',
        'MRT: Transfer to MRT-3 at Taft Ave. Board heading north, alight at Boni station (~₱16 student, 20 min).',
        'WALK: Cross footbridge to RTU Main Gate (~5 min).',
        '',
        '31-45',
        '40-50',
        'LRT-1 to MRT-3 transfer at EDSA is a ~5 min walk between stations.',
        'true',
    ],
];

async function seedRoutes() {
    // Dynamic import for ESM compatibility
    const { google } = await import('googleapis');

    const sheetId = process.env.COMMUTER_MAPS_SHEET_ID || process.env.GOOGLE_SHEETS_INFO_ID;
    if (!sheetId) {
        console.error('❌ No COMMUTER_MAPS_SHEET_ID or GOOGLE_SHEETS_INFO_ID found in .env');
        process.exit(1);
    }

    console.log(`📋 Target sheet: ${sheetId}`);
    console.log(`📝 Routes to seed: ${CURATED_ROUTES.length}`);

    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({
        credentials: {
            type: 'service_account',
            project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
            private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
            private_key: privateKey,
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Check if 'Commuter Routes' tab exists, create if not
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const existingTabs = (spreadsheet.data.sheets || []).map(s => s.properties?.title);

    if (!existingTabs.includes('Commuter Routes')) {
        console.log('➕ Creating "Commuter Routes" tab...');
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [{ addSheet: { properties: { title: 'Commuter Routes' } } }],
            },
        });
    }

    // 2. Write header row
    const HEADER = [
        'Origin Aliases', 'Destination Aliases',
        'Step 1', 'Step 2', 'Step 3', 'Step 4',
        'Fare Range', 'Duration (mins)', 'Notes', 'Visible',
    ];

    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "'Commuter Routes'!A1:J1",
        valueInputOption: 'RAW',
        requestBody: { values: [HEADER] },
    });

    // 3. Write route data
    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'Commuter Routes'!A2:J${CURATED_ROUTES.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: CURATED_ROUTES },
    });

    console.log(`✅ Seeded ${CURATED_ROUTES.length} curated routes into "Commuter Routes" tab.`);
    console.log('Routes seeded:');
    CURATED_ROUTES.forEach((r, i) => {
        const origin = r[0].split(',')[0].trim();
        const dest = r[1].split(',')[0].trim();
        console.log(`  ${i + 1}. ${origin} → ${dest}`);
    });
}

seedRoutes().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
