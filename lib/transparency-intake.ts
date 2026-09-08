import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api-errors';
import { ClassroomPreflightError, submitCourseWorkLink } from '@/lib/google-classroom';
import type { ClassroomSubmissionInput } from '@/schemas/classroom';

export async function submitTransparencyIntake(input: ClassroomSubmissionInput, actor: { email: string; name?: string | null }, accessToken: string, key: string) {
    const leaderEmail = actor.email.trim().toLowerCase();
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const idempotencyKey = createHash('sha256').update(`${leaderEmail}:${key}`).digest('hex');
    let record;
    try {
        record = await prisma.transparencySubmission.create({ data: {
            leaderEmail, leaderName: actor.name || '', submittedLink: input.linkUrl,
            organizationName: 'Supreme Student Council',
            courseId: input.courseId, courseWorkId: input.courseWorkId,
            academicYearStart: input.academicYearStart, periodKind: input.periodKind,
            periodNumber: input.periodNumber ?? null, periodStart: new Date(input.periodStart), periodEnd: new Date(input.periodEnd),
            title: input.title, turnIn: input.turnIn, requestHash, idempotencyKey,
            // Written before Google: interruption or a failed final update must remain visible to officers.
            status: 'RECONCILIATION', reviewNote: 'Classroom outcome is not yet confirmed. Verify Classroom before any retry.',
        } });
    } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
        record = await prisma.transparencySubmission.findUnique({ where: { idempotencyKey } });
        if (!record) throw new ApiError(503, 'INTAKE_UNAVAILABLE', 'Private intake is temporarily unavailable.');
        if (record.requestHash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This submission reference was already used for different report details.');
        if (record.status === 'SUBMITTED') return { transparencySubmissionId: record.id, submissionId: record.classroomSubmissionId, state: record.classroomState, replayed: true };
        if (record.status !== 'FAILED') throw new ApiError(409, 'RECONCILIATION_REQUIRED', `Submission ${record.id} is awaiting Classroom verification. An officer must confirm the outcome before another attempt.`);
        const claimedAt = new Date();
        const claimed = await prisma.transparencySubmission.updateMany({ where: { id: record.id, status: 'FAILED' }, data: { updatedAt: claimedAt, status: 'RECONCILIATION', reviewNote: 'Retry in progress. Verify Classroom before any further attempt.' } });
        if (!claimed.count) throw new ApiError(409, 'RECONCILIATION_REQUIRED', 'This submission is already being processed.');
        record.updatedAt = claimedAt;
    }
    const intakeId = record.id;
    let expectedUpdatedAt = record.updatedAt;
    let result;
    try {
        result = await submitCourseWorkLink({ ...input, accessToken, beforeAttach: async () => {
            const startedAt = new Date();
            const claimed = await prisma.transparencySubmission.updateMany({ where: { id: intakeId, status: 'RECONCILIATION', updatedAt: expectedUpdatedAt }, data: { updatedAt: startedAt } });
            if (!claimed.count) throw new ApiError(409, 'RECONCILIATION_REQUIRED', 'The intake outcome changed. Reload before submitting.');
            expectedUpdatedAt = startedAt;
        } });
    } catch (error) {
        if (error instanceof ClassroomPreflightError) {
            await prisma.transparencySubmission.updateMany({ where: { id: intakeId, status: 'RECONCILIATION', updatedAt: expectedUpdatedAt }, data: { status: 'FAILED', reviewNote: 'Classroom rejected the request before attaching the source. Check class membership and coursework.' } }).catch(() => undefined);
            throw new ApiError(422, 'CLASSROOM_PREFLIGHT_FAILED', 'Classroom could not accept this submission. Verify class membership and portal-created coursework before retrying.');
        }
        throw new ApiError(409, 'RECONCILIATION_REQUIRED', `Submission ${record.id} is recorded privately, but Classroom has not confirmed its outcome. Ask an officer to verify it before resubmitting.`);
    }
    try {
        const completed = await prisma.transparencySubmission.updateMany({ where: { id: intakeId, status: 'RECONCILIATION', updatedAt: expectedUpdatedAt }, data: { status: 'SUBMITTED', classroomSubmissionId: result.submissionId, classroomState: result.state ?? null, reviewNote: null } });
        if (!completed.count) throw new Error('Intake state changed.');
    } catch {
        throw new ApiError(409, 'RECONCILIATION_REQUIRED', `Classroom accepted submission ${record.id}, but its private status could not be confirmed. Ask an officer to reconcile it; do not resubmit.`);
    }
    return { transparencySubmissionId: record.id, ...result, replayed: false };
}
