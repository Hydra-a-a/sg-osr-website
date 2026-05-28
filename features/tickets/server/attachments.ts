import path from 'path';
import { ApiError } from '@/lib/api-errors';
import type { AttachmentKind } from '@/features/tickets/schema';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_URL_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_ATTACHMENT_EXTENSIONS_BY_KIND: Record<AttachmentKind, Set<string>> = {
  image: new Set(['.png', '.jpg', '.jpeg']),
  document: new Set(['.pdf', '.doc', '.docx']),
};

const ALLOWED_ATTACHMENT_MIME_TYPES_BY_KIND: Record<AttachmentKind, Set<string>> = {
  image: new Set(['image/png', 'image/jpeg']),
  document: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
};

export function validateAttachment(file: File, attachmentKind: AttachmentKind): void {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(400, 'ATTACHMENT_TOO_LARGE', 'Attachment must be 10MB or smaller.');
  }

  const extension = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
    throw new ApiError(400, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Only PNG, JPG, PDF, DOC, and DOCX files are allowed.');
  }

  if (!ALLOWED_ATTACHMENT_EXTENSIONS_BY_KIND[attachmentKind].has(extension)) {
    throw new ApiError(400, 'ATTACHMENT_KIND_MISMATCH', `Attachment does not match selected type: ${attachmentKind}.`);
  }

  if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
    throw new ApiError(400, 'ATTACHMENT_MIME_NOT_ALLOWED', 'Unsupported attachment MIME type.');
  }

  if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES_BY_KIND[attachmentKind].has(file.type)) {
    throw new ApiError(400, 'ATTACHMENT_KIND_MIME_MISMATCH', `Attachment MIME type does not match selected type: ${attachmentKind}.`);
  }
}

export function sanitizeAttachmentUrl(rawUrl?: string): string {
  const candidate = (rawUrl || '').trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    const normalizedHost = parsed.hostname.toLowerCase();

    if (parsed.protocol !== 'https:') return '';
    if (!ALLOWED_ATTACHMENT_URL_HOSTS.has(normalizedHost)) return '';

    return parsed.toString();
  } catch {
    return '';
  }
}
