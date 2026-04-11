import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BackLink({
    href,
    label,
    className = '',
}: {
    href: string;
    label: string;
    className?: string;
}) {
    return (
        <Link
            href={href}
            className={`portal-back-link inline-flex items-center gap-2 no-underline ${className}`.trim()}
        >
            <ArrowLeft size={15} />
            <span>{label}</span>
        </Link>
    );
}
