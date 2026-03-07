const { z } = require('zod');

// Schema replica
const NewsPostSchema = z.object({
    id: z.string(),
    source: z.string().max(100),
    caption: z.string().max(10000), // Large but bounded
    imageUrl: z.union([
        z.string().url(),
        z.literal(''),
        z.null()
    ]).optional(),
    publishedAt: z.string(),
    fbLink: z.string()
        .url()
        .refine(url => url.includes('facebook.com') || url.includes('fb.watch'), {
            message: "Only official Facebook links allowed"
        }),
});

async function run() {
    const rawData = [
        [
            "2026-03-06T14:08:11.000Z",
            "Test page osr Update",
            "testing testing osr testing\n\n#OSRUPDATES",
            "Social Media",
            "Test page osr"
        ],
        [
            "2026-03-06T14:23:13.000Z",
            "Test page osr Update",
            "testing testing osr testing 1\n\n#OSRUPDATES",
            "Social Media",
            "Test page osr"
        ]
    ];

    const posts = rawData.map((row, index) => {
        const postData = {
            id: row[0] || `news-${index}`,
            source: row[1] || 'OSR',
            caption: row[2] || '',
            imageUrl: row[3] || null,
            publishedAt: row[4] || new Date().toISOString(),
            fbLink: (row[5] && row[5].includes('facebook.com')) ? row[5] : 'https://www.facebook.com/rtu.osr',
        };

        const result = NewsPostSchema.safeParse(postData);
        if (!result.success) {
            console.error("Zod Validation Error on row", index);
            console.error(result.error.errors);
        }
        return result.success ? result.data : null;
    }).filter(Boolean);

    console.log("Valid posts:", posts);
}
run();
