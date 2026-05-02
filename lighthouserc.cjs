const baseUrl = (process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const shouldStartLocalServer = !process.env.AUDIT_BASE_URL;
const routes = (process.env.AUDIT_ROUTES || '/,/services,/services/grievance,/services/proposals,/transparency,/hub,/directory')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean)
  .map((route) => `${baseUrl}${route.startsWith('/') ? route : `/${route}`}`);

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
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --headless=new',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.7 }],
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
