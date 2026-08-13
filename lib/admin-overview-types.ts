export type AdminModuleKey =
    | 'grievances'
    | 'proposals'
    | 'routes'
    | 'lost-found'
    | 'users'
    | 'directory';

export type AdminDataSource = 'neon' | 'sheets' | 'hybrid';
export type AdminHealth = 'healthy' | 'attention' | 'unavailable';
export type AdminSurfaceSource = AdminDataSource | 'code' | 'linked';

export type AdminModuleSummary = {
    key: AdminModuleKey;
    source: AdminDataSource;
    health: AdminHealth;
    total: number;
    queued: number;
    attention: number;
    checkedAt: string;
    errorCode?: 'UNAVAILABLE';
};

export type AdminOverviewResponse = {
    success: boolean;
    modules: AdminModuleSummary[];
    checkedAt: string;
    surfaces?: AdminSurfaceSummary[];
};

export type AdminSurfaceSummary = {
    key: string;
    source: AdminSurfaceSource;
    health: AdminHealth;
    pendingDrafts: number;
    exportState: 'not-applicable' | 'pending' | 'healthy' | 'failed';
    publicHrefs: string[];
};
