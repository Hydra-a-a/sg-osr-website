import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';

const DEFAULT_ROUTES = [
  '/',
  '/services',
  '/services/grievance',
  '/services/proposals',
  '/transparency',
  '/hub',
  '/directory',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const IMPACT_RANK = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

function normalizeBaseUrl(value) {
  const raw = String(value || 'http://127.0.0.1:3000').trim();
  return raw.replace(/\/+$/, '');
}

function parseRoutes() {
  const rawRoutes = String(process.env.AUDIT_ROUTES || '').trim();
  if (!rawRoutes) {
    return DEFAULT_ROUTES;
  }

  return rawRoutes
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : `/${route}`));
}

function shouldFailViolation(violation, threshold) {
  const thresholdRank = IMPACT_RANK[threshold] || IMPACT_RANK.serious;
  const impactRank = IMPACT_RANK[violation.impact] || 0;
  return impactRank >= thresholdRank;
}

function formatNodeTargets(nodes) {
  return nodes
    .slice(0, 3)
    .map((node) => node.target.join(' '))
    .join('; ');
}

async function ensureOutputDir() {
  const outputDir = path.join(process.cwd(), 'artifacts', 'a11y');
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
}

async function writeReports(results, failures) {
  const outputDir = await ensureOutputDir();
  await fs.writeFile(
    path.join(outputDir, 'axe-results.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
    'utf8',
  );

  const lines = [
    '# Accessibility Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Scanned pages: ${results.length}`,
    `Failing findings: ${failures.length}`,
    '',
  ];

  if (failures.length > 0) {
    lines.push('## Failures', '');
    for (const failure of failures) {
      lines.push(
        `- ${failure.viewport} ${failure.route}: ${failure.id} (${failure.impact}) - ${failure.help}`,
      );
      lines.push(`  Targets: ${failure.targets || 'No target details available'}`);
    }
  } else {
    lines.push('No serious or critical axe violations were detected.');
  }

  await fs.writeFile(path.join(outputDir, 'axe-summary.md'), `${lines.join('\n')}\n`, 'utf8');
}

async function run() {
  const baseUrl = normalizeBaseUrl(process.env.AUDIT_BASE_URL);
  const routes = parseRoutes();
  const impactThreshold = String(process.env.AUDIT_A11Y_IMPACT || 'serious').toLowerCase();
  const browser = await chromium.launch({ chromiumSandbox: false });
  const results = [];
  const failures = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
      });

      for (const route of routes) {
        const page = await context.newPage();
        const url = `${baseUrl}${route}`;
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });

        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
        await page.waitForTimeout(500);

        const status = response?.status() || 0;
        if (status >= 400 || status === 0) {
          failures.push({
            viewport: viewport.name,
            route,
            id: 'page-load',
            impact: 'critical',
            help: `Page returned HTTP ${status || 'unknown'}`,
            targets: url,
          });
        }

        const axeResult = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .exclude('.pdf-embed-shell iframe')
          .analyze();

        const pageResult = {
          viewport: viewport.name,
          route,
          url,
          status,
          violations: axeResult.violations,
          passes: axeResult.passes.length,
          incomplete: axeResult.incomplete,
        };
        results.push(pageResult);

        for (const violation of axeResult.violations) {
          if (!shouldFailViolation(violation, impactThreshold)) {
            continue;
          }

          failures.push({
            viewport: viewport.name,
            route,
            id: violation.id,
            impact: violation.impact || 'unknown',
            help: violation.help,
            helpUrl: violation.helpUrl,
            targets: formatNodeTargets(violation.nodes),
          });
        }

        await page.close();
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  await writeReports(results, failures);

  if (failures.length > 0) {
    console.error(`Accessibility audit failed with ${failures.length} finding(s). See artifacts/a11y/axe-summary.md.`);
    process.exit(1);
  }

  console.log(`Accessibility audit passed for ${routes.length} route(s) across ${VIEWPORTS.length} viewport(s).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
