/**
 * About Page - /about
 * 
 * Information about the World of Books project and its architecture.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { OPEN_GRAPH_DEFAULTS, siteUrl } from '@/lib/site';

export const metadata: Metadata = {
    title: 'About',
    description:
        'How World of Books Explorer works: a Next.js site on GitHub Pages and a NestJS API that reads live listings from World of Books.',
    alternates: { canonical: siteUrl('about/') },
    openGraph: { ...OPEN_GRAPH_DEFAULTS, url: siteUrl('about/'), title: 'About World of Books Explorer' },
};

export default function AboutPage() {
    return (
        <div className="bg-gray-50">
            {/* Header */}
            <header className="bg-emerald-900 text-white py-12 px-4">
                <div className="container mx-auto">
                    <Breadcrumbs light items={[{ label: 'Home', href: '/' }, { label: 'About' }]} />
                    <h1 className="text-4xl font-bold">About This Project</h1>
                    <p className="text-emerald-100 mt-2 text-lg">A full-stack book exploration platform</p>
                </div>
            </header>

            {/* Content */}
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto space-y-12">

                    {/* Introduction */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">What is World of Books Explorer?</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">
                            This project is a full-stack book exploration platform that scrapes and displays live product data
                            from <a href="https://www.worldofbooks.com" target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900">World of Books</a>.
                            It demonstrates modern web development practices including real-time data fetching, background job processing,
                            and intelligent caching strategies.
                        </p>
                        <p className="text-gray-700 leading-relaxed">
                            Built as a hobby project, it reads live listings without a headless browser, caches them in Redis,
                            and runs entirely on free hosting.
                        </p>
                    </section>

                    {/* Architecture */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Architecture</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
                                <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Frontend</h3>
                                <p className="text-gray-700 text-sm">Next.js 16 static export on GitHub Pages, with React Query for live data and Tailwind CSS for styling.</p>
                            </div>

                            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Backend</h3>
                                <p className="text-gray-700 text-sm">NestJS REST API on Render with Prisma ORM and a PostgreSQL database on Neon.</p>
                            </div>

                            <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Caching</h3>
                                <p className="text-gray-700 text-sm">Redis caching layer with TTL-based expiration. Automatic cache invalidation on data updates.</p>
                            </div>

                            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                                <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Scraping</h3>
                                <p className="text-gray-700 text-sm">Plain HTTP requests for menus and book pages, and World of Books&apos; Algolia search index for listings. Bull queue for background jobs.</p>
                            </div>
                        </div>
                    </section>

                    {/* Features */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h2>
                        <ul className="space-y-4">
                            {[
                                { icon: '🔄', title: 'Live Data', desc: 'Real-time prices and stock from World of Books, without a headless browser' },
                                { icon: '⚡', title: 'Smart Caching', desc: 'Redis caching with automatic TTL-based refresh' },
                                { icon: '🧭', title: 'Did You Mean', desc: 'Mistyped categories are corrected or matched to the closest one' },
                                { icon: '📱', title: 'Responsive Design', desc: 'Beautiful UI that works on desktop and mobile' },
                                { icon: '🔍', title: 'Book Details', desc: 'Description, page count and ISBN, with an optional PDF finder' },
                                { icon: '📈', title: 'Pagination', desc: 'Efficient pagination with configurable scrape depth' },
                            ].map((feature, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <span className="text-2xl" aria-hidden="true">{feature.icon}</span>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                                        <p className="text-gray-700 text-sm">{feature.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* Tech Stack */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tech Stack</h2>
                        <div className="flex flex-wrap gap-3">
                            {[
                                'Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'React Query',
                                'NestJS', 'Prisma', 'PostgreSQL', 'Redis', 'Bull',
                                'Algolia', 'Docker', 'GitHub Pages', 'Render', 'Neon'
                            ].map((tech) => (
                                <span key={tech} className="px-4 py-2 bg-gray-100 rounded-full text-gray-700 font-medium text-sm">
                                    {tech}
                                </span>
                            ))}
                        </div>
                    </section>

                    <div className="flex justify-center">
                        <Link
                            href="/"
                            className="px-6 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium"
                        >
                            Browse categories
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
