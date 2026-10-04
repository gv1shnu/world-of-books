import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <p className="text-6xl font-extrabold text-emerald-800">404</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">This page could not be found</h1>
      <p className="mt-2 text-gray-700">The link may be mistyped, or the page may have moved.</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-emerald-700 px-5 py-3 font-medium text-white hover:bg-emerald-800"
      >
        Browse all categories
      </Link>
    </div>
  );
}
