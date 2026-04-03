/**
 * Validates `redirect` query values so open redirects cannot point off-site.
 * Allows same-origin paths under /account, /checkout, and /cart only.
 */
export function getSafePostLoginRedirect(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  let p = raw.trim();
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  if (!p.startsWith('/') || p.startsWith('//')) return null;
  if (p.includes('..')) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(p)) return null;
  const path = p.split('#')[0] ?? '';
  if (!/^\/(account|checkout|cart)(\/|$)/.test(path)) return null;
  return path || null;
}
