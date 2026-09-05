import ClassroomSetupPanel from '@/components/ClassroomSetupPanel';
import { AdminPageShell } from '@/components/admin/AdminPageShell';

export default function AdminClassroomPage() {
    return (
        <AdminPageShell
            title="Google Classroom"
            actions={<a href="/transparency" className="inline-flex min-h-11 items-center border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5">Open public transparency</a>}
        >
            <div className="mt-6 border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
                Classroom actions are independently protected and may require a fresh Google authorization.
            </div>
            <div className="mt-6">
                <ClassroomSetupPanel />
            </div>
        </AdminPageShell>
    );
}
