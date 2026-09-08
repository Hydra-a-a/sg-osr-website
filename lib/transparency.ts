import 'server-only';
import { randomUUID } from 'crypto';
import { unstable_cache, revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { ApiError } from '@/lib/api-errors';
import { isActiveOfficer } from '@/lib/admin-access';
import { getDrivePdfStreamById } from '@/lib/google-drive';
import { budgetTotals, budgetLineSchema, reportMetadataSchema, type PublicTransparencyReport } from '@/schemas/transparency';
import type { z } from 'zod';
import type { reportActionSchema } from '@/schemas/transparency';

export const TRANSPARENCY_CACHE_TAG = 'public:transparency';
const publicStates = ['PUBLISHED', 'SUPERSEDED', 'WITHDRAWN'];
const withLines = { lines: { orderBy: { sortOrder: 'asc' as const } } };
async function db() { return (await import('@/lib/prisma')).prisma; }
function isMissingTransparencyTable(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021';
}

// This extra database check deliberately excludes local simulated officers.
export async function assertTransparencyOfficer(email: string, transaction?: Prisma.TransactionClient) {
  const client = transaction || await db();
  const actor = await client.authorizedUser.findUnique({ where: { email } });
  if (!actor || !isActiveOfficer(actor)) throw new ApiError(403, 'FORBIDDEN', 'An active database officer is required.');
}

const publicSelect = {
  id: true, slug: true, title: true, organizationName: true, academicYearStart: true,
  periodKind: true, periodNumber: true, periodStart: true, periodEnd: true, asOfDate: true,
  publishedAt: true, status: true, notes: true, correctionReason: true, withdrawalReason: true,
  withdrawnAt: true, pdfFileId: true, pdfFileName: true,
  predecessor: { select: { slug: true, title: true } },
  corrections: { where: { status: { in: publicStates } }, select: { slug: true, title: true, publishedAt: true, correctionReason: true }, orderBy: { publishedAt: 'desc' as const }, take: 1 },
  lines: { orderBy: { sortOrder: 'asc' as const }, select: { id: true, projectTitle: true, projectCode: true, category: true, publicNote: true, allocated: true, spent: true } },
} satisfies Prisma.TransparencyReportSelect;
type PublicRow = Prisma.TransparencyReportGetPayload<{ select: typeof publicSelect }>;
export function toPublicTransparencyReport(row: PublicRow): PublicTransparencyReport {
  const withdrawn = row.status === 'WITHDRAWN';
  const lines = withdrawn ? [] : row.lines.map(line => {
    const amounts = { allocated: line.allocated.toFixed(2), spent: line.spent.toFixed(2) };
    return { id: line.id, projectTitle: line.projectTitle, projectCode: line.projectCode, category: line.category, publicNote: line.publicNote, ...budgetTotals([amounts]) };
  });
  const successor = row.corrections[0];
  return {
    id: row.id, slug: row.slug, title: row.title, organizationName: row.organizationName,
    academicYearStart: row.academicYearStart, periodKind: row.periodKind, periodNumber: row.periodNumber,
    periodStart: row.periodStart.toISOString(), periodEnd: row.periodEnd.toISOString(), asOfDate: row.asOfDate.toISOString(),
    publishedAt: row.publishedAt?.toISOString() || null, status: row.status as PublicTransparencyReport['status'],
    notes: withdrawn ? null : row.notes, correctionReason: row.correctionReason,
    withdrawalReason: row.withdrawalReason, withdrawnAt: row.withdrawnAt?.toISOString() || null,
    predecessor: row.predecessor, successor: successor ? { ...successor, publishedAt: successor.publishedAt?.toISOString() || null } : null,
    pdf: !withdrawn && row.pdfFileId ? { fileId: row.pdfFileId, fileName: row.pdfFileName } : null,
    lines, totals: budgetTotals(lines),
  };
}
export const listPublicTransparencyReports = unstable_cache(async () => {
  try {
    const rows = await (await db()).transparencyReport.findMany({ where: { status: { in: publicStates } }, select: publicSelect, orderBy: { publishedAt: 'desc' } });
    return rows.map(toPublicTransparencyReport);
  } catch (error) {
    // The public portal remains an honest empty state until the additive migration is deployed.
    if (isMissingTransparencyTable(error)) return [];
    throw error;
  }
}, ['transparency-reports-v1'], { tags: [TRANSPARENCY_CACHE_TAG], revalidate: 60 });
export async function getPublicTransparencyReport(slug: string) {
  return (await listPublicTransparencyReports()).find(report => report.slug === slug) || null;
}
export function invalidateTransparency() { revalidateTag(TRANSPARENCY_CACHE_TAG, { expire: 0 }); }
export async function listAdminTransparency() {
  const client = await db();
  const [submissions, reports, feedback] = await Promise.all([
    client.transparencySubmission.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    client.transparencyReport.findMany({ include: withLines, orderBy: { updatedAt: 'desc' }, take: 500 }),
    client.transparencyFeedback.findMany({ include: { report: { select: { title: true, slug: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }),
  ]);
  return { submissions, reports, feedback };
}
export async function createTransparencyDraft(submissionId: string, predecessorId: string | undefined, email: string) {
  const client = await db();
  return client.$transaction(async tx => {
    await assertTransparencyOfficer(email, tx);
    const submission = await tx.transparencySubmission.findUnique({ where: { id: submissionId } });
    if (!submission || submission.status !== 'SUBMITTED') throw new ApiError(409, 'INTAKE_NOT_SUBMITTED', 'Reconcile and confirm Classroom submission before creating a draft.');
    if (submission.reportId) throw new ApiError(409, 'DRAFT_EXISTS', 'This intake already has a report.');
    if (predecessorId) {
      const predecessor = await tx.transparencyReport.findUnique({ where: { id: predecessorId } });
      if (!predecessor || !['PUBLISHED', 'WITHDRAWN'].includes(predecessor.status)) throw new ApiError(409, 'INVALID_PREDECESSOR', 'Choose a current published or withdrawn report to correct.');
    }
    const report = await tx.transparencyReport.create({ data: {
      title: submission.title, slug: `ssc-${submission.academicYearStart}-${randomUUID()}`,
      academicYearStart: submission.academicYearStart, periodKind: submission.periodKind, periodNumber: submission.periodNumber,
      periodStart: submission.periodStart, periodEnd: submission.periodEnd, asOfDate: submission.periodEnd, predecessorId,
    }, include: withLines });
    const claimed = await tx.transparencySubmission.updateMany({ where: { id: submissionId, reportId: null }, data: { reportId: report.id } });
    if (claimed.count !== 1) throw new ApiError(409, 'DRAFT_EXISTS', 'This intake already has a report.');
    return report;
  });
}

async function requireReadyContent(report: Prisma.TransparencyReportGetPayload<{ include: typeof withLines }>) {
  if (!report.pdfFileId || !report.pdfFolderId || !report.pdfSizeBytes || report.lines.length === 0) throw new ApiError(409, 'INCOMPLETE_REPORT', 'Upload an approved PDF and add at least one project.');
  const folderId = (process.env.GOOGLE_DRIVE_TRANSPARENCY_FOLDER_ID || '').trim();
  if (!folderId || report.pdfFolderId !== folderId) throw new ApiError(409, 'PDF_FOLDER_CHANGED', 'Replace the PDF in the configured transparency folder.');
  const pdf = await getDrivePdfStreamById(report.pdfFileId, report.pdfResourceKey || undefined, folderId);
  if (!pdf) throw new ApiError(409, 'PDF_UNAVAILABLE', 'The approved PDF is unavailable in the transparency folder. Replace it before review.');
  pdf.stream.destroy();
  const metadata = reportMetadataSchema.safeParse({ ...report, periodStart: report.periodStart.toISOString().slice(0, 10), periodEnd: report.periodEnd.toISOString().slice(0, 10), asOfDate: report.asOfDate.toISOString().slice(0, 10) });
  if (!metadata.success || report.lines.some(line => !budgetLineSchema.safeParse({ ...line, allocated: line.allocated.toFixed(2), spent: line.spent.toFixed(2) }).success)) throw new ApiError(409, 'INVALID_REPORT', 'Correct the report metadata and project rows.');
  if (report.predecessorId && report.correctionReason.length < 5) throw new ApiError(409, 'CORRECTION_REASON_REQUIRED', 'Explain the correction publicly before review.');
}
export async function changeTransparencyReport(input: z.infer<typeof reportActionSchema>, email: string) {
  const client = await db();
  const result = await client.$transaction(async tx => {
    await assertTransparencyOfficer(email, tx);
    const report = await tx.transparencyReport.findUnique({ where: { id: input.id }, include: withLines });
    if (!report) throw new ApiError(404, 'NOT_FOUND', 'Report not found.');
    if (report.version !== input.version) throw new ApiError(409, 'VERSION_CONFLICT', 'The report changed. Reload before continuing.');
    let data: Prisma.TransparencyReportUpdateManyMutationInput = { version: { increment: 1 } };
    switch (input.action) {
      case 'save':
        if (report.status !== 'DRAFT') throw new ApiError(409, 'REPORT_LOCKED', 'Only drafts can be edited.');
        data = { ...data, ...input.metadata, periodStart: new Date(input.metadata.periodStart), periodEnd: new Date(input.metadata.periodEnd), asOfDate: new Date(input.metadata.asOfDate) };
        break;
      case 'ready':
        if (report.status !== 'DRAFT') throw new ApiError(409, 'REPORT_LOCKED', 'Only drafts can be marked ready.');
        await requireReadyContent(report);
        data = { ...data, status: 'READY', preparerEmail: email, preparedAt: new Date() };
        break;
      case 'changes':
        if (report.status !== 'READY') throw new ApiError(409, 'REPORT_LOCKED', 'Only ready reports can be returned for revision.');
        data = { ...data, status: 'DRAFT', reviewNote: input.reason, preparerEmail: null, preparedAt: null };
        break;
      case 'publish': {
        if (report.status !== 'READY') throw new ApiError(409, 'REPORT_LOCKED', 'Only ready reports can be published.');
        if (!report.preparerEmail || report.preparerEmail === email) throw new ApiError(403, 'SECOND_OFFICER_REQUIRED', 'A different active officer must publish the report.');
        await assertTransparencyOfficer(report.preparerEmail, tx);
        await requireReadyContent(report);
        if (report.predecessorId) {
          const predecessor = await tx.transparencyReport.findUnique({ where: { id: report.predecessorId } });
          if (!predecessor || !['PUBLISHED', 'WITHDRAWN'].includes(predecessor.status) || predecessor.supersededAt) throw new ApiError(409, 'CORRECTION_CONFLICT', 'The predecessor has already been superseded.');
          const changed = await tx.transparencyReport.updateMany({ where: { id: predecessor.id, version: predecessor.version, supersededAt: null }, data: { status: predecessor.status === 'WITHDRAWN' ? 'WITHDRAWN' : 'SUPERSEDED', supersededAt: new Date(), version: { increment: 1 } } });
          if (changed.count !== 1) throw new ApiError(409, 'CORRECTION_CONFLICT', 'The predecessor changed. Reload.');
        }
        data = { ...data, status: 'PUBLISHED', publisherEmail: email, publishedAt: new Date(), publicReleaseConfirmedAt: new Date() };
        break;
      }
      case 'withdraw':
        if (!['PUBLISHED', 'SUPERSEDED'].includes(report.status)) throw new ApiError(409, 'REPORT_LOCKED', 'Only public reports can be withdrawn.');
        data = { ...data, status: 'WITHDRAWN', withdrawalReason: input.reason, withdrawnAt: new Date(), withdrawnBy: email };
        break;
    }
    const updated = await tx.transparencyReport.updateMany({ where: { id: input.id, version: input.version, status: report.status }, data });
    if (updated.count !== 1) throw new ApiError(409, 'VERSION_CONFLICT', 'The report changed. Reload before continuing.');
    if (input.action === 'save') {
      await tx.transparencyBudgetLine.deleteMany({ where: { reportId: input.id } });
      await tx.transparencyBudgetLine.createMany({ data: input.lines.map((line, sortOrder) => ({ ...line, reportId: input.id, sortOrder })) });
    }
    return tx.transparencyReport.findUniqueOrThrow({ where: { id: input.id }, include: withLines });
  });
  if (input.action === 'publish' || input.action === 'withdraw') invalidateTransparency();
  return result;
}
