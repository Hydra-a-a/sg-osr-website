export type AdminListQuery = {
    q: string;
    status: string;
    sort: string;
    dir: 'asc' | 'desc';
    page: number;
    record: string;
};

export function readAdminListQuery(searchParams: URLSearchParams): AdminListQuery {
    const rawPage = Number(searchParams.get('page') || 1);
    return {
        q: searchParams.get('q')?.trim() || '',
        status: searchParams.get('status')?.trim() || 'all',
        sort: searchParams.get('sort')?.trim() || '',
        dir: searchParams.get('dir') === 'desc' ? 'desc' : 'asc',
        page: Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1,
        record: searchParams.get('record')?.trim() || '',
    };
}

export function writeAdminListQuery(current: URLSearchParams, patch: Partial<AdminListQuery>): string {
    const next = new URLSearchParams(current);
    const values = { ...readAdminListQuery(current), ...patch };
    const fields: Array<keyof AdminListQuery> = ['q', 'status', 'sort', 'dir', 'page', 'record'];

    fields.forEach((field) => {
        const value = values[field];
        const isDefault = field === 'status' ? value === 'all' : field === 'dir' ? value === 'asc' : field === 'page' ? value === 1 : value === '';
        if (isDefault) next.delete(field);
        else next.set(field, String(value));
    });

    const serialized = next.toString();
    return serialized ? `?${serialized}` : '';
}
