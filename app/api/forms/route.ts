import { NextResponse } from 'next/server';
import { FormSubmissionSchema } from '@/schemas/webhooks';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    // keeping this low so bots don't nuke my inbox
    const limit = rateLimit(`forms_api_${ip}`, 5, 60000);

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    try {

        const body = await request.json();

        // zod validate because i trust nobody
        const result = FormSubmissionSchema.safeParse(body);

        if (!result.success) {

            return NextResponse.json(
                {
                    error: 'Validation failed',
                    details: result.error.issues.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                },
                { status: 400 }
            );
        }


        const sanitizedData = result.data;

        // honeypot trap catch bots before they sleep with my db
        if (sanitizedData.honeypot) {
            console.log(`[Form API] Bot trapped! Honeypot filled: ${sanitizedData.honeypot}`);

            return NextResponse.json({ success: true, message: `${sanitizedData.formType} form submitted successfully` });
        }

        // if you fill this out in 3 seconds you're literally a bot
        if (sanitizedData.timestamp) {
            const timeElapsed = Date.now() - sanitizedData.timestamp;
            if (timeElapsed < 3000) {
                console.log(`[Form API] Bot trapped! Fast submission detected: ${timeElapsed}ms`);

                return NextResponse.json({ success: true, message: `${sanitizedData.formType} form submitted successfully` });
            }
        }

        // brute forcing form submissions to google cause i'm too lazy for legit auth
        const formConfigs: Record<string, { url?: string; entries: Record<string, string> }> = {
            grievance: {
                url: process.env.GOOGLE_FORM_GRIEVANCE_URL,
                entries: {
                    name: process.env.GOOGLE_FORM_GRIEVANCE_NAME || 'entry.111111',
                    email: process.env.GOOGLE_FORM_GRIEVANCE_EMAIL || 'entry.222222',
                    subject: process.env.GOOGLE_FORM_GRIEVANCE_SUBJECT || 'entry.333333',
                    message: process.env.GOOGLE_FORM_GRIEVANCE_MESSAGE || 'entry.444444',
                }
            },
            feedback: {
                url: process.env.GOOGLE_FORM_FEEDBACK_URL,
                entries: {
                    name: process.env.GOOGLE_FORM_FEEDBACK_NAME || 'entry.111111',
                    email: process.env.GOOGLE_FORM_FEEDBACK_EMAIL || 'entry.222222',
                    subject: process.env.GOOGLE_FORM_FEEDBACK_SUBJECT || 'entry.333333',
                    message: process.env.GOOGLE_FORM_FEEDBACK_MESSAGE || 'entry.444444',
                }
            },
            contact: {
                url: process.env.GOOGLE_FORM_CONTACT_URL,
                entries: {
                    name: process.env.GOOGLE_FORM_CONTACT_NAME || 'entry.111111',
                    email: process.env.GOOGLE_FORM_CONTACT_EMAIL || 'entry.222222',
                    subject: process.env.GOOGLE_FORM_CONTACT_SUBJECT || 'entry.333333',
                    message: process.env.GOOGLE_FORM_CONTACT_MESSAGE || 'entry.444444',
                }
            }
        };

        const config = formConfigs[sanitizedData.formType as keyof typeof formConfigs];

        if (config && config.url) {

            const formData = new URLSearchParams();
            formData.append(config.entries.name, sanitizedData.name);
            formData.append(config.entries.email, sanitizedData.email);
            if (sanitizedData.subject) {
                formData.append(config.entries.subject, sanitizedData.subject);
            }
            formData.append(config.entries.message, sanitizedData.message);

            try {
                // sending it and praying it works so the user doesn't wait
                const googleRes = await fetch(config.url, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });

                if (!googleRes.ok) {
                    throw new Error('Google Forms responded with an error');
                }

                console.log(`[Form API] Successfully piped ${sanitizedData.formType} to Google Forms`);
            } catch (err) {
                console.error(`[Form API] Failed to forward to Google Forms:`, err);
                // ignoring errors so the user leaves me alone
            }
        } else {

            console.log(`[Form API] Placeholder mode for ${sanitizedData.formType}`);
            console.log(`Data received:`, sanitizedData);
            console.log(`To enable live connection, set GOOGLE_FORM_${sanitizedData.formType.toUpperCase()}_URL in .env.local`);

        }

        return NextResponse.json({
            success: true,
            message: `${sanitizedData.formType} form submitted successfully`,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid JSON payload' },
                { status: 400 }
            );
        }

        console.error('Form API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
