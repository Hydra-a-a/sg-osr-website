import 'server-only';

import type { PortalRole } from '@/lib/portal-mode';
import { ApiError } from '@/lib/api-errors';

export interface AdminAuthorizedUser {
    id: string;
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    accessEnabled: boolean;
    approvedBy: string;
    lastAccessAt: Date | null;
    revokedAfter: Date | null;
    updatedAt: Date;
}

export interface AuthorizedUserAccessUpdate {
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    accessEnabled: boolean;
    actorEmail: string;
}

async function getPrisma() {
    const { prisma } = await import('@/lib/prisma');
    return prisma;
}

function toAdminAuthorizedUser(row: {
    id: string;
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    accessEnabled: boolean;
    approvedBy: string;
    lastAccessAt: Date | null;
    revokedAfter: Date | null;
    updatedAt: Date;
}): AdminAuthorizedUser {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        council: row.council,
        role: row.role,
        accessEnabled: row.accessEnabled,
        approvedBy: row.approvedBy,
        lastAccessAt: row.lastAccessAt,
        revokedAfter: row.revokedAfter,
        updatedAt: row.updatedAt,
    };
}

export async function listAuthorizedUsersForAdmin(): Promise<AdminAuthorizedUser[]> {
    const prisma = await getPrisma();
    const rows = await prisma.authorizedUser.findMany({
        orderBy: [{ email: 'asc' }],
        select: {
            id: true,
            email: true,
            name: true,
            council: true,
            role: true,
            accessEnabled: true,
            approvedBy: true,
            lastAccessAt: true,
            revokedAfter: true,
            updatedAt: true,
        },
    });

    return rows.map((row) => toAdminAuthorizedUser(row));
}

export async function findAuthorizedUserByEmail(email: string): Promise<AdminAuthorizedUser | null> {
    const prisma = await getPrisma();
    const row = await prisma.authorizedUser.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            name: true,
            council: true,
            role: true,
            accessEnabled: true,
            approvedBy: true,
            lastAccessAt: true,
            revokedAfter: true,
            updatedAt: true,
        },
    });

    return row ? toAdminAuthorizedUser(row) : null;
}

export async function requireActiveDatabaseOfficer(): Promise<{
    actor: AdminAuthorizedUser;
    email: string;
}> {
    const { auth } = await import('@/lib/auth');
    const session = await auth();
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (!email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const isLocalSimulatedOfficer = process.env.NODE_ENV !== 'production'
        && process.env.ENABLE_LOCAL_LOGIN_SIMULATION === 'true'
        && session.user?.isDevSim === true
        && session.user?.role === 'officer';

    if (isLocalSimulatedOfficer) {
        const now = new Date();
        return {
            email,
            actor: {
                id: `dev-sim:${email}`,
                email,
                name: session.user.name || 'Local Officer (Simulated)',
                council: 'Local simulation',
                role: 'officer',
                accessEnabled: true,
                approvedBy: 'local-dev-simulation',
                lastAccessAt: null,
                revokedAfter: null,
                updatedAt: now,
            },
        };
    }

    const actor = await findAuthorizedUserByEmail(email);
    if (!actor || !isActiveOfficer(actor)) {
        throw new ApiError(403, 'FORBIDDEN', 'Officer access is required.');
    }

    return { actor, email };
}

export function isActiveOfficer(user: Pick<AdminAuthorizedUser, 'role' | 'accessEnabled' | 'revokedAfter'>, now = new Date()): boolean {
    return user.accessEnabled
        && user.role === 'officer'
        && (!user.revokedAfter || user.revokedAfter.getTime() > now.getTime());
}

export async function upsertAuthorizedUserAccess(input: AuthorizedUserAccessUpdate): Promise<{
    user: AdminAuthorizedUser;
    created: boolean;
}> {
    const prisma = await getPrisma();
    const now = new Date();

    const result = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.authorizedUser.findUnique({
            where: { email: input.email },
        });

        const row = existing
            ? await transaction.authorizedUser.update({
                where: { email: input.email },
                data: {
                    name: input.name,
                    council: input.council,
                    role: input.role,
                    accessEnabled: input.accessEnabled,
                    approvedBy: input.actorEmail,
                    sessionVersion: { increment: 1 },
                    revokedAfter: input.accessEnabled ? null : now,
                },
            })
            : await transaction.authorizedUser.create({
                data: {
                    email: input.email,
                    name: input.name,
                    council: input.council,
                    role: input.role,
                    accessEnabled: input.accessEnabled,
                    approvedBy: input.actorEmail,
                    sessionVersion: 1,
                    revokedAfter: input.accessEnabled ? null : now,
                },
            });

        return {
            user: toAdminAuthorizedUser(row),
            created: !existing,
        };
    });

    return result;
}
