import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';

const ROUTE_GROUPS = {
  core: [
    '/',
    '/services',
    '/services/grievance',
    '/services/proposals',
    '/transparency',
    '/hub',
    '/directory',
  ],
  services: [
    '/services',
    '/services/grievance',
    '/services/proposals',
    '/services/proposals/track',
    '/services/track',
  ],
  hub: [
    '/hub',
    '/hub/commute',
    '/hub/commute/contribute',
    '/hub/commute/leaderboard',
  ],
  government: [
    '/student-government',
    '/student-government/councils',
    '/student-government/commissions',
    '/student-government/osr',
  ],
  all: [
    '/',
    '/services',
    '/services/grievance',
    '/services/proposals',
    '/services/proposals/track',
    '/services/track',
    '/transparency',
    '/hub',
    '/hub/commute',
    '/hub/commute/contribute',
    '/hub/commute/leaderboard',
    '/directory',
    '/student-government',
    '/student-government/councils',
    '/student-government/commissions',
    '/student-government/osr',
    '/about',
    '/news',
    '/osr',
  ],
};

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

function normalizeRoute(route) {
  const trimmed = String(route || '').trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function parseAuditRoutes(env = process.env) {
  const rawRoutes = String(env.AUDIT_ROUTES || '').trim();
  if (rawRoutes) {
    return rawRoutes
      .split(',')
      .map(normalizeRoute)
      .filter(Boolean);
  }

  const requestedGroup = String(env.AUDIT_ROUTE_GROUP || 'core').trim().toLowerCase();
  return ROUTE_GROUPS[requestedGroup] || ROUTE_GROUPS.core;
}

function parseStrictMode(value = process.env.AUDIT_STRICT) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
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

function formatFailureLine(failure) {
  return `- ${failure.viewport} ${failure.route}: ${failure.id} (${failure.impact}) - ${failure.help}`;
}

function formatNavigationTarget(startUrl, finalUrl) {
  return finalUrl && finalUrl !== startUrl ? `${startUrl} -> ${finalUrl}` : startUrl;
}

function isAuthRedirectTarget(startUrl, finalUrl) {
  if (!finalUrl || finalUrl === startUrl) {
    return false;
  }

  try {
    const parsed = new URL(finalUrl);
    return parsed.pathname === '/login' && parsed.searchParams.has('callbackUrl');
  } catch {
    return false;
  }
}

async function ensureOutputDir() {
  const outputDir = path.join(process.cwd(), 'artifacts', 'a11y');
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
}

async function writeReports({
  results,
  pageLoadFailures,
  accessibilityFailures,
  strictMode,
  baseUrl,
  routeGroup,
  impactThreshold,
}) {
  const outputDir = await ensureOutputDir();
  const generatedAt = new Date().toISOString();
  const allWarnings = results.flatMap((result) =>
    result.warnings.map((warning) => ({
      viewport: result.viewport,
      route: result.route,
      ...warning,
    })),
  );

  await fs.writeFile(
    path.join(outputDir, 'axe-results.json'),
    JSON.stringify(
      {
        generatedAt,
        baseUrl,
        routeGroup,
        strictMode,
        impactThreshold,
        results,
        pageLoadFailures,
        accessibilityFailures,
        warnings: allWarnings,
      },
      null,
      2,
    ),
    'utf8',
  );

  const scannedRoutes = Array.from(new Set(results.map((result) => result.route)));
  const lines = [
    '# Accessibility Audit',
    '',
    `Generated: ${generatedAt}`,
    `Base URL: ${baseUrl}`,
    `Route group: ${routeGroup}`,
    `Mode: ${strictMode ? 'strict' : 'developer-first report-only accessibility'}`,
    `Impact threshold: ${impactThreshold}`,
    '',
    `Scanned route/viewport pairs: ${results.length}`,
    `Scanned routes: ${scannedRoutes.join(', ')}`,
    '',
    '## Page-load failures',
    '',
  ];

  if (pageLoadFailures.length > 0) {
    for (const failure of pageLoadFailures) {
      lines.push(formatFailureLine(failure));
      lines.push(`  Target: ${failure.targets}`);
    }
  } else {
    lines.push('No page-load failures were detected.');
  }

  lines.push('', '## Accessibility findings', '');
  if (accessibilityFailures.length > 0) {
    for (const failure of accessibilityFailures) {
      lines.push(formatFailureLine(failure));
      lines.push(`  Targets: ${failure.targets || 'No target details available'}`);
      if (failure.helpUrl) {
        lines.push(`  Help: ${failure.helpUrl}`);
      }
    }
  } else {
    lines.push(`No ${impactThreshold}+ Axe violations were detected.`);
  }

  lines.push('', '## Console and page errors', '');
  if (allWarnings.length > 0) {
    for (const warning of allWarnings.slice(0, 50)) {
      lines.push(`- ${warning.viewport} ${warning.route}: ${warning.type} - ${warning.text}`);
    }
    if (allWarnings.length > 50) {
      lines.push(`- ${allWarnings.length - 50} additional warning(s) omitted from this summary.`);
    }
  } else {
    lines.push('No console errors or page exceptions were captured.');
  }

  lines.push('', '## Next steps', '');
  if (pageLoadFailures.length > 0) {
    lines.push('- Start the dev server first and confirm AUDIT_BASE_URL is reachable.');
  }
  if (accessibilityFailures.length > 0 && !strictMode) {
    lines.push('- Review accessibility findings above; rerun with AUDIT_STRICT=1 when ready to gate locally.');
  }
  if (accessibilityFailures.length > 0 && strictMode) {
    lines.push('- Fix the listed accessibility findings or lower AUDIT_A11Y_IMPACT for exploratory runs.');
  }
  if (pageLoadFailures.length === 0 && accessibilityFailures.length === 0) {
    lines.push('- No blocking follow-up from this audit run.');
  }

  await fs.writeFile(path.join(outputDir, 'axe-summary.md'), `${lines.join('\n')}\n`, 'utf8');
}

async function auditRoute({ context, viewport, route, baseUrl, impactThreshold }) {
  const page = await context.newPage();
  const warnings = [];
  const pageLoadFailures = [];
  const accessibilityFailures = [];
  const url = `${baseUrl}${route}`;
  let finalUrl = url;
  let status = 0;
  let violations = [];
  let passes = 0;
  let incomplete = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      warnings.push({ type: 'console-error', text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    warnings.push({ type: 'page-error', text: error.message });
  });

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(500);

    finalUrl = page.url();
    status = response?.status() || 0;
    const redirectedToAuth = isAuthRedirectTarget(url, finalUrl);

    if (redirectedToAuth) {
      warnings.push({
        type: 'auth-redirect',
        text: `Skipped protected route: ${formatNavigationTarget(url, finalUrl)}`,
      });
    } else if (status >= 400 || status === 0) {
      pageLoadFailures.push({
        viewport: viewport.name,
        route,
        id: 'page-load',
        impact: 'critical',
        help: `Page returned HTTP ${status || 'unknown'}`,
        targets: formatNavigationTarget(url, finalUrl),
      });
    }

    if (status > 0 && status < 400 && !redirectedToAuth) {
      const axeResult = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('.pdf-embed-shell iframe')
        .analyze();

      violations = axeResult.violations;
      passes = axeResult.passes.length;
      incomplete = axeResult.incomplete;

      for (const violation of axeResult.violations) {
        if (!shouldFailViolation(violation, impactThreshold)) {
          continue;
        }

        accessibilityFailures.push({
          viewport: viewport.name,
          route,
          id: violation.id,
          impact: violation.impact || 'unknown',
          help: violation.help,
          helpUrl: violation.helpUrl,
          targets: formatNodeTargets(violation.nodes),
        });
      }
    }
  } catch (error) {
    finalUrl = page.url();
    pageLoadFailures.push({
      viewport: viewport.name,
      route,
      id: 'page-load',
      impact: 'critical',
      help: error.message,
      targets: formatNavigationTarget(url, finalUrl),
    });
  } finally {
    await page.close();
  }

  return {
    result: {
      viewport: viewport.name,
      route,
      url,
      finalUrl,
      status,
      violations,
      warnings,
      passes,
      incomplete,
    },
    pageLoadFailures,
    accessibilityFailures,
  };
}

