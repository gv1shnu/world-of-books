/**
 * Home page (interactive part)
 *
 * Shows the category menu grouped by section, with a filter box. When the
 * filter matches nothing, suggests the closest category ("Did you mean ...").
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { NavigationResponse } from '@/types/api';
import { suggestCategories } from '@/lib/suggest';

/** Fetches the complete navigation hierarchy from the backend */
const getNavigations = async () => {
  const { data } = await api.get<NavigationResponse>('/categories/navigations');
  return data;
};

/** Categories that just repeat their section ("All Fiction Books" under "Fiction Books"). */
const isRedundant = (sectionTitle: string, categoryTitle: string) => {
  const title = categoryTitle.toLowerCase();
  return title === sectionTitle.toLowerCase() || title.startsWith('all ');
};

export default function HomeClient({
  initialNavigations = [],
}: {
  initialNavigations?: NavigationResponse;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: navigations, isLoading } = useQuery({
    queryKey: ['navigations'],
    queryFn: getNavigations,
    // Build-time data shows instantly; a fresh copy is fetched straight away.
    initialData: initialNavigations.length ? initialNavigations : undefined,
    initialDataUpdatedAt: 0,
  });

  const searchLower = searchTerm.trim().toLowerCase();
  const filteredNavigations = useMemo(
    () =>
      (navigations ?? [])
        .map((nav) => {
          const sectionMatches = nav.title.toLowerCase().includes(searchLower);
          return {
            ...nav,
            categories: nav.categories.filter(
              (cat) =>
                !isRedundant(nav.title, cat.title) &&
                (sectionMatches || cat.title.toLowerCase().includes(searchLower)),
            ),
          };
        })
        .filter((nav) => nav.categories.length > 0),
    [navigations, searchLower],
  );

  const allCategories = useMemo(
    () => (navigations ?? []).flatMap((nav) => nav.categories),
    [navigations],
  );
  const noResults = !!searchLower && filteredNavigations.length === 0;
  const suggestion = noResults ? suggestCategories(searchTerm, allCategories, 1).suggestions[0] : undefined;

  return (
    <div className="bg-gray-50">
      {/* Hero Section with Search */}
      <header className="focus-ring-light bg-emerald-900 text-white pt-6 pb-24 px-4 relative overflow-hidden">
        <nav aria-label="Main" className="container mx-auto flex justify-end gap-2 mb-8 relative z-10">
          <Link href="/about" className="rounded-md px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-800 hover:text-white">
            About
          </Link>
        </nav>

        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Explore the <span className="text-emerald-300">World of Books</span>
          </h1>
          <p className="text-emerald-50 text-lg max-w-2xl mx-auto mb-10">
            Real-time pricing, live stock and deep category exploration.
          </p>

          <div className="max-w-xl mx-auto relative">
            <label htmlFor="category-search" className="sr-only">
              Find a category
            </label>
            <input
              id="category-search"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Find a category (e.g. Fantasy, Music, History)..."
              className="w-full p-4 pl-12 rounded-lg border-none shadow-xl text-gray-900 placeholder-gray-600 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-4 top-4 text-gray-600" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        </div>
      </header>

      {/* Category Grid */}
      <div className="container mx-auto px-4 -mt-10 relative z-20 pb-20">
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center" role="status">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4" aria-hidden="true"></div>
            <p className="text-emerald-900 font-medium">Loading the library...</p>
          </div>
        )}

        {noResults && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center animate-fade-in" role="status">
            <p className="text-gray-700 text-lg">No categories found matching &ldquo;{searchTerm}&rdquo;</p>
            {suggestion && (
              <p className="mt-3 text-lg text-gray-700">
                Did you mean{' '}
                <button
                  type="button"
                  onClick={() => setSearchTerm(suggestion.title)}
                  className="font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
                >
                  {suggestion.title}
                </button>
                ?
              </p>
            )}
            <button onClick={() => setSearchTerm('')} className="mt-4 px-3 py-2 text-emerald-800 font-semibold hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Empty state when the database is still being filled */}
        {!isLoading && !searchLower && filteredNavigations.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center" role="status">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4" aria-hidden="true"></div>
            <p className="text-gray-700">Setting up the library... Please refresh in 10 seconds.</p>
          </div>
        )}

        {filteredNavigations.map((nav) => (
          <section
            key={nav.id}
            aria-labelledby={`section-${nav.id}`}
            className="mb-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-1.5 h-8 bg-emerald-500 rounded-full" aria-hidden="true"></div>
              <h2 id={`section-${nav.id}`} className="text-2xl font-bold text-gray-800 tracking-tight">{nav.title}</h2>
            </div>
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {nav.categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/category?slug=${encodeURIComponent(cat.slug)}`}
                    className="group relative bg-gray-50 hover:bg-white p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:shadow-lg transition-[background-color,border-color,box-shadow] duration-300 flex items-center justify-between h-full"
                  >
                    <span className="font-medium text-gray-700 group-hover:text-emerald-900 transition-colors">
                      {cat.title}
                    </span>
                    <span aria-hidden="true" className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-emerald-700 transition-opacity">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
