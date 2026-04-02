import { NextResponse } from 'next/server';

/**
 * Standardized API Error class for consistent error reporting.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly exposeMessage: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
    exposeMessage = statusCode >= 400 && statusCode < 500,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.exposeMessage = exposeMessage;
    this.name = 'ApiError';
    
    // Ensure the prototype is set correctly for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function fallbackMessageForStatus(statusCode: number): string {
  if (statusCode === 400) return 'Invalid request';
  if (statusCode === 401) return 'Unauthorized';
  if (statusCode === 403) return 'Forbidden';
  if (statusCode === 404) return 'Not found';
  if (statusCode === 405) return 'Method not allowed';
  if (statusCode === 409) return 'Conflict';
  if (statusCode === 413) return 'Payload too large';
  if (statusCode === 415) return 'Unsupported media type';
  if (statusCode === 422) return 'Invalid request';
  if (statusCode === 429) return 'Too many requests';
  return 'Internal server error';
}

/**
 * Formats an error into a standardized JSON response.
 */
export function toApiResponse(error: unknown) {
  const includeDetails = process.env.NODE_ENV !== 'production';

  if (error instanceof ApiError) {
    const message = error.exposeMessage ? error.message : fallbackMessageForStatus(error.statusCode);

    return NextResponse.json(
      {
        error: {
          message,
          code: error.code,
          ...(includeDetails && error.details !== undefined ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle generic errors without leaking internals
  const message = fallbackMessageForStatus(500);
  const code = 'INTERNAL_SERVER_ERROR';

  return NextResponse.json(
    {
      error: {
        message,
        code,
        ...(includeDetails && error instanceof Error ? { details: { reason: error.message } } : {}),
      },
    },
    { status: 500 }
  );
}
