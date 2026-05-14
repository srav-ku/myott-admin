/**
 * Shared HTTP helpers for API routes — consistent JSON shape and error
 * handling so callers always get the same envelope.
 */
import { NextResponse } from 'next/server';
import { z, type ZodError, type ZodSchema } from 'zod';

export type ApiError = {
  ok: false;
  error: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, init);
}

export function fail(
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    { ok: false, error: message, ...(details !== undefined ? { details } : {}) },
    { status },
  );
}

export function notFound(message = 'Not found') {
  return fail(message, 404);
}

export function badRequest(err: ZodError | string) {
  if (typeof err === 'string') return fail(err, 400);
  return fail('Validation error', 400, err.flatten());
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Internal server error';
  // eslint-disable-next-line no-console
  console.error('[api] unhandled error:', err);
  return fail(message, 500);
}

/** Parse JSON body and validate against a zod schema. */
export async function parseJson<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: badRequest('Invalid JSON body') };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: badRequest(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

/** Parse and validate URL search params. */
export function parseQuery<T>(
  url: URL,
  schema: ZodSchema<T>,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, response: badRequest(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

export const Z = z;
