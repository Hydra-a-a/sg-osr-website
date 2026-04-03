import { NextResponse } from 'next/server';
import { FormSubmissionSchema } from '@/schemas/webhooks';
import { checkRateLimit } from '@/lib/rate-limit';
import { submitToGoogleForm } from '@/lib/google-forms';
import { logAuditAction } from '@/lib/audit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function getCanonicalOrigin(request: Request): string | null {
    const configuredOrigin = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    if (configuredOrigin) {
        try {
            return new URL(configuredOrigin).origin;
        } catch {
            return null;
        }
    }

    try {
        return new URL(request.url).origin;
    } catch {
        return null;
    }
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    const session = await auth();

    if (!session?.user?.email) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Authentication required' });
        return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
    }

    const sessionEmail = session.user.email.toLowerCase().trim();
    if (!sessionEmail.endsWith('@rtu.edu.ph')) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Email domain rejected' });
        return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Forbidden')));
    }

    const origin = request.headers.get('origin');
    const expectedOrigin = getCanonicalOrigin(request);
    if (!origin || !expectedOrigin) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Origin header missing or expected origin unavailable' });
        return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Forbidden')));
    }

    try {
        const parsedOrigin = new URL(origin).origin;
        if (parsedOrigin !== expectedOrigin) {
            logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Origin header mismatch' });
            return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Forbidden')));
        }
    } catch {
        return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Forbidden')));
    }

    // keeping this low so bots don't nuke my inbox
    const limit = await checkRateLimit(`forms_api_${ip}`, 5, 60000);

    if (!limit.success) {
        logAuditAction('FORM_RATE_LIMITED', { ip });
        const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
        if (limit.retryAfter) {
            response.headers.set('Retry-After', String(limit.retryAfter));
        }
        return withNoStore(response);
    }

    try {
        const body = await request.json();

        // zod validate because i trust nobody
        const result = FormSubmissionSchema.safeParse(body);

        if (!result.success) {
            logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Schema validation mismatch' });
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid request payload')));
        }

        const sanitizedData = result.data;

        // honeypot trap catch bots before they sleep with my db
        if (sanitizedData.honeypot) {
            console.log(`[Form API] Bot trapped! Honeypot filled: ${sanitizedData.honeypot}`);
            return withNoStore(NextResponse.json({ success: true, message: `${sanitizedData.formType} form submitted successfully` }));
        }

        // if you fill this out in 3 seconds you're literally a bot
        if (sanitizedData.timestamp) {
            const timeElapsed = Date.now() - sanitizedData.timestamp;
            if (timeElapsed < 3000) {
                console.log(`[Form API] Bot trapped! Fast submission detected: ${timeElapsed}ms`);
                return withNoStore(NextResponse.json({ success: true, message: `${sanitizedData.formType} form submitted successfully` }));
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

        return withNoStore(NextResponse.json({
            success: true,
            message: `${sanitizedData.formType} form submitted successfully`,
            timestamp: new Date().toISOString(),
        }));

    } catch (error) {
        logAuditAction('FORM_VALIDATION_FAILED', { ip, reason: 'Invalid JSON or unhandled exception' });

        if (error instanceof SyntaxError) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_JSON', 'Invalid request payload')));
        }

        console.error('Form API Error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
