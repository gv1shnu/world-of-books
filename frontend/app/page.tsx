/**
 * Home Page
 *
 * Pre-renders the category menu at build time, then hands it to the
 * interactive client component, which keeps it fresh.
 */

import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { getNavigationsAtBuild } from '@/lib/build-data';
import { OPEN_GRAPH_DEFAULTS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, jsonLdScript } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
  openGraph: { ...OPEN_GRAPH_DEFAULTS, url: SITE_URL, title: SITE_NAME, description: SITE_DESCRIPTION },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  author: { '@type': 'Person', name: 'Vishnu Gandarapu', url: 'https://vishnugandarapu.in' },
};

export default async function HomePage() {
  const navigations = await getNavigationsAtBuild();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(websiteJsonLd)}
      />
      <HomeClient initialNavigations={navigations} />
    </>
  );
}
