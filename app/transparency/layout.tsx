import AuthProvider from '@/components/AuthProvider';
import { auth } from '@/lib/auth';

export default async function TransparencyLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    return <AuthProvider session={session}>{children}</AuthProvider>;
}
