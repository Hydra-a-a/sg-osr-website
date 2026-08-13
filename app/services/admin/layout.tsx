import AlphaTestingNotice from '@/components/AlphaTestingNotice';
import AdminWorkspaceShell from '@/components/admin/AdminWorkspaceShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminWorkspaceShell alphaNotice={<AlphaTestingNotice />}>
            {children}
        </AdminWorkspaceShell>
    );
}
