import {
    Shield,
    Building2,
    Scale,
    GraduationCap,
    BookOpen,
    Users,
    Landmark,
    Building,
} from 'lucide-react';

export type SenioritySection =
    | 'supreme-student-council'
    | 'central-student-council'
    | 'constitutional-commission'
    | 'college-student-council'
    | 'academic-organization'
    | 'non-academic-organization'
    | 'university-office'
    | 'other';

export function resolveSenioritySection(input?: {
    groupKey?: string;
    category?: string;
    branch?: string;
    name?: string;
}): SenioritySection {
    const raw = [input?.groupKey, input?.category, input?.branch, input?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (raw.includes('supreme') || raw.includes('ssc') || raw.includes('office of the student regent') || raw.includes('osr')) {
        return 'supreme-student-council';
    }
    if (raw.includes('central') || raw.includes('csc') || raw.includes('mccsc') || raw.includes('pccsc')) {
        return 'central-student-council';
    }
    if (raw.includes('commission') || raw.includes('comselec')) {
        return 'constitutional-commission';
    }
    if (
        raw.includes('college / institute') ||
        raw.includes('college student council') ||
        raw.includes('institute student council') ||
        ((raw.includes('college') || raw.includes('institute')) && raw.includes('council'))
    ) {
        return 'college-student-council';
    }
    if (raw.includes('academic organization') || raw.includes('academic org')) {
        return 'academic-organization';
    }
    if (raw.includes('non-academic') || raw.includes('non academic') || raw.includes('sports') || raw.includes('interest')) {
        return 'non-academic-organization';
    }
    if (raw.includes('office') || raw.includes('director') || raw.includes('department')) {
        return 'university-office';
    }

    return 'other';
}

export function SectionPlaceholderIcon({
    section,
    groupKey,
    category,
    branch,
    name,
    size = 20,
    className = '',
}: {
    section?: SenioritySection;
    groupKey?: string;
    category?: string;
    branch?: string;
    name?: string;
    size?: number;
    className?: string;
}) {
    const resolved = section || resolveSenioritySection({ groupKey, category, branch, name });

    switch (resolved) {
        case 'supreme-student-council':
            return <Shield size={size} className={className} aria-hidden="true" />;
        case 'central-student-council':
            return <Building2 size={size} className={className} aria-hidden="true" />;
        case 'constitutional-commission':
            return <Scale size={size} className={className} aria-hidden="true" />;
        case 'college-student-council':
            return <GraduationCap size={size} className={className} aria-hidden="true" />;
        case 'academic-organization':
            return <BookOpen size={size} className={className} aria-hidden="true" />;
        case 'non-academic-organization':
            return <Users size={size} className={className} aria-hidden="true" />;
        case 'university-office':
            return <Landmark size={size} className={className} aria-hidden="true" />;
        default:
            return <Building size={size} className={className} aria-hidden="true" />;
    }
}
