import 'server-only';
import { Readable } from 'stream';
import { ApiError } from '@/lib/api-errors';
import { uploadManagedPdfToDrive, getDrivePdfStreamById, trashDriveFileById } from '@/lib/google-drive';
import { validateManagedPdfFile } from '@/lib/managed-pdf';
import { assertTransparencyOfficer } from '@/lib/transparency';

function folder() {
  const id = (process.env.GOOGLE_DRIVE_TRANSPARENCY_FOLDER_ID || '').trim();
  if (!id) throw new ApiError(503, 'STORAGE_UNAVAILABLE', 'Document storage is unavailable.');
  return id;
}
export async function uploadTransparencyPdf(id: string, version: number, file: File, email: string) {
  const { prisma } = await import('@/lib/prisma');
  await assertTransparencyOfficer(email);
  const report = await prisma.transparencyReport.findUnique({ where: { id } });
  if (!report || report.status !== 'DRAFT' || report.version !== version) throw new ApiError(409, 'VERSION_CONFLICT', 'Reload the draft before uploading.');
  const validated = await validateManagedPdfFile(file);
  const folderId = folder();
  const uploaded = await uploadManagedPdfToDrive({ ...validated, mimeType: 'application/pdf' }, folderId);
  try {
    await prisma.$transaction(async tx => {
      await assertTransparencyOfficer(email, tx);
      const saved = await tx.transparencyReport.updateMany({ where: { id, version, status: 'DRAFT' }, data: {
        pdfFileId: uploaded.fileId, pdfResourceKey: uploaded.resourceKey, pdfFileName: uploaded.fileName,
        pdfSizeBytes: validated.sizeBytes, pdfFolderId: folderId, version: { increment: 1 },
      } });
      if (saved.count !== 1) throw new ApiError(409, 'VERSION_CONFLICT', 'The draft changed during upload. Reload.');
    });
  } catch (error) {
    try {
      const current = await prisma.transparencyReport.findUnique({ where: { id }, select: { pdfFileId: true } });
      if (current?.pdfFileId === uploaded.fileId) {
        await prisma.transparencyReport.updateMany({ where: { id, pdfFileId: uploaded.fileId }, data: { reviewNote: 'PDF upload was saved but its response was interrupted. Verify the staged document before review.' } });
      } else {
        await trashDriveFileById(uploaded.fileId, folderId, 'transparency folder');
      }
    } catch {
      // Fail closed: a provider upload is retained when persistence cannot be confirmed.
      console.warn('[Transparency PDF] Upload outcome requires private reconciliation.');
    }
    throw error;
  }
  if (report.pdfFileId && report.pdfFolderId) await trashDriveFileById(report.pdfFileId, report.pdfFolderId, 'transparency folder');
  return prisma.transparencyReport.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
}
export async function streamTransparencyPdf(value: string, download: boolean, admin = false) {
  const { prisma } = await import('@/lib/prisma');
  // Never use the public report cache for document authorization, including withdrawal.
  const report = await prisma.transparencyReport.findFirst({ where: admin ? { id: value } : { pdfFileId: value, status: { in: ['PUBLISHED', 'SUPERSEDED'] } } });
  if (!report?.pdfFileId || report.status === 'WITHDRAWN' || report.pdfFolderId !== folder()) throw new ApiError(404, 'DOCUMENT_UNAVAILABLE', 'This document is unavailable.');
  const media = await getDrivePdfStreamById(report.pdfFileId, report.pdfResourceKey || undefined, report.pdfFolderId);
  if (!media) throw new ApiError(503, 'DOCUMENT_UNAVAILABLE', 'Document delivery is temporarily unavailable. Try again.');
  // Recheck after provider latency so a withdrawal during the fetch fails closed.
  const current = await prisma.transparencyReport.findUnique({ where: { id: report.id }, select: { status: true, pdfFileId: true } });
  if (!current || current.status === 'WITHDRAWN' || current.pdfFileId !== report.pdfFileId || (!admin && !['PUBLISHED', 'SUPERSEDED'].includes(current.status))) {
    media.stream.destroy();
    throw new ApiError(404, 'DOCUMENT_UNAVAILABLE', 'This document is unavailable.');
  }
  const name = report.pdfFileName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 150) || 'report.pdf';
  return new Response(Readable.toWeb(media.stream) as ReadableStream, { headers: {
    'Content-Type': 'application/pdf', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
    // Shared caching would let a previously downloaded URL bypass emergency withdrawal.
    'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store',
  } });
}
