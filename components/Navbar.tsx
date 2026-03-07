import NavbarClient from './NavbarClient';
import { getSiteConfig } from '@/lib/slideConfig';

export default async function Navbar() {
    const config = await getSiteConfig();
    return <NavbarClient config={config} />;
}
