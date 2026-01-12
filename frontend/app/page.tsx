/**
 * =============================================================================
 * Home Page
 * =============================================================================
 * 
 * Main landing page displaying the book category navigation.
 * Features a search bar to filter categories and a grid layout
 * showing all available book categories organized by section.
 * 
 * Data Flow:
 *   1. Fetches navigation data via React Query
 *   2. User can filter categories with the search bar
 *   3. Clicking a category navigates to /category/[slug]
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useState } from 'react';
import { NavigationResponse } from '@/types/api';

// -----------------------------------------------------------------------------
// API Calls
// -----------------------------------------------------------------------------

/** Fetches the complete navigation hierarchy from the backend */
const getNavigations = async () => {
  const { data } = await api.get<NavigationResponse>('/categories/navigations');
  return data;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch navigation data with React Query (cached + auto-refetch)
  const { data: navigations, isLoading } = useQuery({
    queryKey: ['navigations'],
    queryFn: getNavigations,
  });

  // Loading state - show spinner while fetching initial data
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="text-emerald-800 font-medium animate-pulse">Loading the Library...</p>
      </div>
    );
  }

  // Filter categories based on search term
  // Also removes redundant categories like "All Books" under "Books"
  const filteredNavigations = navigations?.map((nav) => {
    const searchLower = searchTerm.toLowerCase();
    const sectionMatches = nav.title.toLowerCase().includes(searchLower);

    return {
      ...nav,
      categories: nav.categories.filter((cat) => {
        // Skip categories that duplicate the section name (e.g., "Books" under "Books")
        const isRedundant = cat.title.toLowerCase() === nav.title.toLowerCase() || cat.title.toLowerCase().startsWith('all ');
        if (isRedundant) return false;

        // If section matches search, show all its categories
        if (sectionMatches) return true;
        // Otherwise, filter by category title
        return cat.title.toLowerCase().includes(searchLower);
      })
    };
  }).filter(nav => nav.categories.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Search */}
      <div className="bg-emerald-900 text-white pt-16 pb-24 px-4 relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-800 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>

        <div className="container mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Explore the <span className="text-emerald-400">World of Books</span>
          </h1>
          <p className="text-emerald-100 text-lg max-w-2xl mx-auto mb-10">
            Real-time pricing, live inventory scraping, and deep category exploration.
          </p>

          {/* Search Input with glow effect */}
          <div className="max-w-xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative">
              <input
                type="text"
                placeholder="Find a category (e.g. Fantasy, Music, History)..."
                className="w-full p-4 pl-12 rounded-lg border-none shadow-xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-4 top-4 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="container mx-auto px-4 -mt-10 relative z-20 pb-20">

        {/* No search results message */}
        {searchTerm && filteredNavigations?.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center animate-fade-in">
            <p className="text-gray-500 text-lg">No categories found matching "{searchTerm}"</p>
            <button onClick={() => setSearchTerm('')} className="mt-4 text-emerald-600 font-semibold hover:underline">
              Clear Search
            </button>
          </div>
        )}

        {/* Empty state when database is initializing */}
        {!searchTerm && filteredNavigations?.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Initializing Database... Please refresh in 10 seconds.</p>
          </div>
        )}

        {/* Navigation sections with category cards */}
        {filteredNavigations?.map((nav) => (
          <div key={nav.id} className="mb-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-1.5 h-8 bg-emerald-500 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{nav.title}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {nav.categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="group relative bg-gray-50 hover:bg-white p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:shadow-lg transition-all duration-300 flex items-center justify-between overflow-hidden"
                >
                  <span className="font-medium text-gray-600 group-hover:text-emerald-800 transition-colors z-10 relative">
                    {cat.title}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 text-emerald-500 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300 z-10">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}