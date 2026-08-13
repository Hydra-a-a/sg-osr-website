import {
    FileImage,
    FilePenLine,
    GraduationCap,
    Lightbulb,
    MapPinned,
    PackageSearch,
    ShieldAlert,
    Ticket,
    UserCog,
    type LucideIcon,
} from 'lucide-react';
import type { AdminModuleKey } from './admin-types';
import { getAdminSurface } from '@/lib/admin-surface-registry';

export type AdminNavigationKey = AdminModuleKey | 'content' | 'classroom';

export type AdminNavigationItem = {
    key: AdminNavigationKey | 'dashboard';
    label: string;
    description: string;
    href: string;
    icon: LucideIcon;
};

export type AdminNavigationGroup = {
    label: string;
    items: AdminNavigationItem[];
};

export const adminNavigationGroups: AdminNavigationGroup[] = [
    {
        label: 'Workspace',
        items: [
            {
                key: 'dashboard',
                label: 'Operations overview',
                description: 'Queue totals and integration health.',
                href: '/services/admin',
                icon: ShieldAlert,
            },
        ],
    },
    {
        label: 'Work queues',
        items: [
            {
                key: 'grievances',
                label: 'Grievances',
                description: 'Review tickets and publish resolutions.',
                href: '/services/admin/grievances',
                icon: Ticket,
            },
            {
                key: 'proposals',
                label: 'Proposals',
                description: 'Review project submissions and discussion.',
                href: '/services/admin/proposals',
                icon: Lightbulb,
            },
            {
                key: 'routes',
                label: 'Community routes',
                description: 'Moderate commuter route submissions.',
                href: '/services/admin/routes',
                icon: MapPinned,
            },
            {
                key: 'lost-found',
                label: 'Lost and found',
                description: 'Publish verified CSO bulletins.',
                href: '/services/admin/lost-found',
                icon: PackageSearch,
            },
        ],
    },
    {
        label: 'Administration',
        items: [
            {
                key: 'users',
                label: 'Access Management',
                description: 'Maintain leader and officer access.',
                href: '/services/admin/users',
                icon: UserCog,
            },
            {
                key: 'directory',
                label: getAdminSurface('directory')?.label || 'Directory',
                description: getAdminSurface('directory')?.description || 'Manage public directory fields and assets.',
                href: getAdminSurface('directory')?.adminHref || '/services/admin/directory',
                icon: FileImage,
            },
        ],
    },
    {
        label: 'Website control',
        items: [
            {
                key: 'content',
                label: getAdminSurface('content')?.label || 'Website content',
                description: getAdminSurface('content')?.description || 'Draft, preview, and publish public collections.',
                href: getAdminSurface('content')?.adminHref || '/services/admin/content',
                icon: FilePenLine,
            },
            {
                key: 'classroom',
                label: getAdminSurface('classroom')?.label || 'Classroom',
                description: getAdminSurface('classroom')?.description || 'Open protected course and coursework controls.',
                href: getAdminSurface('classroom')?.adminHref || '/services/admin/classroom',
                icon: GraduationCap,
            },
        ],
    },
];

export const adminNavigationItems = adminNavigationGroups.flatMap((group) => group.items);
