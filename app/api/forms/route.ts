import { NextResponse } from 'next/server';
import { FormSubmissionSchema } from '@/schemas/webhooks';
import { checkRateLimit } from '@/lib/rate-limit';
import { submitToGoogleForm } from '@/lib/google-forms';
import { logAuditAction } from '@/lib/audit';
import { getClientIp } from '@/lib/security';
import { auth } from '@/lib/auth';

function getExpectedOrigin(request: Request): string | null {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = forwardedHost || request.headers.get('host');
    if (!host) return null;

    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`;
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    const session = await auth();

    if (!session?.user?.email) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Authentication required' });
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionEmail = session.user.email.toLowerCase().trim();
    if (!sessionEmail.endsWith('@rtu.edu.ph')) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Email domain rejected' });
        return NextResponse.json({ error: 'Only @rtu.edu.ph accounts are allowed' }, { status: 403 });
    }

    const origin = request.headers.get('origin');
    const expectedOrigin = getExpectedOrigin(request);
    if (origin && expectedOrigin) {
        try {
            const parsedOrigin = new URL(origin).origin;
            if (parsedOrigin !== expectedOrigin) {
                logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Origin header mismatch' });
                return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
            }
        } catch {
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }
    }

    // keeping this low so bots don't nuke my inbox
    const limit = await checkRateLimit(`forms_api_${ip}`, 5, 60000);

    if (!limit.success) {
        logAuditAction('FORM_RATE_LIMITED', { ip });
        const response = NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        if (limit.retryAfter) {
            response.headers.set('Retry-After', String(limit.retryAfter));
        }
        return response;
    }

    try {
        const body = await request.json();

        // zod validate because i trust nobody
        const result = FormSubmissionSchema.safeParse(body);

        if (!result.success) {
            logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Schema validation mismatch' });
            return NextResponse.json(
                { error: 'Validation failed' },
                { status: 400 }
            );
        }

        const sanitizedData = result.data;

        if (sanitizedData.isAnonymous && sanitizedData.formType !== 'grievance') {
            return NextResponse.json(
                { error: 'Anonymous submission is only allowed for grievance forms' },
                { status: 400 }
            );
        }

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

        // Optional Anonymization for Grievances
        if (sanitizedData.isAnonymous) {
            sanitizedData.name = 'Anonymous Student';
            sanitizedData.email = 'anonymous@rtu.edu.ph';
        } else {
            sanitizedData.email = sessionEmail;
            sanitizedData.name = session.user.name?.trim() || sanitizedData.name;
        }

        logAuditAction('FORM_SUBMITTED', {
            ip: 'redacted', // Don't log IP for successful submissions to protect privacy
            formType: sanitizedData.formType,
            isAnonymous: sanitizedData.isAnonymous
        });

        await submitToGoogleForm(sanitizedData.formType, sanitizedData);
        console.log(`[Form API] Successfully piped ${sanitizedData.formType} to Google Forms`);

        return NextResponse.json({
            success: true,
            message: `${sanitizedData.formType} form submitted successfully`,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Invalid JSON or unhandled exception' });

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
