import { execFileSync, spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import process from 'node:process';
import { chromium } from 'playwright';

const externalBaseUrl = process.env.AUDIT_BASE_URL?.replace(/\/+$/, '') || '';
let baseUrl = externalBaseUrl;
const serverMode = externalBaseUrl ? 'external' : 'self-started';
const routes = (process.env.AUDIT_ROUTES || '/,/hub,/directory/student-organizations,/services/grievance')
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);

const profiles = process.env.AUDIT_FULL_MATRIX === '1'
    ? [
        { name: 'fast', cpu: 1, latency: 0, download: -1, upload: -1 },
        { name: 'slow-network', cpu: 1, latency: 150, download: 1_600_000 / 8, upload: 750_000 / 8 },
        { name: 'slow-cpu', cpu: 4, latency: 0, download: -1, upload: -1 },
        { name: 'slow-mobile', cpu: 4, latency: 150, download: 1_600_000 / 8, upload: 750_000 / 8 },
    ]
    : [{ name: 'slow-mobile', cpu: 4, latency: 150, download: 1_600_000 / 8, upload: 750_000 / 8 }];

const budgets = {
    '/': { bytes: 700_000, lcp: 3_500, cls: 0.1 },
    '/hub': { bytes: 700_000, lcp: 3_500, cls: 0.1 },
    '/directory/student-organizations': { bytes: 1_000_000, lcp: 3_500, cls: 0.1 },
    '/services/grievance': { bytes: 700_000, lcp: 3_500, cls: 0.1 },
};

const coldRunCount = Math.max(1, Math.min(5, Number.parseInt(process.env.AUDIT_COLD_RUNS || '3', 10) || 3));
const longTaskObservationWindowMs = 3_000;

const initScript = `
(() => {
  window.__osrAudit = { lcp: 0, cls: 0, observedLongTaskBlocking: 0, interaction: 0, clsEntries: [], lcpEntries: [], longTasks: [], longTaskAttribution: [] };
  const state = window.__osrAudit;
  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.lcp = Math.max(state.lcp, entry.startTime);
          const element = entry.element;
          state.lcpEntries.push({
            startTime: Math.round(entry.startTime),
            size: Math.round(entry.size || 0),
            tag: element?.tagName || '',
            id: element?.id || '',
            className: typeof element?.className === 'string' ? element.className.slice(0, 160) : '',
          });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            state.cls += entry.value;
            state.clsEntries.push({
              value: Number(entry.value.toFixed(4)),
              startTime: Math.round(entry.startTime),
              sources: Array.from(entry.sources || []).slice(0, 5).map((source) => ({
                node: source.node?.tagName || '',
                id: source.node?.id || '',
                className: typeof source.node?.className === 'string' ? source.node.className.slice(0, 160) : '',
                previousRect: source.previousRect ? {
                  x: Math.round(source.previousRect.x),
                  y: Math.round(source.previousRect.y),
                  width: Math.round(source.previousRect.width),
                  height: Math.round(source.previousRect.height),
                } : null,
                currentRect: source.currentRect ? {
                  x: Math.round(source.currentRect.x),
                  y: Math.round(source.currentRect.y),
                  width: Math.round(source.currentRect.width),
                  height: Math.round(source.currentRect.height),
                } : null,
              })),
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.observedLongTaskBlocking += Math.max(0, entry.duration - 50);
          state.longTasks.push(Math.round(entry.duration));
          state.longTaskAttribution.push({
            startTime: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
            name: entry.name || '',
            attribution: Array.from(entry.attribution || []).slice(0, 3).map((item) => ({
              name: item.name || '',
              entryType: item.entryType || '',
              containerType: item.containerType || '',
              containerName: item.containerName || '',
              containerSrc: item.containerSrc || '',
            })),
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.interaction = Math.max(state.interaction, entry.duration || 0);
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch {}
  }
})();
`;

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
            probe.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
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

function stopOwnedProductionServer(child) {
    if (!child || child.killed) {
        return;
    }

    if (child.kill()) {
        return;
    }

    if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
        return;
    }

    child.kill('SIGTERM');
}

