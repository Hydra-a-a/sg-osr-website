const crypto = require('crypto');

const SECRET = "AzxlJaklsO1mas-salkasGaFsdFasdapoMnajhsdBalsd-asjka";
const URL = "http://localhost:3000/api/webhooks/make";

async function testWebhook() {
    console.log("Starting webhook test...");
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
        content: "Testing OSR Website Webhook #OSRUPDATES",
        imageUrl: "https://rtu.edu.ph/wp-content/uploads/2021/05/logo.png",
        sourcePage: "SSC",
        publishedAt: new Date().toISOString(),
        fbLink: "https://facebook.com/ssc"
    });

    const signature = crypto.createHmac('sha256', SECRET)
        .update(`${timestamp}.${body}`)
        .digest('hex');

    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-timestamp': timestamp,
                'x-webhook-signature': `sha256=${signature}`
            },
            body
        });

        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Result:', result);
    } catch (e) {
        console.error("Fetch failed (Web server likely not running):", e.message);
    }
}

testWebhook();
