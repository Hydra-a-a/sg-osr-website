'use client';

import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    ArrowLeft,
    Check,
    Loader2,
    Pencil,
    RefreshCcw,
    Search,
    ShieldCheck,
    ShieldOff,
    UserCog,
    UserPlus,
    X,
} from 'lucide-react';

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
    const [query, setQuery] = useState('');
    const [form, setForm] = useState<AccessFormState>(emptyForm);
    const [editingEmail, setEditingEmail] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [savingEmail, setSavingEmail] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [formError, setFormError] = useState('');

    const filteredUsers = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        const users = data?.users || [];
        if (!normalized) return users;

        return users.filter((user) => [user.email, user.name, user.council, user.role]
            .some((value) => String(value || '').toLowerCase().includes(normalized)));
    }, [data?.users, query]);

    function beginNewGrant() {
        setEditingEmail(null);
        setForm(emptyForm);
        setFeedback('');
        setFormError('');
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

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                <Link
                    href="/services/admin"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                    <ArrowLeft size={16} />
                    Back to Admin
                </Link>

                <header className="mt-8 flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">
                            <UserCog size={14} />
                            Access Control
                        </div>
                        <h1 className="mt-4 text-3xl font-bold leading-tight text-white md:text-5xl">Leader and officer access</h1>
                        <p className="mt-4 max-w-2xl leading-relaxed text-slate-300">
                            Maintain the Neon-backed access list used for portal role assignment and session revocation.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void mutate()}
                        disabled={isLoading}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh records
                    </button>
                </header>

                {sourceWarning && (
                    <div className="mt-6 border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-relaxed text-amber-100" role="status">
                        Neon is storing these changes, but sign-in is still configured for Google Sheets. Set <code className="font-mono text-amber-50">AUTH_ACCESS_SOURCE</code> to <code className="font-mono text-amber-50">db</code> or <code className="font-mono text-amber-50">db-with-sheets-fallback</code> before relying on a new grant.
                    </div>
                )}

                <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <section className="min-w-0 border border-white/10 bg-white/[0.04] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.2)] sm:p-6" aria-labelledby="access-records-title">
                        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 id="access-records-title" className="text-xl font-semibold text-white">Authorized records</h2>
                                <p className="mt-1 text-sm text-slate-400">{data?.users.length || 0} records in Neon</p>
                            </div>
                            <label className="flex min-h-11 items-center gap-2 border border-white/10 bg-black/20 px-3 text-sm text-slate-300 sm:w-72">
                                <Search size={16} aria-hidden="true" />
                                <span className="sr-only">Search access records</span>
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search email or council"
                                    className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-slate-500"
                                />
                            </label>
                        </div>

                        {error ? (
                            <div className="mt-5 border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100" role="alert">
                                {error.message}
                            </div>
                        ) : isLoading && !data ? (
                            <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-300">
                                <Loader2 size={18} className="animate-spin" />
                                Loading access records...
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="mt-5 border border-dashed border-white/15 px-4 py-12 text-center text-sm text-slate-400">
                                No matching access records.
                            </div>
                        ) : (
                            <div className="mt-5 overflow-x-auto">
                                <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-xs uppercase tracking-[0.1em] text-slate-500">
                                            <th className="px-3 py-3 font-semibold">Account</th>
                                            <th className="px-3 py-3 font-semibold">Role</th>
                                            <th className="px-3 py-3 font-semibold">State</th>
                                            <th className="px-3 py-3 font-semibold">Last access</th>
                                            <th className="px-3 py-3 text-right font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="border-b border-white/5 align-top last:border-0">
                                                <td className="px-3 py-4">
                                                    <div className="font-medium text-white">{user.email}</div>
                                                    <div className="mt-1 text-xs text-slate-400">{user.name || 'No display name'}{user.council ? ` · ${user.council}` : ''}</div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <span className="inline-flex rounded-md border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-xs font-semibold text-sky-100">
                                                        {roleLabel(user.role)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${user.accessEnabled ? 'text-emerald-200' : 'text-slate-400'}`}>
                                                        {user.accessEnabled ? <Check size={14} /> : <X size={14} />}
                                                        {user.accessEnabled ? 'Active' : 'Revoked'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-slate-300">{formatAccessDate(user.lastAccessAt)}</td>
                                                <td className="px-3 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => beginEdit(user)}
                                                            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                                        >
                                                            <Pencil size={14} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void toggleAccess(user)}
                                                            disabled={savingEmail === user.email}
                                                            title={user.accessEnabled ? 'Revoke access' : 'Restore access'}
                                                            aria-label={`${user.accessEnabled ? 'Revoke' : 'Restore'} access for ${user.email}`}
                                                            className={`inline-flex min-h-10 items-center justify-center rounded-md border px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60 ${user.accessEnabled ? 'border-red-300/20 bg-red-300/10 text-red-100 hover:bg-red-300/20' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20'}`}
                                                        >
                                                            {savingEmail === user.email ? <Loader2 size={14} className="animate-spin" /> : user.accessEnabled ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="border border-white/10 bg-white/[0.04] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.2)] sm:p-6" aria-labelledby="access-form-title">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 id="access-form-title" className="text-xl font-semibold text-white">{editingEmail ? 'Edit access' : 'Grant access'}</h2>
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
                    </section>
                </div>
            </section>
        </main>
    );
}
