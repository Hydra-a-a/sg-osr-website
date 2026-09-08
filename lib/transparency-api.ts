import { NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { withNoStore } from '@/lib/api-responses';
import { z } from 'zod';

export function transparencyError(error: unknown) {
  // Even development responses must not include raw provider/database errors.
  return withNoStore(toApiResponse(error instanceof ApiError ? error : new ApiError(500, 'TRANSPARENCY_UNAVAILABLE', 'Transparency service unavailable.')));
}
export function transparencyJson(data: unknown, status = 200) { return withNoStore(NextResponse.json(data, { status })); }
export async function parseTransparencyBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await request.text();
  if (text.length > 1024 * 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new ApiError(400, 'INVALID_JSON', 'Invalid request body.'); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Check the required fields and reporting amounts.');
  return parsed.data;
}