async function startOwnedProductionServer() {
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
    const exitState = new Promise((resolve) => {
        child.once('exit', (code, signal) => {
            resolve({ code, signal });
        });
    });

    try {
        const readiness = await Promise.race([
            waitForServer(`${baseUrl}/`).then(() => ({ ready: true })),
            exitState,
        ]);
        if (!readiness.ready) {
            throw new Error(`Audit production server exited before readiness (code=${readiness.code ?? 'null'}, signal=${readiness.signal ?? 'none'}, port=${port}).`);
        }
    } catch (error) {
        stopOwnedProductionServer(child);
        throw error;
    }
    return child;
}

async function runRoute(browser, route, profile) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    });
    await context.addInitScript({ content: initScript });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    if (profile.latency > 0) {
        await client.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: profile.latency,
            downloadThroughput: profile.download,
            uploadThroughput: profile.upload,
        });
    }

    let bytes = 0;
    let jsBytes = 0;
    const resourceBytes = new Map();
    const finished = new Map();
    client.on('Network.responseReceived', ({ requestId, response, type }) => {
        finished.set(requestId, { url: response.url, type: response.mimeType, resourceType: type });
    });
    client.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
        const response = finished.get(requestId);
        if (response) {
            bytes += encodedDataLength;
            resourceBytes.set(response.url, { bytes: encodedDataLength, type: response.type, resourceType: response.resourceType });
            if (response.resourceType === 'Script' || response.type.includes('javascript')) jsBytes += encodedDataLength;
        }
    });

    const url = `${baseUrl}${route}`;
    const startedAt = performance.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(250);
    const initialBytes = bytes;
    const initialJsBytes = jsBytes;
    await page.waitForTimeout(longTaskObservationWindowMs);
    const navigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);
    const initial = await page.evaluate(() => ({
        ...window.__osrAudit,
        pathname: window.location.pathname,
        footerPresent: Boolean(document.querySelector('footer')),
        footerRect: (() => {
            const footer = document.querySelector('footer');
            if (!footer) return null;
            const rect = footer.getBoundingClientRect();
            return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
        })(),
    }));

    const menu = page.getByRole('button', { name: /toggle navigation/i }).first();
    if (await menu.count()) {
        await menu.click();
        await page.waitForTimeout(100);
    }
    const afterInteraction = await page.evaluate(() => ({ ...window.__osrAudit }));
    const warmStartedAt = performance.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1_000);
    const warmNavigation = await page.evaluate(() => performance.getEntriesByType('navigation')[0]);

    const result = {
        route,
        profile: profile.name,
        serverMode,
        cold: {
            elapsedMs: Math.round(performance.now() - startedAt),
            ttfbMs: Math.round(navigation.responseStart),
            lcpMs: Math.round(initial.lcp),
            cls: Number(initial.cls.toFixed(4)),
            observedLongTaskBlockingMs: Math.round(initial.observedLongTaskBlocking),
            longTaskObservationWindowMs,
            interactionMs: Math.round(afterInteraction.interaction),
            bytes: Math.round(bytes),
            jsBytes: Math.round(jsBytes),
            initialBytes: Math.round(initialBytes),
            initialJsBytes: Math.round(initialJsBytes),
            longTasks: initial.longTasks,
            longTaskAttribution: initial.longTaskAttribution,
            clsEntries: initial.clsEntries,
            pathname: initial.pathname,
            footerPresent: initial.footerPresent,
            footerRect: initial.footerRect,
            lcpEntries: initial.lcpEntries,
            devResources: Array.from(resourceBytes.keys()).filter((resourceUrl) => /next-devtools|turbopack|webpack-hmr|hmr-client/i.test(resourceUrl)),
            scriptResources: Array.from(resourceBytes.entries())
                .filter(([, resource]) => resource.resourceType === 'Script' || resource.type.includes('javascript'))
                .sort((left, right) => right[1].bytes - left[1].bytes)
                .slice(0, 12)
                .map(([resourceUrl, resource]) => ({ url: resourceUrl, bytes: Math.round(resource.bytes) })),
        },
        warm: {
            elapsedMs: Math.round(performance.now() - warmStartedAt),
            ttfbMs: Math.round(warmNavigation.responseStart),
        },
    };
    await context.close();
    return result;
}

