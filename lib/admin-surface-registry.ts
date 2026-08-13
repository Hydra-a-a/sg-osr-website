export type AdminSurfaceKey = 'grievances' | 'proposals' | 'routes' | 'lost-found' | 'users' | 'directory' | 'content' | 'classroom';
export type AdminSurfaceSource = 'neon' | 'sheets' | 'hybrid' | 'code' | 'linked';

export type AdminSurfaceRegistryEntry = {
    key: AdminSurfaceKey;
    label: string;
    description: string;
    adminHref: string;
    publicHrefs: string[];
    source: AdminSurfaceSource;
    editor: 'moderation' | 'content' | 'access' | 'linked' | 'read-only';
    actions: string[];
};

export const adminSurfaceRegistry: AdminSurfaceRegistryEntry[] = [
    { key: 'grievances', label: 'Grievances', description: 'Review tickets and publish resolutions.', adminHref: '/services/admin/grievances', publicHrefs: ['/services/grievance', '/services/track'], source: 'sheets', editor: 'moderation', actions: ['review', 'resolve', 'reply'] },
    { key: 'proposals', label: 'Proposals', description: 'Review project submissions and discussion.', adminHref: '/services/admin/proposals', publicHrefs: ['/services/proposals', '/services/proposals/track'], source: 'sheets', editor: 'moderation', actions: ['review', 'reply'] },
    { key: 'routes', label: 'Community routes', description: 'Moderate commuter route submissions.', adminHref: '/services/admin/routes', publicHrefs: ['/hub/commute', '/hub/commute/contribute', '/hub/commute/leaderboard'], source: 'sheets', editor: 'moderation', actions: ['approve', 'flag', 'restore confidence'] },
    { key: 'lost-found', label: 'Lost and found', description: 'Publish verified CSO bulletins.', adminHref: '/services/admin/lost-found', publicHrefs: ['/hub/lost-found'], source: 'neon', editor: 'moderation', actions: ['publish', 'resolve', 'moderate comments'] },
    { key: 'users', label: 'Access Management', description: 'Maintain leader and officer access.', adminHref: '/services/admin/users', publicHrefs: [], source: 'neon', editor: 'access', actions: ['grant', 'change role', 'revoke'] },
    { key: 'directory', label: 'Directory', description: 'Manage public directory fields and staged assets.', adminHref: '/services/admin/directory', publicHrefs: ['/directory/student-organizations', '/directory/university-offices'], source: 'hybrid', editor: 'content', actions: ['draft', 'preview', 'publish', 'export'] },
    { key: 'content', label: 'Website content', description: 'Draft, preview, and publish public collections.', adminHref: '/services/admin/content', publicHrefs: ['/', '/news', '/hub', '/directory/student-organizations'], source: 'hybrid', editor: 'content', actions: ['draft', 'preview', 'publish', 'history', 'sync news'] },
    { key: 'classroom', label: 'Classroom', description: 'Open protected course and coursework controls.', adminHref: '/services/admin/classroom', publicHrefs: ['/transparency'], source: 'linked', editor: 'linked', actions: ['create course', 'create coursework', 'publish coursework'] },
];

export function getAdminSurface(key: AdminSurfaceKey) {
    return adminSurfaceRegistry.find((surface) => surface.key === key) || null;
}
