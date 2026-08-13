import 'server-only';

import { createHash, createHmac } from 'node:crypto';
import { SubmissionAttemptState, SubmissionOperation } from '@prisma/client';
import { ApiError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
export { normalizeIdempotencyKey, submissionResponseHeaders } from '@/lib/idempotency-contract';

const DEFAULT_ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;

export type SubmissionOperationName = 'TICKET' | 'PROPOSAL' | 'LOST_FOUND';

function getSecret(): string {
    const configured = String(process.env.SUBMISSION_TOKEN_SECRET || '').trim();
    const developmentFallback = process.env.NODE_ENV === 'production'
        ? ''
        : String(process.env.AUTH_SECRET || '').trim();
    const secret = configured || developmentFallback;
    if (!secret) {
        throw new ApiError(503, 'SUBMISSION_RECOVERY_UNAVAILABLE', 'Submission recovery is not configured.', undefined, true);
    }
    return secret;
}

export function hashSubmissionValue(value: string): string {
    return createHmac('sha256', getSecret()).update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => [key, canonicalize(nested)]),
    );
}

export function hashSubmissionPayload(operation: SubmissionOperationName, payload: unknown): string {
    const normalized = JSON.stringify({ operation, payload: canonicalize(payload) });
    return hashSubmissionValue(normalized);
}

export function deriveTrackingToken(operation: SubmissionOperationName, attemptId: string): string {
    return createHmac('sha256', getSecret())
        .update(`tracking:${operation}:${attemptId}`)
        .digest('base64url');
}

export function toPrismaOperation(operation: SubmissionOperationName): SubmissionOperation {
    return SubmissionOperation[operation];
}

export type SubmissionReservation =
    | { kind: 'reserved'; attemptId: string }
    | { kind: 'replayed'; attemptId: string; entityId: string; trackingAccessToken: string }
    | { kind: 'in_progress'; retryAfterSeconds: number }
    | { kind: 'reused' };

export async function reserveSubmissionAttempt(params: {
    operation: SubmissionOperationName;
    idempotencyKey: string;
    actor: string;
    payloadHash: string;
    ttlMs?: number;
}): Promise<SubmissionReservation> {
    const keyHash = hashSubmissionValue(params.idempotencyKey);
    const actorHash = hashSubmissionValue(params.actor.trim().toLowerCase());
    const operation = toPrismaOperation(params.operation);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (params.ttlMs || DEFAULT_ATTEMPT_TTL_MS));

    let attempt = await prisma.submissionAttempt.findUnique({
        where: { operation_keyHash: { operation, keyHash } },
        select: { id: true, actorHash: true, payloadHash: true, state: true, entityId: true, expiresAt: true },
    });

    if (!attempt) {
        try {
            attempt = await prisma.submissionAttempt.create({
                data: { operation, keyHash, actorHash, payloadHash: params.payloadHash, expiresAt },
                select: { id: true, actorHash: true, payloadHash: true, state: true, entityId: true, expiresAt: true },
            });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            attempt = await prisma.submissionAttempt.findUnique({
                where: { operation_keyHash: { operation, keyHash } },
                select: { id: true, actorHash: true, payloadHash: true, state: true, entityId: true, expiresAt: true },
            });
        }
    }

    if (!attempt) throw new ApiError(503, 'SUBMISSION_RECOVERY_UNAVAILABLE', 'Submission recovery is temporarily unavailable.', undefined, true);
    if (attempt.actorHash !== actorHash || attempt.payloadHash !== params.payloadHash) return { kind: 'reused' };

    if (attempt.state === SubmissionAttemptState.SUCCEEDED && attempt.entityId) {
        return {
            kind: 'replayed',
            attemptId: attempt.id,
            entityId: attempt.entityId,
            trackingAccessToken: deriveTrackingToken(params.operation, attempt.id),
        };
    }

    if (attempt.state === SubmissionAttemptState.PENDING && attempt.expiresAt > now) {
        return {
            kind: 'in_progress',
            retryAfterSeconds: Math.max(1, Math.ceil((attempt.expiresAt.getTime() - now.getTime()) / 1000)),
        };
    }

    await prisma.submissionAttempt.update({
        where: { id: attempt.id },
        data: { state: SubmissionAttemptState.PENDING, expiresAt, errorCode: null, entityId: null, payloadHash: params.payloadHash, actorHash },
    });
    return { kind: 'reserved', attemptId: attempt.id };
}

export async function markSubmissionSucceeded(params: { attemptId: string; entityId: string }): Promise<void> {
    await prisma.submissionAttempt.update({
        where: { id: params.attemptId },
        data: { state: SubmissionAttemptState.SUCCEEDED, entityId: params.entityId, errorCode: null },
    });
}

export async function recordStagedDriveReference(params: {
    attemptId: string;
    fileId: string;
    resourceKey?: string;
}): Promise<void> {
    await prisma.submissionAttempt.update({
        where: { id: params.attemptId },
        data: {
            stagedDriveFileId: params.fileId,
            stagedDriveResourceKey: params.resourceKey || null,
        },
    });
}

export async function markSubmissionFailed(attemptId: string, errorCode: string): Promise<void> {
    await prisma.submissionAttempt.update({
        where: { id: attemptId },
        data: { state: SubmissionAttemptState.FAILED, errorCode: errorCode.slice(0, 120) },
    });
}

function isUniqueViolation(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}
