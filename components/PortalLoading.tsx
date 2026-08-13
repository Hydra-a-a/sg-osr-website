type PortalLoadingVariant = 'page' | 'hub' | 'directory' | 'directory-data' | 'services' | 'grievance' | 'admin';

type PortalLoadingProps = {
    variant?: PortalLoadingVariant;
};

function SkeletonLine({ className = '' }: { className?: string }) {
    return <span className={`portal-loading-skeleton portal-loading-line ${className}`} aria-hidden="true" />;
}

function LoadingPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`portal-loading-panel ${className}`}>{children}</div>;
}

function PageLoading() {
    return (
        <>
            <div className="portal-loading-heading">
                <SkeletonLine className="portal-loading-kicker" />
                <SkeletonLine className="portal-loading-title portal-loading-title-wide" />
                <SkeletonLine className="portal-loading-lead" />
                <SkeletonLine className="portal-loading-lead portal-loading-lead-short" />
            </div>
            <div className="portal-loading-card-grid">
                {[0, 1, 2].map((item) => (
                    <LoadingPanel key={item}>
                        <SkeletonLine className="portal-loading-icon" />
                        <SkeletonLine className="portal-loading-card-title" />
                        <SkeletonLine className="portal-loading-card-line" />
                        <SkeletonLine className="portal-loading-card-line portal-loading-card-line-short" />
                    </LoadingPanel>
                ))}
            </div>
        </>
    );
}

function HubLoading() {
    return (
        <>
            <div className="portal-loading-heading portal-loading-heading-narrow">
                <SkeletonLine className="portal-loading-kicker" />
                <SkeletonLine className="portal-loading-title" />
                <SkeletonLine className="portal-loading-lead" />
            </div>
            <div className="portal-loading-hub-layout">
                <LoadingPanel className="portal-loading-sidebar">
                    <SkeletonLine className="portal-loading-card-title" />
                    {[0, 1, 2, 3].map((item) => <SkeletonLine key={item} className="portal-loading-card-line" />)}
                </LoadingPanel>
                <LoadingPanel className="portal-loading-guide-well">
                    <div className="portal-loading-guide-head">
                        <SkeletonLine className="portal-loading-title portal-loading-guide-title" />
                        <SkeletonLine className="portal-loading-button" />
                    </div>
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="portal-loading-guide-row">
                            <SkeletonLine className="portal-loading-guide-mark" />
                            <div className="portal-loading-guide-copy">
                                <SkeletonLine className="portal-loading-card-title" />
                                <SkeletonLine className="portal-loading-card-line" />
                            </div>
                        </div>
                    ))}
                </LoadingPanel>
            </div>
        </>
    );
}

function DirectoryLoading({ dataOnly = false }: { dataOnly?: boolean }) {
    return (
        <>
            <div className="portal-loading-heading portal-loading-heading-narrow">
                {!dataOnly && <SkeletonLine className="portal-loading-back-link" />}
                <SkeletonLine className="portal-loading-kicker" />
                <SkeletonLine className="portal-loading-title" />
                <SkeletonLine className="portal-loading-lead" />
            </div>
            <div className={`portal-loading-directory-grid ${dataOnly ? 'portal-loading-directory-grid-data' : ''}`}>
                {[0, 1].map((item) => (
                    <LoadingPanel key={item}>
                        <SkeletonLine className="portal-loading-icon" />
                        <SkeletonLine className="portal-loading-card-title" />
                        <SkeletonLine className="portal-loading-card-line" />
                        <SkeletonLine className="portal-loading-card-line" />
                        <SkeletonLine className="portal-loading-card-line portal-loading-card-line-short" />
                        <SkeletonLine className="portal-loading-button portal-loading-button-wide" />
                    </LoadingPanel>
                ))}
            </div>
        </>
    );
}

function ServicesLoading() {
    return (
        <>
            <div className="portal-loading-heading portal-loading-services-heading">
                <SkeletonLine className="portal-loading-back-link" />
                <SkeletonLine className="portal-loading-kicker" />
                <SkeletonLine className="portal-loading-title portal-loading-title-wide" />
                <SkeletonLine className="portal-loading-lead" />
            </div>
            <div className="portal-loading-card-grid portal-loading-services-grid">
                {[0, 1, 2].map((item) => (
                    <LoadingPanel key={item}>
                        <SkeletonLine className="portal-loading-icon" />
                        <SkeletonLine className="portal-loading-card-title" />
                        <SkeletonLine className="portal-loading-card-line" />
                        <SkeletonLine className="portal-loading-card-line portal-loading-card-line-short" />
                        <SkeletonLine className="portal-loading-button" />
                    </LoadingPanel>
                ))}
            </div>
        </>
    );
}

function GrievanceLoading() {
    return (
        <>
            <div className="portal-loading-heading portal-loading-heading-narrow">
                <SkeletonLine className="portal-loading-back-link" />
                <SkeletonLine className="portal-loading-kicker" />
                <SkeletonLine className="portal-loading-title" />
                <SkeletonLine className="portal-loading-lead" />
            </div>
            <div className="portal-loading-form-layout">
                <LoadingPanel>
                    <SkeletonLine className="portal-loading-card-title" />
                    <div className="portal-loading-form-grid">
                        {[0, 1, 2, 3, 4, 5].map((item) => <SkeletonLine key={item} className="portal-loading-input" />)}
                    </div>
                    <SkeletonLine className="portal-loading-textarea" />
                    <SkeletonLine className="portal-loading-button portal-loading-button-wide" />
                </LoadingPanel>
                <LoadingPanel className="portal-loading-aside">
                    <SkeletonLine className="portal-loading-card-title" />
                    <SkeletonLine className="portal-loading-card-line" />
                    <SkeletonLine className="portal-loading-card-line" />
                    <SkeletonLine className="portal-loading-card-line portal-loading-card-line-short" />
                </LoadingPanel>
            </div>
        </>
    );
}

function AdminLoading() {
    return (
        <>
            <div className="portal-loading-heading">
                <SkeletonLine className="portal-loading-kicker" />
                <SkeletonLine className="portal-loading-title portal-loading-title-wide" />
            </div>
            <div className="portal-loading-admin-grid">
                {[0, 1, 2].map((item) => <LoadingPanel key={item}><SkeletonLine className="portal-loading-card-title" /><SkeletonLine className="portal-loading-card-line" /></LoadingPanel>)}
            </div>
            <LoadingPanel className="portal-loading-admin-table">
                {[0, 1, 2, 3, 4].map((item) => <SkeletonLine key={item} className="portal-loading-table-row" />)}
            </LoadingPanel>
        </>
    );
}

export default function PortalLoading({ variant = 'page' }: PortalLoadingProps) {
    const label = variant === 'admin' ? 'Loading admin workspace' : 'Loading page';
    const content = variant === 'hub'
        ? <HubLoading />
        : variant === 'directory'
            ? <DirectoryLoading />
            : variant === 'directory-data'
                ? <DirectoryLoading dataOnly />
                : variant === 'services'
                    ? <ServicesLoading />
                    : variant === 'grievance'
                        ? <GrievanceLoading />
                        : variant === 'admin'
                            ? <AdminLoading />
                            : <PageLoading />;

    return (
        <main className={`portal-loading-shell portal-loading-${variant}`} aria-busy="true" aria-label={label}>
            <div className="portal-noise-overlay" aria-hidden="true" />
            <div className="container-main portal-loading-content">
                <span className="sr-only">{label}. Please wait.</span>
                {content}
            </div>
        </main>
    );
}
