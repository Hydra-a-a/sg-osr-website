import 'server-only';

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

function createPrismaClient() {
    if (!connectionString) {
        throw new Error('DATABASE_URL is not configured. Use the Neon pooled connection string for runtime database access.');
    }

    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & {
    osrPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.osrPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.osrPrisma = prisma;
}

export async function assertDatabaseReady(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
}