async function run() {
  const baseUrl = normalizeBaseUrl(process.env.AUDIT_BASE_URL);
  const routeGroup = String(process.env.AUDIT_ROUTE_GROUP || 'core').trim().toLowerCase();
  const routes = parseAuditRoutes(process.env);
  const strictMode = parseStrictMode(process.env.AUDIT_STRICT);
  const impactThreshold = String(process.env.AUDIT_A11Y_IMPACT || 'serious').toLowerCase();
  const browser = await chromium.launch({ chromiumSandbox: false });
  const results = [];
  const pageLoadFailures = [];
  const accessibilityFailures = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
      });

      for (const route of routes) {
        const audit = await auditRoute({ context, viewport, route, baseUrl, impactThreshold });
        results.push(audit.result);
        pageLoadFailures.push(...audit.pageLoadFailures);
        accessibilityFailures.push(...audit.accessibilityFailures);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  await writeReports({
    results,
    pageLoadFailures,
    accessibilityFailures,
    strictMode,
    baseUrl,
    routeGroup: process.env.AUDIT_ROUTES ? 'custom' : routeGroup,
    impactThreshold,
  });

  if (pageLoadFailures.length > 0) {
    console.error(
      `Accessibility audit failed with ${pageLoadFailures.length} page-load failure(s). Start the dev server first and see artifacts/a11y/axe-summary.md.`,
    );
    process.exit(1);
  }

  if (strictMode && accessibilityFailures.length > 0) {
    console.error(
      `Accessibility audit failed strict mode with ${accessibilityFailures.length} finding(s). See artifacts/a11y/axe-summary.md.`,
    );
    process.exit(1);
  }

  if (accessibilityFailures.length > 0) {
    console.warn(
      `Accessibility audit reported ${accessibilityFailures.length} finding(s). See artifacts/a11y/axe-summary.md. Rerun with AUDIT_STRICT=1 to fail on these findings.`,
    );
    return;
  }

  console.log(`Accessibility audit passed for ${routes.length} route(s) across ${VIEWPORTS.length} viewport(s).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
