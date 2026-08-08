import { Mail } from 'lucide-react';

function getCorrectionEmail(): string {
    const value = String(process.env.NEXT_PUBLIC_DIRECTORY_CORRECTIONS_EMAIL || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
}

export default function DirectoryCorrectionGuidance() {
    const email = getCorrectionEmail();
    if (!email) return null;

    return (
        <p className="directory-correction-guidance mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-slate-400">
            <Mail size={14} className="mr-1 inline-block align-[-2px] text-rtu-gold" aria-hidden="true" />
            See incorrect information? Include the organization name, the incorrect field, and the corrected information when you contact <a href={`mailto:${email}`} className="text-slate-200 underline decoration-rtu-gold/60 underline-offset-2 hover:text-white">{email}</a>.
        </p>
    );
}
