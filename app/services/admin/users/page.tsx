'use client';

import { type FormEvent, useState } from 'react';
import useSWR from 'swr';
import {
    Check,
    Loader2,
    Pencil,
    RefreshCcw,
    ShieldCheck,
    ShieldOff,
    UserPlus,
    X,
} from 'lucide-react';
import { AdminActionButton, AdminNotice, AdminPageShell, AdminPanel } from '@/components/admin/AdminPageShell';
import AdminDataGrid from '@/components/admin/AdminDataGrid';
import AdminInspector from '@/components/admin/AdminInspector';
import type { AdminColumn, AdminRecordAdapter } from '@/components/admin/admin-types';

type PortalRole = 'student' | 'leader' | 'officer';

interface AuthorizedUser {
    id: string;
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    accessEnabled: boolean;
    approvedBy: string;
    lastAccessAt: string | null;
    revokedAfter: string | null;
    updatedAt: string;
}

interface AccessResponse {
    success: boolean;
    users: AuthorizedUser[];
    authSource: 'sheets' | 'db' | 'db-with-sheets-fallback';
}

interface AccessFormState {
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    accessEnabled: boolean;
}

const emptyForm: AccessFormState = {
    email: '',
    name: '',
    council: '',
    role: 'leader',
    accessEnabled: true,
};

async function fetchAccess(url: string): Promise<AccessResponse> {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json() as AccessResponse & { error?: { message?: string } };
    if (!response.ok) {
        throw new Error(payload.error?.message || 'Unable to load access records.');
    }
    return payload;
}

function formatAccessDate(value: string | null): string {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-PH', { dateStyle: 'medium' });
}

