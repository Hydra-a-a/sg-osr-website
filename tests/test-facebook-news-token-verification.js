import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'facebook-news-sync.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const sources = [
    ['page-valid', 'Valid Page', 'valid', 'true', '/news', 'META_PAGE_TOKEN_VALID', 'ssc', '10', ''],
    ['page-missing', 'Missing Alias Page', 'missing', 'true', '/news', 'META_PAGE_TOKEN_MISSING', 'ssc', '10', ''],
    ['page-denied', 'Denied Page', 'denied', 'true', '/news', 'META_PAGE_TOKEN_DENIED', 'ssc', '10', ''],
];

const parseSource = (row) => ({
    pageId: row[0], pageName: row[1], pageSlug: row[2], enabled: row[3] === 'true',
    defaultTargetPages: ['/news'], tokenAlias: row[5], defaultSection: row[6], syncLimit: 10, notes: row[8],
});

function required(id) {
    if (id === 'server-only') return {};
    if (id === '@/lib/sheets') return { getSheetData: async () => sources };
    if (id === '@/lib/security') return {
        isTrustedUrl: () => true,
        fetchWithTimeout: async (url) => {
            const request = new URL(url);
            if (request.pathname.endsWith('/debug_token')) {
                return Response.json({ data: {
                    is_valid: true, app_id: 'expected-app', type: 'PAGE',
                    expires_at: Math.floor(Date.now() / 1_000) + 8 * 86_400,
                    scopes: ['pages_read_engagement'],
                } });
            }
            if (request.pathname.endsWith('/posts')) {
                return request.pathname.includes('page-denied')
                    ? new Response('', { status: 403 })
                    : Response.json({ data: [] });
            }
            return Response.json({ id: request.pathname.split('/').pop() });
        },
    };
    if (id === '@/lib/news') return {
        NEWS_SOURCES_RANGE: 'News Sources!A2:I', parseNewsSourceRow: parseSource,
    };
    if (id === '@/lib/public-cache') return {};
    if (id === '@/lib/public-content-source') return {};
    throw new Error(`Unexpected module: ${id}`);
}

const loadedModule = { exports: {} };
vm.runInNewContext(compiled, {
    module: loadedModule, exports: loadedModule.exports, require: required, process: { env: {
        GOOGLE_SHEETS_INFO_ID: 'test-sheet', META_APP_ID: 'expected-app', META_APP_ACCESS_TOKEN: 'app-secret',
        META_PAGE_TOKEN_VALID: 'valid-token-secret', META_PAGE_TOKEN_DENIED: 'denied-token-secret',
    } },
    URL, Response, Date, Set, Promise, console,
});

loadedModule.exports.verifyFacebookNewsTokens().then((summary) => {
    const result = JSON.parse(JSON.stringify(summary));
    assert.deepStrictEqual(result, {
        pagesChecked: 3,
        verified: 1,
        skipped: 2,
        errors: [
            { pageId: 'page-missing', pageName: 'Missing Alias Page', message: 'Missing or invalid token alias' },
            { pageId: 'page-denied', pageName: 'Denied Page', message: 'Meta Graph API returned HTTP 403' },
        ],
    });
    assert(!JSON.stringify(result).includes('token-secret'), 'Verification summaries must never expose credentials.');
    console.log('test-facebook-news-token-verification: PASS');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
