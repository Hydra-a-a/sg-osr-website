'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, Columns3, Search } from 'lucide-react';
import type { AdminColumn, AdminRecordAdapter } from './admin-types';
import { readAdminListQuery, writeAdminListQuery } from './admin-query';

type AdminDataGridProps<TRecord> = {
    rows: TRecord[];
    columns: AdminColumn<TRecord>[];
    adapter: AdminRecordAdapter<TRecord>;
    selectedId?: string;
    onSelect: (record: TRecord) => void;
    emptyMessage?: string;
    searchPlaceholder?: string;
    pageSize?: number;
    toolbar?: ReactNode;
    loading?: boolean;
};

type SortState = {
    key: string;
    direction: 'asc' | 'desc';
};

export default function AdminDataGrid<TRecord>({
    rows,
    columns,
    adapter,
    selectedId,
    onSelect,
    emptyMessage = 'No records match the current view.',
    searchPlaceholder = 'Search records',
    pageSize = 25,
    toolbar,
    loading = false,
}: AdminDataGridProps<TRecord>) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = useMemo(() => readAdminListQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
    const [query, setQuery] = useState(initialQuery.q);
    const [page, setPage] = useState(initialQuery.page);
    const [sort, setSort] = useState<SortState | null>(initialQuery.sort ? { key: initialQuery.sort, direction: initialQuery.dir } : null);
    const [showSecondary, setShowSecondary] = useState(true);

    function syncQuery(patch: Parameters<typeof writeAdminListQuery>[1]) {
        const nextQuery = writeAdminListQuery(new URLSearchParams(searchParams.toString()), patch);
        router.replace(`${pathname}${nextQuery}`, { scroll: false });
    }

    const filteredRows = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        const next = normalized
            ? rows.filter((row) => adapter.getSearchText(row).toLowerCase().includes(normalized))
            : rows;

        if (!sort) return next;
        const column = columns.find((candidate) => candidate.key === sort.key);
        if (!column) return next;

        return [...next].sort((left, right) => {
            const leftValue = String(column.getValue(left)).toLowerCase();
            const rightValue = String(column.getValue(right)).toLowerCase();
            const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
            return sort.direction === 'asc' ? result : -result;
        });
    }, [adapter, columns, query, rows, sort]);

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const activePage = Math.min(page, pageCount);
    const pagedRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);

    function selectRow(row: TRecord) {
        onSelect(row);
        syncQuery({ record: adapter.getId(row), page: 1 });
    }

    function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: TRecord) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectRow(row);
        }
    }

    function toggleSort(column: AdminColumn<TRecord>) {
        if (!column.sortable) return;
        setPage(1);
        const nextSort: SortState = sort?.key === column.key
            ? { key: column.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
            : { key: column.key, direction: 'asc' };
        setSort(nextSort);
        syncQuery({ sort: nextSort.key, dir: nextSort.direction, page: 1 });
    }

    return (
        <div className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 border border-white/10 bg-black/10 px-3 text-sm text-slate-300 focus-within:border-amber-200/50">
                    <Search size={16} aria-hidden="true" />
                    <span className="sr-only">{searchPlaceholder}</span>
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                            syncQuery({ q: event.target.value, page: 1 });
                        }}
                        placeholder={searchPlaceholder}
                        className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-slate-500"
                    />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <details className="relative">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 border border-white/10 px-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                            <Columns3 size={16} aria-hidden="true" />
                            View
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-52 border border-white/10 bg-[#111e32] p-3 text-sm shadow-xl">
                            <label className="flex items-center justify-between gap-3 text-slate-200">
                                <span>Secondary columns</span>
                                <input type="checkbox" checked={showSecondary} onChange={(event) => setShowSecondary(event.target.checked)} className="accent-amber-300" />
                            </label>
                        </div>
                    </details>
                    {toolbar}
                </div>
            </div>

            <div className="mt-4 max-h-[50dvh] overflow-auto overscroll-contain border border-white/10 sm:max-h-[62vh] lg:max-h-[calc(100dvh-18rem)]">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#101d31] text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                            {columns.map((column) => {
                                const secondary = column.priority === 'secondary';
                                const isSorted = sort?.key === column.key;
                                return (
                                    <th key={column.key} scope="col" className={`${column.className || ''} ${secondary && !showSecondary ? 'hidden' : ''} px-3 py-3 font-semibold`}>
                                        {column.sortable ? (
                                            <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 text-left hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                                                {column.label}
                                                {isSorted ? (sort.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null}
                                            </button>
                                        ) : column.label}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {loading ? (
                            <tr><td colSpan={columns.length} className="px-3 py-14 text-center text-slate-400">Loading records...</td></tr>
                        ) : pagedRows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="px-3 py-14 text-center text-slate-400">{emptyMessage}</td></tr>
                        ) : pagedRows.map((row) => {
                            const id = adapter.getId(row);
                            const selected = id === selectedId;
                            return (
                                <tr
                                    key={id}
                                    tabIndex={0}
                                    aria-selected={selected}
                                    onClick={() => selectRow(row)}
                                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                                    className={`cursor-pointer align-top outline-none transition focus-visible:bg-amber-200/[0.08] ${selected ? 'bg-amber-200/[0.1]' : 'hover:bg-white/[0.04]'}`}
                                >
                                    {columns.map((column) => {
                                        const secondary = column.priority === 'secondary';
                                        return (
                                            <td key={column.key} className={`${column.className || ''} ${secondary && !showSecondary ? 'hidden' : ''} px-3 py-3.5 text-slate-200`}>
                                                {column.render ? column.render(row) : column.getValue(row)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs text-slate-500">
                <span>{filteredRows.length} record{filteredRows.length === 1 ? '' : 's'} · page {activePage} of {pageCount}</span>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { const nextPage = Math.max(1, activePage - 1); setPage(nextPage); syncQuery({ page: nextPage }); }} disabled={activePage === 1} className="min-h-10 border border-white/10 px-3 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                    <button type="button" onClick={() => { const nextPage = Math.min(pageCount, activePage + 1); setPage(nextPage); syncQuery({ page: nextPage }); }} disabled={activePage === pageCount} className="min-h-10 border border-white/10 px-3 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                </div>
            </div>
        </div>
    );
}