function roleLabel(role: PortalRole): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function AdminUsersPage() {
    const { data, error, isLoading, mutate } = useSWR<AccessResponse>('/api/admin/access', fetchAccess, {
        revalidateOnFocus: false,
    });
    const [form, setForm] = useState<AccessFormState>(emptyForm);
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingEmail, setSavingEmail] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [formError, setFormError] = useState('');

    function beginNewGrant() {
        setEditingEmail(null);
        setForm(emptyForm);
        setFeedback('');
        setFormError('');
        setInspectorOpen(true);
    }

    function beginEdit(user: AuthorizedUser) {
        setEditingEmail(user.email);
        setForm({
            email: user.email,
            name: user.name,
            council: user.council,
            role: user.role,
            accessEnabled: user.accessEnabled,
        });
        setFeedback('');
        setFormError('');
        setInspectorOpen(true);
    }

    function closeInspector() {
        setInspectorOpen(false);
        setEditingEmail(null);
        setFeedback('');
        setFormError('');
    }

    async function saveAccess(nextForm: AccessFormState, quickAction = false) {
        setSaving(quickAction ? false : true);
        setSavingEmail(nextForm.email.trim().toLowerCase());
        setFeedback('');
        setFormError('');

        try {
            const response = await fetch('/api/admin/access', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextForm),
            });
            const payload = await response.json() as { error?: { message?: string } };
            if (!response.ok) {
                throw new Error(payload.error?.message || 'Unable to update access.');
            }

            await mutate();
            setFeedback(nextForm.accessEnabled ? 'Access record saved.' : 'Access revoked.');
            if (!quickAction) {
                setEditingEmail(nextForm.email.trim().toLowerCase());
            }
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Unable to update access.';
            if (quickAction) {
                setFeedback(message);
            } else {
                setFormError(message);
            }
        } finally {
            setSaving(false);
            setSavingEmail(null);
        }
    }

    async function submitForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await saveAccess(form);
    }

    async function toggleAccess(user: AuthorizedUser) {
        if (user.accessEnabled && !window.confirm(`Revoke access for ${user.email}?`)) return;
        await saveAccess({
            email: user.email,
            name: user.name,
            council: user.council,
            role: user.role,
            accessEnabled: !user.accessEnabled,
        }, true);
    }

    const sourceWarning = data?.authSource === 'sheets';

    const userAdapter: AdminRecordAdapter<AuthorizedUser> = {
        getId: (user) => user.id,
        getSearchText: (user) => [user.email, user.name, user.council, user.role, user.accessEnabled ? 'active' : 'revoked'].join(' '),
        getStatus: (user) => user.accessEnabled ? 'active' : 'revoked',
        getUpdatedAt: (user) => user.updatedAt,
    };

    const userColumns: AdminColumn<AuthorizedUser>[] = [
        {
            key: 'account',
            label: 'Account',
            sortable: true,
            getValue: (user) => user.email,
            render: (user) => <div><div className="font-medium text-white">{user.email}</div><div className="mt-1 text-xs text-slate-400">{user.name || 'No display name'}{user.council ? ` · ${user.council}` : ''}</div></div>,
        },
        {
            key: 'role',
            label: 'Role',
            sortable: true,
            getValue: (user) => user.role,
            render: (user) => <span className="inline-flex border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-xs font-semibold text-sky-100">{roleLabel(user.role)}</span>,
        },
        {
            key: 'state',
            label: 'State',
            sortable: true,
            getValue: (user) => user.accessEnabled ? 'Active' : 'Revoked',
            render: (user) => <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${user.accessEnabled ? 'text-emerald-200' : 'text-slate-400'}`}>{user.accessEnabled ? <Check size={14} /> : <X size={14} />}{user.accessEnabled ? 'Active' : 'Revoked'}</span>,
        },
        {
            key: 'lastAccess',
            label: 'Last access',
            priority: 'secondary',
            sortable: true,
            getValue: (user) => user.lastAccessAt || '',
            render: (user) => formatAccessDate(user.lastAccessAt),
        },
        {
            key: 'actions',
            label: 'Actions',
            getValue: () => '',
            render: (user) => <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => beginEdit(user)} className="inline-flex min-h-10 items-center gap-1.5 border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"><Pencil size={14} />Edit</button><button type="button" onClick={() => void toggleAccess(user)} disabled={savingEmail === user.email} title={user.accessEnabled ? 'Revoke access' : 'Restore access'} aria-label={`${user.accessEnabled ? 'Revoke' : 'Restore'} access for ${user.email}`} className={`inline-flex min-h-10 items-center justify-center border px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 ${user.accessEnabled ? 'border-red-300/20 bg-red-300/10 text-red-100 hover:bg-red-300/20' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20'}`}>{savingEmail === user.email ? <Loader2 size={14} className="animate-spin" /> : user.accessEnabled ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}</button></div>,
        },
    ];

    return (
        <AdminPageShell
            title="Leader and officer access"
            actions={(
                <>
                    <AdminActionButton onClick={beginNewGrant}>
                        <UserPlus size={16} />
                        Grant access
                    </AdminActionButton>
                    <AdminActionButton onClick={() => void mutate()} disabled={isLoading}>
                        <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh records
                    </AdminActionButton>
                </>
            )}
        >

                {sourceWarning && (
                    <AdminNotice tone="warning">
                        Neon is storing these changes, but sign-in is still configured for Google Sheets. Set <code className="font-mono text-amber-50">AUTH_ACCESS_SOURCE</code> to <code className="font-mono text-amber-50">db</code> or <code className="font-mono text-amber-50">db-with-sheets-fallback</code> before relying on a new grant.
                    </AdminNotice>
                )}

                <div className="mt-8">
                    <AdminPanel className="min-w-0 p-4 sm:p-6" ariaLabelledBy="access-records-title">
                        <div className="mb-5 border-b border-white/10 pb-5">
                            <h2 id="access-records-title" className="text-lg font-semibold text-white">Authorized records</h2>
                            <p className="mt-1 text-sm text-slate-400">{data?.users.length || 0} records in the active access source.</p>
                        </div>
                        {error ? <AdminNotice tone="danger" role="alert">{error.message}</AdminNotice> : null}
                        <AdminDataGrid
                            rows={data?.users || []}
                            columns={userColumns}
                            adapter={userAdapter}
                            selectedId={editingEmail ? data?.users.find((user) => user.email === editingEmail)?.id : undefined}
                            onSelect={beginEdit}
                            loading={isLoading && !data}
                            emptyMessage="No matching access records."
                            searchPlaceholder="Search email, name, council, or role"
                        />
                    </AdminPanel>

                    <AdminInspector
                        mode="drawer"
                        open={inspectorOpen}
                        onClose={closeInspector}
                        title={editingEmail ? 'Edit access' : 'Grant access'}
                        drawerSize="lg"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="mt-1 text-sm leading-relaxed text-slate-400">{editingEmail ? 'Update the selected authorized record.' : 'Add an RTU account to the role registry.'}</p>
                            </div>
                            {editingEmail && (
                                <button
                                    type="button"
                                    onClick={beginNewGrant}
                                    title="Start a new grant"
                                    aria-label="Start a new grant"
                                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <form className="mt-6 space-y-4" onSubmit={(event) => void submitForm(event)}>
                            <label className="block text-sm font-medium text-slate-200">
                                RTU email
                                <input
                                    required
                                    type="email"
                                    value={form.email}
                                    disabled={Boolean(editingEmail)}
                                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                    placeholder="name@rtu.edu.ph"
                                    className="mt-2 min-h-11 w-full border border-white/10 bg-black/20 px-3 text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50 focus:ring-2 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                                Display name
                                <input
                                    value={form.name}
                                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="Optional"
                                    className="mt-2 min-h-11 w-full border border-white/10 bg-black/20 px-3 text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50 focus:ring-2 focus:ring-sky-400/20"
                                />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                                Council or unit
                                <input
                                    value={form.council}
                                    onChange={(event) => setForm((current) => ({ ...current, council: event.target.value }))}
                                    placeholder="Optional"
                                    className="mt-2 min-h-11 w-full border border-white/10 bg-black/20 px-3 text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50 focus:ring-2 focus:ring-sky-400/20"
                                />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                                Access level
                                <select
                                    value={form.role}
                                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as PortalRole }))}
                                    className="mt-2 min-h-11 w-full border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-sky-300/50 focus:ring-2 focus:ring-sky-400/20"
                                >
                                    <option value="student">Student</option>
                                    <option value="leader">Leader</option>
                                    <option value="officer">Officer</option>
                                </select>
                            </label>
                            <label className="flex min-h-11 items-center gap-3 border border-white/10 bg-black/20 px-3 text-sm font-medium text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={form.accessEnabled}
                                    onChange={(event) => setForm((current) => ({ ...current, accessEnabled: event.target.checked }))}
                                    className="size-4 accent-sky-400"
                                />
                                Access enabled
                            </label>

                            {formError && <p className="border border-red-300/25 bg-red-300/10 px-3 py-2 text-sm text-red-100" role="alert">{formError}</p>}
                            {feedback && <p className="border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100" role="status">{feedback}</p>}

                            <button
                                type="submit"
                                disabled={saving || !form.email.trim()}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : editingEmail ? <Check size={16} /> : <UserPlus size={16} />}
                                {saving ? 'Saving...' : editingEmail ? 'Save access' : 'Grant access'}
                            </button>
                        </form>
                    </AdminInspector>
                </div>
        </AdminPageShell>
    );
}
