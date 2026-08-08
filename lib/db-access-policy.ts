export const DATABASE_RUNTIME_ENV_VARS = ['DATABASE_URL'] as const;
export const DATABASE_MIGRATION_ENV_VARS = ['DIRECT_URL'] as const;

export const DATABASE_ROLES = {
    migrator: 'osr_migrator',
    runtime: 'osr_app_rw',
    exporter: 'osr_export_ro',
    emergencyReader: 'osr_admin_ro',
} as const;

export const SANITIZED_EXPORT_VIEWS = [
    'public_sheet_news_posts',
    'public_sheet_commute_routes',
    'public_sheet_directory_entries',
    'public_sheet_quick_links',
    'public_sheet_hub_guides',
] as const;

export const BLOCKED_SHEETS_EXPORT_FIELDS = [
    'studentId',
    'studentEmail',
    'complaintNarrative',
    'trackingTokenHash',
    'optionalUpdateDestination',
    'payloadJson',
    'recipientEmail',
    'submitterEmail',
    'reviewNotesPrivate',
] as const;

export function isSheetsExportEnabled(): boolean {
    return process.env.SHEETS_EXPORT_ENABLED === 'true';
}
