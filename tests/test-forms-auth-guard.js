const candidateBaseUrls = [
  process.env.FORMS_TEST_BASE_URL,
  'http://localhost:3001',
  'http://localhost:3000',
].filter(Boolean);

async function isServerReachable(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/news`, { method: 'GET' });
    return res.ok || res.status === 429;
  } catch {
    return false;
  }
}

async function findBaseUrl() {
  for (const url of candidateBaseUrls) {
    if (await isServerReachable(url)) {
      return url;
    }
  }
  return null;
}

async function run() {
  const baseUrl = await findBaseUrl();

  if (!baseUrl) {
    console.error('No local app server detected. Start `npm run dev` or `npx vercel dev` first.');
    process.exit(1);
  }

  const payload = {
    formType: 'feedback',
    name: 'Unauthenticated Test User',
    email: 'test@rtu.edu.ph',
    subject: 'Auth guard regression test',
    message: 'This should be rejected when no authenticated session is present.',
    timestamp: Date.now() - 5000,
    honeypot: '',
  };

  const response = await fetch(`${baseUrl}/api/forms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify(payload),
  });

  const allowedStatuses = new Set([401, 403]);
  const bodyText = await response.text();

  console.log(`Base URL: ${baseUrl}`);
  console.log(`POST /api/forms status: ${response.status}`);
  console.log(`Response body: ${bodyText}`);

  if (!allowedStatuses.has(response.status)) {
    console.error('FAILED: Expected /api/forms unauthenticated status to be 401 or 403.');
    process.exit(1);
  }

  console.log('PASS: /api/forms unauthenticated request is blocked as expected.');
}

run().catch((error) => {
  console.error('Test failed with runtime error:', error);
  process.exit(1);
});
