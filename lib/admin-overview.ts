import 'server-only';

import { getSheetData } from '@/lib/sheets';
import { TICKET_COLS } from '@/lib/tickets';
import { PROPOSALS_RANGE, resolveProposalsSpreadsheetId } from '@/lib/proposals';
import type { AdminDataSource, AdminHealth, AdminModuleKey, AdminModuleSummary } from '@/lib/admin-overview-types';
import { adminSurfaceRegistry } from '@/lib/admin-surface-registry';
import type { AdminSurfaceSummary } from '@/lib/admin-overview-types';

type ModuleCounts = Omit<AdminModuleSummary, 'key' | 'health' | 'checkedAt'>;

type Provider = {
    key: AdminModuleKey;
    source: AdminDataSource;
    load: () => Promise<ModuleCounts>;
};

function normalizeStatus(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function getSpreadsheetId(name: string): string {
    const value = String(process.env[name] || '').trim();
    if (!value) {
        throw new Error(`${name} is not configured.`);
    }
    return value;
}

async function getPrisma() {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
}

function countSheetRows(rows: string[][], statusIndex: number, queuedStatuses: string[], attentionStatuses: string[]): ModuleCounts {
    const records = rows.filter((row) => row.some((cell) => String(cell ?? '').trim()));
    const queued = new Set(queuedStatuses.map(normalizeStatus));
    const attention = new Set(attentionStatuses.map(normalizeStatus));

    return {
        source: 'sheets',
        total: records.length,
        queued: records.filter((row) => queued.has(normalizeStatus(row[statusIndex]))).length,
        attention: records.filter((row) => attention.has(normalizeStatus(row[statusIndex]))).length,
    };
}

async function loadGrievanceCounts(): Promise<ModuleCounts> {
    const rows = await getSheetData(getSpreadsheetId('TICKET_SPREADSHEET_ID'), 'Tickets!A2:AF');
    const counts = countSheetRows(
        rows,
        TICKET_COLS.STATUS,
        ['Open', 'In Progress', 'Appealed'],
        ['Appealed'],
    );
    return { ...counts, source: 'sheets' };
}

async function loadProposalCounts(): Promise<ModuleCounts> {
    const { spreadsheetId } = resolveProposalsSpreadsheetId();
    const rows = await getSheetData(spreadsheetId, PROPOSALS_RANGE);
    const counts = countSheetRows(
        rows,
        5,
        ['Pending Review', 'Under Review', 'Needs Revision'],
        ['Needs Revision'],
    );
    return { ...counts, source: 'sheets' };
}

async function loadRouteCounts(): Promise<ModuleCounts> {
    const { listModerationRoutes } = await import('@/lib/commute-providers');
    const routes = await listModerationRoutes();
    const queued = new Set(['pending', 'flagged for review']);
    const attention = new Set(['flagged']);

    return {
        source: 'sheets',
        total: routes.length,
        queued: routes.filter((route) => queued.has(normalizeStatus(route.reviewStatus))).length,
        attention: routes.filter((route) => attention.has(normalizeStatus(route.healthStatus))).length,
    };
}

async function loadLostFoundCounts(): Promise<ModuleCounts> {
    const prisma = await getPrisma();
    const groups = await prisma.lostFoundItem.groupBy({
        by: ['status'],
        _count: { _all: true },
    });
    const total = groups.reduce((sum, group) => sum + group._count._all, 0);
    const queued = groups
        .filter((group) => group.status === 'PENDING_REVIEW')
        .reduce((sum, group) => sum + group._count._all, 0);
    const attention = groups
        .filter((group) => group.status === 'PENDING_REVIEW' || group.status === 'REJECTED')
        .reduce((sum, group) => sum + group._count._all, 0);

    return { source: 'neon', total, queued, attention };
}

async function loadUserCounts(): Promise<ModuleCounts> {
    const prisma = await getPrisma();
    const [total, queued, attention] = await Promise.all([
        prisma.authorizedUser.count(),
        prisma.authorizedUser.count({ where: { accessEnabled: false } }),
        prisma.authorizedUser.count({ where: { revokedAfter: { not: null } } }),
    ]);

    return { source: 'neon', total, queued, attention };
}

async function loadDirectoryCounts(): Promise<ModuleCounts> {
    const prisma = await getPrisma();
    const [total, withoutLogo] = await Promise.all([
        prisma.directoryEntry.count({ where: { enabled: true } }),
        prisma.directoryEntry.count({
            where: {
                enabled: true,
                logo: { is: null },
            },
        }),
    ]);

    return {
        source: 'neon',
        total,
        queued: withoutLogo,
        attention: withoutLogo,
    };
}

const providers: Provider[] = [
    { key: 'grievances', source: 'sheets', load: loadGrievanceCounts },
    { key: 'proposals', source: 'sheets', load: loadProposalCounts },
    { key: 'routes', source: 'sheets', load: loadRouteCounts },
    { key: 'lost-found', source: 'neon', load: loadLostFoundCounts },
    { key: 'users', source: 'neon', load: loadUserCounts },
    { key: 'directory', source: 'neon', load: loadDirectoryCounts },
];

function unavailableSummary(provider: Provider, checkedAt: string): AdminModuleSummary {
    return {
        key: provider.key,
        source: provider.source,
        health: 'unavailable',
        total: 0,
        queued: 0,
        attention: 0,
        errorCode: 'UNAVAILABLE',
        checkedAt,
    };
}

export async function getAdminOverview(): Promise<AdminModuleSummary[]> {
    const results = await Promise.allSettled(providers.map(async (provider) => {
        const checkedAt = new Date().toISOString();
        const counts = await provider.load();
        const health: AdminHealth = counts.attention > 0 ? 'attention' : 'healthy';

        return {
            key: provider.key,
            source: provider.source,
            health,
            total: counts.total,
            queued: counts.queued,
            attention: counts.attention,
            checkedAt,
        } satisfies AdminModuleSummary;
    }));

    return results.map((result, index) => {
        const provider = providers[index];
        return result.status === 'fulfilled'
            ? result.value
            : unavailableSummary(provider, new Date().toISOString());
    });
}

export async function getAdminSurfaceOverview(): Promise<AdminSurfaceSummary[]> {
    try {
        const prisma = await getPrisma();
        const drafts = await prisma.adminContentDraft.groupBy({ by: ['contentType'], _count: { _all: true } });
        const draftCounts = new Map(drafts.map((draft: any) => [draft.contentType, draft._count._all]));
        const exportState = await prisma.directoryExportState.findUnique({ where: { id: 'directory' } });
        return adminSurfaceRegistry.map((surface) => {
            const pendingDrafts = draftCounts.get(surface.key) || 0;
            const exportStatus = surface.key === 'directory'
                ? exportState?.status === 'failed' ? 'failed' : exportState?.status === 'pending' ? 'pending' : exportState ? 'healthy' : 'not-applicable'
                : 'not-applicable';
            const health: AdminHealth = exportStatus === 'failed' || pendingDrafts > 0 ? 'attention' : 'healthy';
            return { key: surface.key, source: surface.source, health, pendingDrafts, exportState: exportStatus, publicHrefs: surface.publicHrefs };
        });
    } catch {
        return adminSurfaceRegistry.map((surface) => ({ key: surface.key, source: surface.source, health: surface.source === 'code' || surface.source === 'linked' ? 'healthy' : 'unavailable', pendingDrafts: 0, exportState: 'not-applicable', publicHrefs: surface.publicHrefs }));
    }
}
