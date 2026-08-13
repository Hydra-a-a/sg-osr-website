import type { ReactNode } from 'react';
export type { AdminModuleKey } from '@/lib/admin-overview-types';

export type AdminColumn<TRecord> = {
    key: string;
    label: string;
    priority?: 'primary' | 'secondary';
    sortable?: boolean;
    className?: string;
    getValue: (record: TRecord) => string | number;
    render?: (record: TRecord) => ReactNode;
};

export type AdminRecordAdapter<TRecord> = {
    getId: (record: TRecord) => string;
    getSearchText: (record: TRecord) => string;
    getStatus?: (record: TRecord) => string;
    getUpdatedAt?: (record: TRecord) => string;
};
