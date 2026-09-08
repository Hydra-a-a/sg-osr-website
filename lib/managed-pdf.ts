import { ApiError } from '@/lib/api-errors';

export const MANAGED_PDF_MAX_BYTES = 20 * 1024 * 1024;
export function validatePdfBuffer(buffer: Buffer, mimeType: string) {
  if (!buffer.length || buffer.length > MANAGED_PDF_MAX_BYTES) throw new ApiError(413, 'PDF_SIZE', 'PDF files must be nonempty and 20 MB or smaller.');
  if (mimeType.toLowerCase() !== 'application/pdf' || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new ApiError(415, 'INVALID_PDF', 'Choose a valid PDF document.');
}
export async function validateManagedPdfFile(file: File) {
  if (!(file instanceof File) || !file.size || file.size > MANAGED_PDF_MAX_BYTES) throw new ApiError(413, 'PDF_SIZE', 'PDF files must be nonempty and 20 MB or smaller.');
  const buffer = Buffer.from(await file.arrayBuffer());
  validatePdfBuffer(buffer, file.type);
  return { buffer, fileName: file.name || 'document.pdf', sizeBytes: buffer.length };
}
