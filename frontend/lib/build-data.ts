/**
 * Data fetched once at build time so the static HTML already contains real
 * content (for search engines, link previews and visitors without JavaScript).
 * Any failure falls back to an empty list: pages then load the data live.
 */
import type { NavigationResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function getNavigationsAtBuild(): Promise<NavigationResponse> {
  try {
    // The free API host sleeps when idle; allow time for it to wake up.
    const res = await fetch(`${API_URL}/categories/navigations`, {
      signal: AbortSignal.timeout(90_000),
      cache: 'force-cache',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NavigationResponse;
    const ready = Array.isArray(data) && data.some((nav) => nav.categories?.length > 0);
    return ready ? data : [];
  } catch {
    return [];
  }
}
