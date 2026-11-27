/**
 * Pure URL and route helpers for subdirectory deployment (e.g., `/portal/`).
 * Ensures temporary client links and history cleanup never strip the `/portal/`
 * base path or conflict with the institutional website at `/`.
 */

export type InitialPortalView = 'home' | 'client' | 'admin-auth';

export const DEFAULT_PRODUCTION_PORTAL_URL = 'https://my.sabermidia.com.br/portal/';

export function cleanPortalPathname(pathname: string = '/'): string {
  const withoutQuery = pathname.split('?')[0].split('#')[0].trim();
  const normalizedSlashes = withoutQuery.replace(/\/{2,}/g, '/');
  const withoutIndex = normalizedSlashes.replace(/\/index\.html$/i, '');
  if (!withoutIndex || withoutIndex === '/') return '/';
  const withLeading = withoutIndex.startsWith('/') ? withoutIndex : `/${withoutIndex}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export function resolvePortalBaseUrl(
  locationOrUrl?: { origin?: string; pathname?: string } | string
): string {
  if (typeof locationOrUrl === 'string' && locationOrUrl.trim()) {
    try {
      const parsed = new URL(locationOrUrl.trim());
      return `${parsed.origin}${cleanPortalPathname(parsed.pathname)}`;
    } catch {
      const trimmed = locationOrUrl.trim().replace(/[?#].*$/, '').replace(/\/index\.html$/i, '');
      return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
    }
  }

  if (locationOrUrl && typeof locationOrUrl === 'object') {
    const origin = (locationOrUrl.origin || '').replace(/\/+$/, '');
    const pathname = cleanPortalPathname(locationOrUrl.pathname || '/');
    return origin ? `${origin}${pathname}` : pathname;
  }

  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin.replace(/\/+$/, '');
    const pathname = cleanPortalPathname(window.location.pathname || '/');
    return `${origin}${pathname}`;
  }

  return DEFAULT_PRODUCTION_PORTAL_URL;
}

export function buildClientTokenUrl(
  tokenId: string,
  locationOrUrl?: { origin?: string; pathname?: string } | string
): string {
  const baseUrl = resolvePortalBaseUrl(locationOrUrl);
  return `${baseUrl}?token=${encodeURIComponent(tokenId)}`;
}

export function buildClientTokenRelativeHref(tokenId: string): string {
  return `./?token=${encodeURIComponent(tokenId)}`;
}

export function resolveInitialPortalRoute(search: string): {
  initialToken: string;
  initialView: InitialPortalView;
} {
  const params = new URLSearchParams(search);
  const token = (params.get('token') || '').trim();
  if (token) {
    return { initialToken: token, initialView: 'client' };
  }

  const area = (
    params.get('area') ||
    params.get('view') ||
    params.get('portal') ||
    params.get('acesso') ||
    ''
  )
    .trim()
    .toLowerCase();

  if (area === 'cliente' || area === 'client') {
    return { initialToken: '', initialView: 'client' };
  }

  if (area === 'admin' || area === 'advogada' || area === 'administrativa') {
    return { initialToken: '', initialView: 'admin-auth' };
  }

  return { initialToken: '', initialView: 'home' };
}
