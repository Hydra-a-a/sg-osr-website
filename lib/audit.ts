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
    | 'API_HARDENING_HIT'
    | 'WEBHOOK_REPLAY_DETECTED'
    | 'SCHEMA_VALIDATION_FAILED'
    | 'CLASSROOM_SUBMISSION_SUCCEEDED'
    | 'CLASSROOM_SUBMISSION_REJECTED'
    | 'CLASSROOM_DUPLICATE_BLOCKED';

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
