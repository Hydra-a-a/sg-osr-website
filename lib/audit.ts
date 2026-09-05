/**
 * Centralized audit logging for sensitive actions.
 * Writes structured JSON logs to the console, which are captured by Vercel/monitoring tools.
 */

export type AuditAction =
    | 'WEBHOOK_FAILED_AUTH'
    | 'WEBHOOK_PROCESSED'
    | 'WEBHOOK_FILTERED'
    | 'FORM_SUBMITTED'
    | 'FORM_RATE_LIMITED'
    | 'FORM_VALIDATION_FAILED'
    | 'AUTH_SIGN_IN'
    | 'AUTH_DOMAIN_REJECTED'
    | 'AUTH_UNAUTHORIZED_LEADER'
    | 'AUTH_ACCESS_UPDATED'
    | 'AUTH_ACCESS_REVOKED'
    | 'API_HARDENING_HIT'
    | 'WEBHOOK_REPLAY_DETECTED'
    | 'SCHEMA_VALIDATION_FAILED'
    | 'CLASSROOM_SUBMISSION_SUCCEEDED'
    | 'CLASSROOM_SUBMISSION_REJECTED'
    | 'CLASSROOM_DUPLICATE_BLOCKED'
    | 'CLASSROOM_COURSE_CREATED'
    | 'CLASSROOM_COURSE_CREATE_REJECTED'
    | 'CLASSROOM_COURSEWORK_CREATED'
    | 'CLASSROOM_COURSEWORK_CREATE_REJECTED'
    | 'CLASSROOM_COURSEWORK_PUBLISHED'
    | 'TICKET_SUBMITTED'
    | 'TICKET_SUBMISSION_FAILED'
    | 'TICKET_RATE_LIMITED'
    | 'NOTIFICATION_ENQUEUED'
    | 'NOTIFICATION_DEDUPED'
    | 'NOTIFICATION_SENT'
    | 'NOTIFICATION_SKIPPED'
    | 'NOTIFICATION_FAILED'
    | 'NOTIFICATION_DEAD_LETTER'
    | 'DIRECTORY_LOGO_UPLOADED'
    | 'DIRECTORY_LOGO_STAGED'
    | 'DIRECTORY_LOGO_REMOVED'
    | 'DIRECTORY_EXPORT_REQUESTED'
    | 'ADMIN_CONTENT_DRAFT_CREATED'
    | 'ADMIN_CONTENT_DRAFT_SAVED'
    | 'ADMIN_CONTENT_DRAFT_DISCARDED'
    | 'HUB_GUIDE_PDF_STAGED'
    | 'ADMIN_CONTENT_PUBLISHED'
    | 'ADMIN_CONTENT_HISTORY_READ'
    | 'ADMIN_NEWS_SYNC_REQUESTED';


export interface AuditLogDetails {
    ip?: string;
    formType?: string;
    source?: string;
    isAnonymous?: boolean;
    reason?: string;
    [key: string]: any;
}

export function logAuditAction(action: AuditAction, details: AuditLogDetails) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'AUDIT',
        action,
        ...details
    };

    // Log as JSON string so log parsers can easily index it
    console.log(JSON.stringify(logEntry));
}