function assertBudget(result) {
    const budget = budgets[result.route];
    if (!budget || result.profile !== 'slow-mobile') return [];
    const failures = [];
    const transferBytes = result.cold.initialBytes ?? result.cold.bytes;
    if (transferBytes > budget.bytes) failures.push(`bytes ${transferBytes} > ${budget.bytes}`);
    if (result.cold.initialJsBytes > 220_000) failures.push(`initial JavaScript ${result.cold.initialJsBytes} > 220000`);
    if (result.cold.lcpMs > budget.lcp) failures.push(`lcp ${result.cold.lcpMs} > ${budget.lcp}`);
    if (result.cold.cls > budget.cls) failures.push(`cls ${result.cold.cls} > ${budget.cls}`);
    return failures;
}

function median(values) {
    const ordered = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (ordered.length === 0) return 0;
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 0
        ? (ordered[middle - 1] + ordered[middle]) / 2
        : ordered[middle];
}

function aggregateColdRuns(samples) {
    const cold = samples.map((sample) => sample.cold);
    const medianObservedBlocking = median(cold.map((sample) => sample.observedLongTaskBlockingMs));
    const representative = cold.reduce((closest, sample) => (
        Math.abs(sample.observedLongTaskBlockingMs - medianObservedBlocking) < Math.abs(closest.observedLongTaskBlockingMs - medianObservedBlocking)
            ? sample
            : closest
    ), cold[0]);
    return {
        ...samples[samples.length - 1],
        cold: {
            ...representative,
            elapsedMs: Math.round(median(cold.map((sample) => sample.elapsedMs))),
            ttfbMs: Math.round(median(cold.map((sample) => sample.ttfbMs))),
            lcpMs: Math.round(median(cold.map((sample) => sample.lcpMs))),
            cls: Number(median(cold.map((sample) => sample.cls)).toFixed(4)),
            observedLongTaskBlockingMs: Math.round(median(cold.map((sample) => sample.observedLongTaskBlockingMs))),
            interactionMs: Math.round(median(cold.map((sample) => sample.interactionMs))),
            bytes: Math.round(median(cold.map((sample) => sample.bytes))),
            jsBytes: Math.round(median(cold.map((sample) => sample.jsBytes))),
            initialBytes: Math.round(median(cold.map((sample) => sample.initialBytes))),
            initialJsBytes: Math.round(median(cold.map((sample) => sample.initialJsBytes))),
        },
        warm: {
            elapsedMs: Math.round(median(samples.map((sample) => sample.warm.elapsedMs))),
            ttfbMs: Math.round(median(samples.map((sample) => sample.warm.ttfbMs))),
        },
        coldRuns: cold,
    };
}

let server;
try {
    if (serverMode === 'self-started') {
        server = await startOwnedProductionServer();
    }
    await waitForServer(`${baseUrl}/`);
    const browser = await chromium.launch({ headless: true });
    const results = [];
    for (const profile of profiles) {
        for (const route of routes) {
            const samples = [];
            const runs = profile.name === 'slow-mobile' ? coldRunCount : 1;
            for (let run = 0; run < runs; run += 1) {
                samples.push(await runRoute(browser, route, profile));
            }
            results.push(runs > 1 ? aggregateColdRuns(samples) : samples[0]);
        }
    }
    await browser.close();
    const failures = results.flatMap((result) => [
        ...assertBudget(result).map((failure) => `${result.route} (${result.profile}): ${failure}`),
        ...(serverMode === 'self-started' && result.cold.devResources.length > 0
            ? [`${result.route} (${result.profile}): dev-server resources detected: ${result.cold.devResources.join(', ')}`]
            : []),
    ]);
    const output = JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, serverMode, results, failures }, null, 2);
    process.stdout.write(`${output}\n`);
    if (process.env.AUDIT_OUTPUT) await writeFile(process.env.AUDIT_OUTPUT, output);
    if (failures.length > 0 && process.env.AUDIT_ENFORCE === '1') process.exitCode = 1;
} finally {
    stopOwnedProductionServer(server);
}
