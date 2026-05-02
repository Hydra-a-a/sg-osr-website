const baseUrl = String(process.env.BASE_URL || process.env.SCHEDULER_BASE_URL || '').replace(/\/$/, '').trim();
const secret = String(process.env.NEWS_SYNC_SECRET || process.env.CRON_SECRET || '').trim();
const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

if (!baseUrl) {
  console.error('Missing BASE_URL or SCHEDULER_BASE_URL.');
  process.exit(1);
}

if (!secret) {
  console.error('Missing NEWS_SYNC_SECRET or CRON_SECRET.');
  process.exit(1);
}

const url = new URL('/api/news/sync', baseUrl);
if (dryRun) {
  url.searchParams.set('dryRun', '1');
}

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'x-news-sync-secret': secret,
    Accept: 'application/json',
  },
});

const body = await response.text();
console.log(body);

if (!response.ok) {
  process.exit(1);
}
