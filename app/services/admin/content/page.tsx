import { Suspense } from 'react';
import AdminContentWorkspace from '@/components/admin/AdminContentWorkspace';

export default function AdminContentPage() {
    return (
        <Suspense fallback={<div className="border border-white/10 bg-white/[0.04] px-5 py-8 text-sm text-slate-400">Loading website content workspace…</div>}>
            <AdminContentWorkspace />
        </Suspense>
    );
}
