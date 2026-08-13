import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const lighthouseModule = require('lighthouse');
const lighthouse = lighthouseModule.default || lighthouseModule;
const { launch } = require(require.resolve('chrome-launcher', { paths: [dirname(require.resolve('lighthouse'))] }));
const lighthouseConfig = require(join(process.cwd(), 'lighthouserc.cjs')).ci;

const externalBaseUrl = process.env.AUDIT_BASE_URL?.replace(/\/+$/, '') || '';
const serverMode = externalBaseUrl ? 'external' : 'self-started';
let baseUrl = externalBaseUrl;
const routes = (process.env.AUDIT_ROUTES || '/,/hub,/directory/student-organizations,/services/grievance')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
const runCount = Math.max(1, Math.min(5, Number.parseInt(process.env.LHCI_RUNS || String(lighthouseConfig.collect.numberOfRuns || 3), 10) || 3));
const enforce = process.env.AUDIT_ENFORCE === '1';
const outputDir = join(process.cwd(), 'artifacts', 'lighthouse');
const collectSettings = lighthouseConfig.collect.settings;
const maxNumericAssertion = (id, fallback) => lighthouseConfig.assert.assertions[id]?.[1]?.maxNumericValue ?? fallback;
const minScoreAssertion = (id, fallback) => lighthouseConfig.assert.assertions[id]?.[1]?.minScore ?? fallback;
const budgets = {
    tbtMs: maxNumericAssertion('total-blocking-time', 300),
    lcpMs: maxNumericAssertion('largest-contentful-paint', 3_500),
    cls: maxNumericAssertion('cumulative-layout-shift', 0.1),
};
const categoryBudgets = {
    performance: minScoreAssertion('categories:performance', 0.8),
    accessibility: minScoreAssertion('categories:accessibility', 0.95),
    bestPractices: minScoreAssertion('categories:best-practices', 0.9),
    seo: minScoreAssertion('categories:seo', 0.9),
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFreeLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = createServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            probe.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(url) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // The production server may need several seconds to boot.
        }
        await sleep(500);
    }
    throw new Error(`Audit server did not become ready: ${url}`);
}

function stopOwnedServer(child) {
    if (!child || child.killed) return;
    if (process.platform === 'win32') {
        try {
            execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        } catch {
            // The process may already have exited after the audit completed.
        }
        return;
    }
    child.kill('SIGTERM');
}

async function startOwnedServer() {
    const port = await findFreeLoopbackPort();
    baseUrl = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [
        'node_modules/next/dist/bin/next',
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
    ], {
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    });
    const exitState = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));

    try {
        const readiness = await Promise.race([
            waitForServer(`${baseUrl}/`).then(() => ({ ready: true })),
            exitState,
        ]);
        if (!readiness.ready) {
            throw new Error(`Audit production server exited before readiness (code=${readiness.code ?? 'null'}, signal=${readiness.signal ?? 'none'}, port=${port}).`);
        }
    } catch (error) {
        stopOwnedServer(child);
        throw error;
    }
    return child;
}

function median(values) {
    const ordered = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (ordered.length === 0) return 0;
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 0
        ? (ordered[middle - 1] + ordered[middle]) / 2
        : ordered[middle];
}

function routeUrl(route) {
    return `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`;
}

function safeRouteName(route) {
    return route === '/' ? 'home' : route.slice(1).replaceAll('/', '_');
}

function getLongTasks(lhr) {
    return (lhr.audits?.['long-tasks']?.details?.items || [])
        .map((item) => ({
            url: item.url || '',
            startTime: Math.round(item.startTime || 0),
            duration: Math.round(item.duration || 0),
        }))
        .sort((left, right) => right.duration - left.duration)
        .slice(0, 8);
}

function getDevResources(lhr) {
    return (lhr.audits?.['network-requests']?.details?.items || [])
        .map((item) => item.url || '')
        .filter((url) => /next-devtools|turbopack|webpack-hmr|hmr-client/i.test(url));
}

