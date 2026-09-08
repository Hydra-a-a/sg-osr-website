import { Suspense } from 'react';
import TransparencyAdminWorkspace from '@/components/admin/TransparencyAdminWorkspace';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { assertTransparencyOfficer } from '@/lib/transparency';

export default async function AdminTransparencyPage() {
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    return <Suspense fallback={<div role="status" className="animate-pulse border border-white/10 p-8 motion-reduce:animate-none">Loading transparency workspace…</div>}><TransparencyAdminWorkspace officerEmail={email} /></Suspense>;
}
