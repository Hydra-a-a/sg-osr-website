const baseUrl = (process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const shouldStartLocalServer = !process.env.AUDIT_BASE_URL;
const routes = (process.env.AUDIT_ROUTES || '/,/hub,/directory/student-organizations,/services/grievance')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean)
  .map((route) => `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`);
const enforcePerformanceBudgets = process.env.AUDIT_ENFORCE === '1';
const performanceBudgetSeverity = enforcePerformanceBudgets ? 'error' : 'warn';

module.exports = {
  ci: {
    collect: {
      url: routes,
      ...(shouldStartLocalServer
        ? {
            startServerCommand: 'npm run start -- --hostname 127.0.0.1 --port 3000',
            startServerReadyPattern: 'Local:',
          }
        : {}),
      numberOfRuns: Number(process.env.LHCI_RUNS || 3),
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          disabled: false,
        },
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --headless=new',
      },
    },
    assert: {
      aggregationMethod: 'median',
      assertions: {
        'total-blocking-time': [performanceBudgetSeverity, { maxNumericValue: 300 }],
        'largest-contentful-paint': [performanceBudgetSeverity, { maxNumericValue: 3500 }],
        'cumulative-layout-shift': [performanceBudgetSeverity, { maxNumericValue: 0.1 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'button-name': 'error',
        'color-contrast': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'image-alt': 'error',
        'input-image-alt': 'error',
        'label': 'error',
        'link-name': 'error',
        'meta-viewport': 'error',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './artifacts/lighthouse',
    },
  },
};
