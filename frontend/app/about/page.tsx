/**
 * About Page - /about
 * 
 * Information about the World of Books project and its architecture.
 */

'use client';

import Link from 'next/link';

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-emerald-900 text-white py-12 px-4">
                <div className="container mx-auto">
                    <Link href="/" className="text-emerald-300 hover:text-white transition inline-flex items-center gap-2 mb-4">
                        ← Back to Home
                    </Link>
                    <h1 className="text-4xl font-bold">About This Project</h1>
                    <p className="text-emerald-200 mt-2 text-lg">A full-stack book exploration platform</p>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto space-y-12">

                    {/* Introduction */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">What is World of Books Explorer?</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            This project is a full-stack book exploration platform that scrapes and displays live product data
                            from <a href="https://www.worldofbooks.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">World of Books</a>.
                            It demonstrates modern web development practices including real-time data fetching, background job processing,
                            and intelligent caching strategies.
                        </p>
                        <p className="text-gray-600 leading-relaxed">
                            Built as a technical showcase, this platform features live web scraping, Redis caching with TTL-based
                            expiration, and a beautiful, responsive user interface.
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
                                <p className="text-gray-600 text-sm">Next.js 16 with React Query for data fetching. Tailwind CSS for styling with responsive design.</p>
                            </div>

                            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Backend</h3>
                                <p className="text-gray-600 text-sm">NestJS REST API with Prisma ORM. PostgreSQL database with optimized indexes.</p>
                            </div>

                            <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Caching</h3>
                                <p className="text-gray-600 text-sm">Redis caching layer with TTL-based expiration. Automatic cache invalidation on data updates.</p>
                            </div>

                            <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                                <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">Scraping</h3>
                                <p className="text-gray-600 text-sm">Crawlee + Playwright for headless browser scraping. Bull queue for background job processing.</p>
                            </div>
                        </div>
                    </section>

                    {/* Features */}
                    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h2>
                        <ul className="space-y-4">
                            {[
                                { icon: '🔄', title: 'Live Scraping', desc: 'Real-time data extraction from World of Books with Playwright' },
                                { icon: '⚡', title: 'Smart Caching', desc: 'Redis caching with automatic TTL-based refresh' },
                                { icon: '📊', title: 'Admin Dashboard', desc: 'Monitor cache stats and scrape job history in real-time' },
                                { icon: '📱', title: 'Responsive Design', desc: 'Beautiful UI that works on desktop and mobile' },
                                { icon: '🔍', title: 'Product Details', desc: 'On-demand scraping of full product information' },
                                { icon: '📈', title: 'Pagination', desc: 'Efficient pagination with configurable scrape depth' },
                            ].map((feature, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <span className="text-2xl">{feature.icon}</span>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{feature.title}</h4>
                                        <p className="text-gray-600 text-sm">{feature.desc}</p>
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
                                'Playwright', 'Crawlee', 'Docker'
                            ].map((tech) => (
                                <span key={tech} className="px-4 py-2 bg-gray-100 rounded-full text-gray-700 font-medium text-sm">
                                    {tech}
                                </span>
                            ))}
                        </div>
                    </section>

                    {/* Links */}
                    <div className="flex justify-center gap-4">
                        <Link
                            href="/admin"
                            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
                        >
                            View Admin Dashboard
                        </Link>
                        <Link
                            href="/contact"
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
