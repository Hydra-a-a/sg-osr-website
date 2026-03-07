require('dotenv').config({ path: '../.env.local' });
const secret = process.env.MAKE_WEBHOOK_SECRET || process.env.IFTTT_WEBHOOK_SECRET;

async function run() {
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
