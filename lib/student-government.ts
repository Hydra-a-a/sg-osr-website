import type { DirectoryLogoSource } from '@/lib/council-logos';

export type StudentGovernmentDirectoryResponse = {
    leaders?: DirectoryLogoSource[];
    error?: { message?: string } | string;
};

export type StudentGovernmentCouncil = {
    id: string;
    name: string;
    abbr: string;
    src: string;
    glow: string;
    gradientFrom: string;
    gradientTo: string;
    description: string;
};

export type StudentGovernmentCommission = DirectoryLogoSource & {
    abbr: string;
    description: string;
};

export const STUDENT_GOVERNMENT_DIRECTORY_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
} as const;

export const studentGovernmentCouncils: StudentGovernmentCouncil[] = [
    {
        id: 'ssc',
        name: 'Supreme Student Council',
        abbr: 'SSC',
        src: '/images/RTU_SSC.jpg',
        glow: 'rgba(212, 168, 67, 0.45)',
        gradientFrom: '#d4a843',
        gradientTo: '#f5d98a',
        description: 'The highest governing body of RTU student government, representing all students across all campuses and colleges. The SSC coordinates policies, oversees constitutional commissions, and serves as the primary voice of the student body to administration.',
    },
    {
        id: 'cengsc',
        name: 'College of Engineering Student Council',
        abbr: 'CEngSC',
        src: '/images/RTU_CEngSC.jpg',
        glow: 'rgba(220, 110, 30, 0.45)',
        gradientFrom: '#e07020',
        gradientTo: '#fbb040',
        description: 'Represents the College of Engineering students and addresses college-specific concerns. Works on academic advocacy, student affairs, and professional development initiatives tailored to engineering programs.',
    },
    {
        id: 'cbeasc',
        name: 'CBEA Student Council',
        abbr: 'CBEASC',
        src: '/images/RTU_CBEASC.jpg',
        glow: 'rgba(204, 207, 36, 0.87)',
        gradientFrom: '#dad73eff',
        gradientTo: '#dee080ff',
        description: 'Serves the College of Business, Entrepreneurship, and Accountancy. Focuses on business student concerns, career development, and industry connections for accounting and business programs.',
    },
    {
        id: 'mccsc',
        name: 'Mandaluyong Campus Central Student Council',
        abbr: 'MCCSC',
        src: '/images/MCCSC.png',
        glow: 'rgba(126, 34, 206, 0.5)',
        gradientFrom: '#7e22ce',
        gradientTo: '#fbbf24',
        description: 'The central coordinating body for the Mandaluyong campus. Manages campus-specific events, facilities, and concerns for all Mandaluyong-based students.',
    },
    {
        id: 'cassc',
        name: 'College of Arts and Sciences Student Council',
        abbr: 'CASSC',
        src: '/images/RTU_CASSC.jpg',
        glow: 'rgba(22, 163, 74, 0.5)',
        gradientFrom: '#15803d',
        gradientTo: '#4ade80',
        description: 'Represents the diverse student body of the College of Arts and Sciences. Advocates for humanities and science programs and promotes interdisciplinary collaboration.',
    },
    {
        id: 'cedsc',
        name: 'College of Education Student Council',
        abbr: 'CEDSC',
        src: '/images/RTU_CEDSC.jpg',
        glow: 'rgba(37, 99, 235, 0.45)',
        gradientFrom: '#1d4ed8',
        gradientTo: '#f59e0b',
        description: 'Serves future educators and education majors. Focuses on teaching excellence, student teacher advocacy, and professional development in education.',
    },
    {
        id: 'iasc',
        name: 'Institute of Architecture Student Council',
        abbr: 'IASC',
        src: '/images/RTU_IASC.jpg',
        glow: 'rgba(220, 38, 38, 0.45)',
        gradientFrom: '#b91c1c',
        gradientTo: '#ef4444',
        description: 'Represents architecture students with focus on professional development, design competitions, and industry engagement. Advocates for architecture-specific academic needs.',
    },
    {
        id: 'icssc',
        name: 'Institute of Computer Studies Student Council',
        abbr: 'ICSSC',
        src: '/images/RTU_ICSSC.jpg',
        glow: 'rgba(37, 99, 235, 0.45)',
        gradientFrom: '#2563eb',
        gradientTo: '#a855f7',
        description: 'Dedicated to computer science and IT students. Promotes tech initiatives, coding competitions, and career advancement in the tech industry.',
    },
    {
        id: 'ihksc',
        name: 'Institute of Human Kinetics Student Council',
        abbr: 'IHKSC',
        src: '/images/RTU_IHKSC.jpg',
        glow: 'rgba(217, 70, 239, 0.45)',
        gradientFrom: '#d946ef',
        gradientTo: '#f0abfc',
        description: 'Represents physical education and human kinetics students. Focuses on sports advocacy, athletic events, and wellness initiatives.',
    },
    {
        id: 'pccsc',
        name: 'Pasig Campus Central Student Council',
        abbr: 'PCCSC',
        src: '/images/RTU_PCCSC.jpg',
        glow: 'rgba(185, 28, 28, 0.5)',
        gradientFrom: '#b91c1c',
        gradientTo: '#f59e0b',
        description: 'The central coordinating body for the Pasig campus. Manages campus-specific programs, student services, and community engagement for all Pasig-based students.',
    },
];