async function collectRouteRun(route, run) {
    const profileDir = await mkdtemp(join(tmpdir(), 'osr-lighthouse-profile-'));
    let chrome;
    try {
        chrome = await launch({
            userDataDir: profileDir,
            chromeFlags: ['--no-sandbox', '--disable-dev-shm-usage', '--headless=new'],
        });
        const result = await lighthouse(routeUrl(route), {
            port: chrome.port,
            formFactor: collectSettings.formFactor,
            screenEmulation: collectSettings.screenEmulation,
            output: 'json',
            logLevel: 'error',
        });
        const lhr = result.lhr;
        if (lhr.runtimeError) {
            throw new Error(`Lighthouse runtime error on ${route}: ${lhr.runtimeError.message || lhr.runtimeError.code || 'unknown error'}`);
        }
        await mkdir(outputDir, { recursive: true });
        await writeFile(
            join(outputDir, `${safeRouteName(route)}-run-${run + 1}.report.json`),
            JSON.stringify(lhr, null, 2),
        );
        return {
            route,
            run: run + 1,
            lcpMs: Math.round(lhr.audits?.['largest-contentful-paint']?.numericValue || 0),
            tbtMs: Math.round(lhr.audits?.['total-blocking-time']?.numericValue || 0),
            cls: Number((lhr.audits?.['cumulative-layout-shift']?.numericValue || 0).toFixed(4)),
            performanceScore: lhr.categories?.performance?.score ?? null,
            accessibilityScore: lhr.categories?.accessibility?.score ?? null,
            bestPracticesScore: lhr.categories?.['best-practices']?.score ?? null,
            seoScore: lhr.categories?.seo?.score ?? null,
            longTasks: getLongTasks(lhr),
            devResources: getDevResources(lhr),
        };
    } finally {
        if (chrome) {
            try {
                chrome.kill();
            } catch {
                // Chrome may already have exited after producing the report.
            }
        }
        try {
            await rm(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
        } catch (error) {
            process.stderr.write(`Lighthouse temporary profile cleanup warning: ${error.message}\n`);
        }
    }
}

function aggregate(route, samples) {
    return {
        route,
        runs: samples.length,
        lcpMs: Math.round(median(samples.map((sample) => sample.lcpMs))),
        tbtMs: Math.round(median(samples.map((sample) => sample.tbtMs))),
        cls: Number(median(samples.map((sample) => sample.cls)).toFixed(4)),
        performanceScore: Number(median(samples.map((sample) => sample.performanceScore)).toFixed(2)),
        accessibilityScore: Number(median(samples.map((sample) => sample.accessibilityScore)).toFixed(2)),
        bestPracticesScore: Number(median(samples.map((sample) => sample.bestPracticesScore)).toFixed(2)),
        seoScore: Number(median(samples.map((sample) => sample.seoScore)).toFixed(2)),
        runsDetail: samples,
    };
}

function violations(result) {
    const failures = [];
    if (result.tbtMs > budgets.tbtMs) failures.push(`tbt ${result.tbtMs} > ${budgets.tbtMs}`);
    if (result.lcpMs > budgets.lcpMs) failures.push(`lcp ${result.lcpMs} > ${budgets.lcpMs}`);
    if (result.cls > budgets.cls) failures.push(`cls ${result.cls} > ${budgets.cls}`);
    return failures;
}

function qualityWarnings(result) {
    const warnings = [];
    if (result.performanceScore < categoryBudgets.performance) warnings.push(`performance score ${result.performanceScore} < ${categoryBudgets.performance}`);
    if (result.accessibilityScore < categoryBudgets.accessibility) warnings.push(`accessibility score ${result.accessibilityScore} < ${categoryBudgets.accessibility}`);
    if (result.bestPracticesScore < categoryBudgets.bestPractices) warnings.push(`best-practices score ${result.bestPracticesScore} < ${categoryBudgets.bestPractices}`);
    if (result.seoScore < categoryBudgets.seo) warnings.push(`seo score ${result.seoScore} < ${categoryBudgets.seo}`);
    return warnings;
}

let server;
try {
    if (serverMode === 'self-started') server = await startOwnedServer();
    await waitForServer(`${baseUrl}/`);
    const samplesByRoute = new Map(routes.map((route) => [route, []]));
    for (const route of routes) {
        for (let run = 0; run < runCount; run += 1) {
            samplesByRoute.get(route).push(await collectRouteRun(route, run));
        }
    }

    const results = routes.map((route) => aggregate(route, samplesByRoute.get(route)));
    const violationsByRoute = results.flatMap((result) => violations(result).map((failure) => `${result.route}: ${failure}`));
    const qualityIssues = results.flatMap((result) => qualityWarnings(result).map((warning) => `${result.route}: ${warning}`));
    const devResources = results.flatMap((result) => result.runsDetail.flatMap((sample) => sample.devResources));
    const devResourceIssues = devResources.length > 0
        ? [`dev-server resources detected: ${[...new Set(devResources)].join(', ')}`]
        : [];
    const performanceIssues = [...violationsByRoute, ...devResourceIssues];
    const hardFailures = [
        ...(enforce ? performanceIssues : []),
        ...results.flatMap((result) => result.accessibilityScore < categoryBudgets.accessibility
            ? [`${result.route}: accessibility score ${result.accessibilityScore} < ${categoryBudgets.accessibility}`]
            : []),
    ];
    const output = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        serverMode,
        runs: runCount,
        results,
        warnings: [...(enforce ? [] : performanceIssues), ...qualityIssues],
        failures: hardFailures,
        devResources: [...new Set(devResources)],
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (process.env.AUDIT_OUTPUT) await writeFile(process.env.AUDIT_OUTPUT, JSON.stringify(output, null, 2));
    if (hardFailures.length > 0) process.exitCode = 1;
} finally {
    stopOwnedServer(server);
}
