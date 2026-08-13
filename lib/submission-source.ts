export type SubmissionSource = 'sheet' | 'db-with-sheets-fallback' | 'db';

export function resolveSubmissionSource(name: 'TICKET_SOURCE' | 'PROPOSAL_SOURCE'): SubmissionSource {
    const value = String(process.env[name] || 'sheet').trim().toLowerCase();
    if (value === 'db' || value === 'db-with-sheets-fallback') return value;
    return 'sheet';
}

export function isDurableSubmissionSource(name: 'TICKET_SOURCE' | 'PROPOSAL_SOURCE'): boolean {
    return resolveSubmissionSource(name) === 'db';
}
