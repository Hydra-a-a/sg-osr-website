import StudentOrganizationsClient from '@/components/directory/StudentOrganizationsClient';
import { fetchDirectoryData } from '@/app/api/directory/route';

export const revalidate = 3600;

export default async function StudentOrganizationsPage() {
    const initialData = await fetchDirectoryData()
        .then((payload) => ({ leaders: payload.leaders, meta: payload.meta }))
        .catch(() => undefined);

    return <StudentOrganizationsClient initialData={initialData} />;
}
