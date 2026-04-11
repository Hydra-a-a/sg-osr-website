import { OSRLanding } from '@/components/OSRLanding';

export const revalidate = 24;

export default async function OSRHome() {
    return <OSRLanding />;
}