export async function fetchStudentGovernmentDirectoryPayload(url: string): Promise<StudentGovernmentDirectoryResponse> {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({} as StudentGovernmentDirectoryResponse));

    if (!response.ok) {
        const fallbackMessage = 'Unable to load directory data right now.';
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || fallbackMessage;
        throw new Error(message);
    }

    return payload;
}

export function isRuntimeLogoSource(src: string): boolean {
    const value = (src || '').trim();
    return value.startsWith('/api/directory/logos/') || /^https?:\/\//i.test(value);
}

export function normalizeStudentGovernmentText(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function isConstitutionalCommissionEntry(source: DirectoryLogoSource): boolean {
    const category = normalizeStudentGovernmentText(source.category);
    const branch = normalizeStudentGovernmentText(source.branch);
    const name = normalizeStudentGovernmentText(source.name);
    const position = normalizeStudentGovernmentText(source.position);

    const combined = `${category} ${branch} ${name} ${position}`;
    const hasConstitutionalSignal = combined.includes('constitutional commission') || combined.includes('constitutional commissions');

    if (!hasConstitutionalSignal) {
        return false;
    }

    return name !== 'supreme student council';
}

export function getCommissionAbbreviation(name: string): string {
    const words = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return 'CC';
    }

    const initials = words
        .filter((word) => !['of', 'and', '&', 'the', 'for'].includes(word.toLowerCase()))
        .slice(0, 4)
        .map((word) => word[0]?.toUpperCase() || '')
        .join('');

    return initials || 'CC';
}

export function inferCommissionAcronym(name: string): string {
    const normalized = normalizeStudentGovernmentText(name);

    if (normalized.includes('appt') || normalized.includes('appointments')) {
        return 'CA';
    }
    if (normalized.includes('budget')) {
        return 'CBMA';
    }
    if (normalized.includes('disc')) {
        return 'CD';
    }
    if (normalized.includes('envi')) {
        return 'CENAC';
    }
    if (normalized.includes('proj') || normalized.includes('student activities') || normalized.includes('stud activities')) {
        return 'CPSA';
    }
    if (normalized.includes('scho')) {
        return 'CSP';
    }
    if (normalized.includes('comselec') || normalized.includes('election') || normalized.includes('student election')) {
        return 'COMSELEC';
    }

    return getCommissionAbbreviation(name);
}

export function inferCommissionDescription(name: string): string {
    const normalized = normalizeStudentGovernmentText(name);

    if (normalized.includes('appt') || normalized.includes('appointments')) {
        return 'Handles nomination screening and appointment review processes for constitutional and organizational roles under student governance.';
    }
    if (normalized.includes('budget')) {
        return 'Oversees budget planning, financial utilization, and management accountability across student government initiatives.';
    }
    if (normalized.includes('disc')) {
        return 'Supports standards, accountability, and procedural discipline in line with student government rules and due process.';
    }
    if (normalized.includes('envi')) {
        return 'Advances environmental and community-oriented initiatives, including sustainability, campus awareness, and civic engagement actions.';
    }
    if (normalized.includes('proj') || normalized.includes('student activities') || normalized.includes('stud activities')) {
        return 'Coordinates project implementation and student-activity programs to ensure execution quality, participation, and alignment with student priorities.';
    }
    if (normalized.includes('scho')) {
        return 'Facilitates scholarship-related support and advocacy, including student access to aid opportunities and policy coordination.';
    }
    if (normalized.includes('comselec') || normalized.includes('election') || normalized.includes('student election')) {
        return 'Administers student electoral processes and safeguards fair, transparent, and rules-based student government elections.';
    }

    return 'Constitutional commission under the Supreme Student Council supporting checks, governance, and student representation.';
}

export function buildCommissionProfiles(leaders: DirectoryLogoSource[]): StudentGovernmentCommission[] {
    const deduped = new Map<string, DirectoryLogoSource>();

    for (const entry of leaders) {
        if (!isConstitutionalCommissionEntry(entry)) {
            continue;
        }

        const key = normalizeStudentGovernmentText(entry.name || entry.position || '');
        if (!key || deduped.has(key)) {
            continue;
        }

        deduped.set(key, entry);
    }

    const commissions: StudentGovernmentCommission[] = [];
    for (const entry of deduped.values()) {
        commissions.push({
            ...entry,
            abbr: inferCommissionAcronym(String(entry.name || '')),
            description: inferCommissionDescription(String(entry.name || '')),
        });
    }

    return commissions;
}
