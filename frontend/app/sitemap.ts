import type { MetadataRoute } from 'next';
import { getNavigationsAtBuild } from '@/lib/build-data';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const navigations = await getNavigationsAtBuild();
  const slugs = [...new Set(navigations.flatMap((nav) => nav.categories.map((c) => c.slug)))];
  return [
    { url: siteUrl(), changeFrequency: 'daily', priority: 1 },
    { url: siteUrl('about/'), changeFrequency: 'monthly', priority: 0.3 },
    ...slugs.map((slug) => ({
      url: siteUrl(`category/?slug=${encodeURIComponent(slug)}`),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
