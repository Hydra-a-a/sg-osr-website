import UniversityOfficesClient from '@/components/directory/UniversityOfficesClient';
import { fetchDirectoryData } from '@/app/api/directory/route';

export const revalidate = 3600;

export default async function UniversityOfficesPage() {
    const initialData = await fetchDirectoryData()
        .then((payload) => ({ offices: payload.offices, meta: payload.meta }))
        .catch(() => undefined);

    return <UniversityOfficesClient initialData={initialData} />;
}
