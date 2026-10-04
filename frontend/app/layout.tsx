import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import SiteFooter from '@/components/SiteFooter';
import { OPEN_GRAPH_DEFAULTS, SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteUrl } from '@/lib/site';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: browse second-hand books`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Vishnu Gandarapu', url: 'https://vishnugandarapu.in' }],
  openGraph: OPEN_GRAPH_DEFAULTS,
  twitter: { card: 'summary_large_image' },
  // Absolute URLs: Next does not add the base path to these.
  icons: {
    icon: [
      { url: siteUrl('favicon.ico'), sizes: '256x256' },
      { url: siteUrl('icon.svg'), type: 'image/svg+xml' },
    ],
    apple: siteUrl('apple-touch-icon.png'),
  },
  manifest: siteUrl('manifest.webmanifest'),
};

export const viewport: Viewport = {
  themeColor: '#064e3b',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className={`${inter.className} flex min-h-screen flex-col bg-gray-50 text-gray-900`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-emerald-900 focus:shadow-lg"
        >
          Skip to content
        </a>
        <noscript>
          <p className="bg-amber-100 px-4 py-3 text-center text-amber-950">
            This site needs JavaScript to load live book data. You can browse the same books on{' '}
            <a className="font-semibold underline" href="https://www.worldofbooks.com/en-gb">
              World of Books
            </a>
            .
          </p>
        </noscript>
        <Providers>
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </Providers>
        <SiteFooter />
      </body>
    </html>
  );
}
