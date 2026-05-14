/**
 * SQLite / libSQL / D1 error introspection.
 *
 * Drizzle wraps the underlying driver error and uses the failing SQL as the
 * Error message, so a string-only check on err.message ("UNIQUE...") is not
 * enough. The real driver code (`SQLITE_CONSTRAINT_UNIQUE`) lives on `code`
 * or on a nested `cause`.
 */

export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const seen = new Set<unknown>();
  const stack: unknown[] = [err];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as {
      code?: string;
      rawCode?: number;
      message?: string;
      cause?: unknown;
    };
    if (typeof o.code === 'string' && /UNIQUE|CONSTRAINT/i.test(o.code)) {
      return true;
    }
    if (typeof o.message === 'string' && /UNIQUE constraint/i.test(o.message)) {
      return true;
    }
    if (o.cause) stack.push(o.cause);
  }
  return false;
}
