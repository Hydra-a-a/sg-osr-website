import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { logAuditAction } from '@/lib/audit';
import { TicketSubmissionSchema } from '@/features/tickets/schema';
import { createTicketSubmission } from '@/features/tickets/server/create-ticket';

const MIN_SUBMISSION_AGE_MS = 1000;

function parsePositiveIntEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTicketSubmissionRateLimitConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const defaultLimit = isProduction ? 3 : 30;

  return {
    limit: parsePositiveIntEnv(process.env.TICKET_SUBMISSION_RATE_LIMIT_MAX, defaultLimit),
    windowMs: parsePositiveIntEnv(process.env.TICKET_SUBMISSION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
    disableInDev: String(process.env.TICKET_SUBMISSION_RATE_LIMIT_DISABLE_IN_DEV || '').trim().toLowerCase() === 'true',
  };
}

function parseBoolean(value: FormDataEntryValue | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

function parseOptionalNumber(value: FormDataEntryValue | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

async function parseTicketRequestPayload(request: Request): Promise<{ payload: unknown; attachmentFile?: File }> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const candidateFile = form.get('attachment');
    const attachmentFile = candidateFile instanceof File && candidateFile.size > 0
      ? candidateFile
      : undefined;

    return {
      payload: {
        studentId: String(form.get('studentId') || ''),
        campus: String(form.get('campus') || ''),
        college: String(form.get('college') || ''),
        category: String(form.get('category') || ''),
        subject: String(form.get('subject') || ''),
        complaintNarrative: String(form.get('complaintNarrative') || ''),
        attachmentKind: String(form.get('attachmentKind') || 'document'),
        attachmentUrl: (() => {
          const value = String(form.get('attachmentUrl') || '').trim();
          return value || undefined;
        })(),
        isAnonymous: parseBoolean(form.get('isAnonymous') || undefined),
        contactEmail: (() => {
          const value = String(form.get('contactEmail') || '').trim();
          return value || undefined;
        })(),
        updatesOptIn: parseBoolean(form.get('updatesOptIn') || undefined),
        updatesChannel: String(form.get('updatesChannel') || 'none').trim().toLowerCase(),
        updatesDestination: (() => {
          const value = String(form.get('updatesDestination') || '').trim();
          return value || undefined;
        })(),
        updatesNotes: String(form.get('updatesNotes') || '').trim(),
        honeypot: String(form.get('honeypot') || ''),
        timestamp: parseOptionalNumber(form.get('timestamp') || undefined),
      },
      attachmentFile,
    };
  }

  const payload = await request.json();

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const attachmentUrl = typeof record.attachmentUrl === 'string' ? record.attachmentUrl.trim() : undefined;
    const contactEmail = typeof record.contactEmail === 'string' ? record.contactEmail.trim() : undefined;
    const updatesDestination = typeof record.updatesDestination === 'string' ? record.updatesDestination.trim() : undefined;
    const updatesNotes = typeof record.updatesNotes === 'string' ? record.updatesNotes.trim() : '';

    return {
      payload: {
        ...record,
        attachmentKind: typeof record.attachmentKind === 'string'
          ? record.attachmentKind.trim().toLowerCase()
          : record.attachmentKind,
        attachmentUrl: attachmentUrl || undefined,
        contactEmail: contactEmail || undefined,
        updatesDestination: updatesDestination || undefined,
        updatesNotes,
        isAnonymous: typeof record.isAnonymous === 'string'
          ? parseBoolean(record.isAnonymous)
          : record.isAnonymous,
        updatesOptIn: typeof record.updatesOptIn === 'string'
          ? parseBoolean(record.updatesOptIn)
          : record.updatesOptIn,
        updatesChannel: typeof record.updatesChannel === 'string'
          ? record.updatesChannel.trim().toLowerCase()
          : record.updatesChannel,
      },
    };
  }

  return { payload };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const session = await auth();

  if (!session?.user?.email) {
    logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Not authenticated' });
    return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
  }

  const sessionEmail = session.user.email.toLowerCase().trim();
  if (!sessionEmail.endsWith('@rtu.edu.ph')) {
    logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Non-RTU email' });
    return withNoStore(toApiResponse(new ApiError(403, 'FORBIDDEN', 'Forbidden')));
  }

  try {
    requireSameOriginRequest(request);
  } catch (error) {
    logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Origin check failed' });
    return withNoStore(toApiResponse(error));
  }

  const rateLimitConfig = resolveTicketSubmissionRateLimitConfig();
  const shouldSkipRateLimit = process.env.NODE_ENV !== 'production' && rateLimitConfig.disableInDev;

  if (!shouldSkipRateLimit) {
    const limit = await checkRateLimit(
      `tickets_api_${sessionEmail}_${ip}`,
      rateLimitConfig.limit,
      rateLimitConfig.windowMs,
    );
    if (!limit.success) {
      logAuditAction('TICKET_RATE_LIMITED', { ip, sessionEmail });
      return rateLimitResponse(limit, 'Too many requests. Try again later.');
    }
  }

  try {
    const { payload, attachmentFile } = await parseTicketRequestPayload(request);
    const result = TicketSubmissionSchema.safeParse(payload);

    if (!result.success) {
      logAuditAction('TICKET_SUBMISSION_FAILED', { ip, reason: 'Schema validation failure' });
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid request payload')));
    }

    const data = result.data;

    if (data.honeypot) {
      return withNoStore(NextResponse.json({ success: true, ticketId: 'TKT-0000-FAKE' }));
    }
    if (data.timestamp && Date.now() - data.timestamp < MIN_SUBMISSION_AGE_MS) {
      return withNoStore(NextResponse.json({ success: true, ticketId: 'TKT-0000-FAKE' }));
    }

    const responseBody = await createTicketSubmission({
      data,
      attachmentFile,
      sessionEmail,
      sessionUserName: session.user.name,
      ip,
    });

    return withNoStore(NextResponse.json(responseBody));
  } catch (error) {
    console.error('[Tickets API] Unhandled error:', redactErrorForLog(error));
    if (error instanceof SyntaxError) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_JSON', 'Invalid request payload')));
    }
    return withNoStore(toApiResponse(error));
  }
}
