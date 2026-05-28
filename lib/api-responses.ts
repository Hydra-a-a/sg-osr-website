import { NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';

export function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function rateLimitResponse(
  limit: { retryAfter?: number },
  message = 'Too many requests.',
): NextResponse {
  const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', message));
  if (limit.retryAfter) {
    response.headers.set('Retry-After', String(limit.retryAfter));
  }
  return withNoStore(response);
}
