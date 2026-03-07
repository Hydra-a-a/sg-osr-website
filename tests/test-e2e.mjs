import fs from 'fs';

async function run() {
    const envFile = fs.readFileSync('../.env.local', 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
        if (line.includes('=')) {
            const parts = line.split('=');
            env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/['"]/g, '');
        }
    });

    const secret = env.MAKE_WEBHOOK_SECRET || env.IFTTT_WEBHOOK_SECRET;

    console.log("1. Sending mock Make.com payload to /api/webhooks/make...");
    const postRes = await fetch('http://localhost:3000/api/webhooks/make', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify({
            content: "Breaking News: Validation works perfectly!\n\n#OSRUPDATES",
            imageUrl: null,
            sourcePage: "Test page osr",
            publishedAt: new Date().toISOString()
        })
    });

    console.log("POST Response:", postRes.status, await postRes.text());

    console.log("\n2. Fetching /api/news to see if it renders validly...");
    const getRes = await fetch('http://localhost:3000/api/news');
    console.log("GET Response:", getRes.status);
    const data = await getRes.json();
    console.log(JSON.stringify(data, null, 2));
}
run();
