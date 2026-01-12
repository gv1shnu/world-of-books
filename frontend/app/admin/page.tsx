/**
 * Admin Dashboard - /admin
 * 
 * Monitoring dashboard for cache stats and scrape job history.
 * Auto-refreshes every 5 seconds for real-time monitoring.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { AdminOverview, ScrapeJobsResponse, ScrapeJob } from '@/types/api';

// -----------------------------------------------------------------------------
// API Calls
// -----------------------------------------------------------------------------

const getOverview = async () => {
    const { data } = await api.get<AdminOverview>('/admin/overview');
    return data;
};

const getJobs = async (limit: number = 50) => {
    const { data } = await api.get<ScrapeJobsResponse>(`/admin/jobs?limit=${limit}`);
    return data;
};

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/** Stat card component */
function StatCard({
    title,
    value,
    icon,
    color = 'emerald'
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color?: 'emerald' | 'blue' | 'purple' | 'amber';
}) {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
    };

    return (
        <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium opacity-80">{title}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                </div>
                <div className="opacity-50">{icon}</div>
            </div>
        </div>
    );
}

/** Status badge component */
function StatusBadge({ status }: { status: ScrapeJob['status'] }) {
    const styles = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        RUNNING: 'bg-blue-100 text-blue-800 animate-pulse',
        COMPLETED: 'bg-green-100 text-green-800',
        FAILED: 'bg-red-100 text-red-800',
    };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
            {status}
        </span>
    );
}

/** Format duration in human-readable format */
function formatDuration(ms?: number): string {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

/** Format timestamp in local time */
function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString();
}

/** Format target URL for display */
function formatUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        if (path.includes('/collections/')) {
            return path.split('/collections/')[1] || path;
        }
        return path.length > 30 ? path.substring(0, 30) + '...' : path;
    } catch {
        return url.substring(0, 30);
    }
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function AdminPage() {
    // Fetch overview data
    const { data: overview, isLoading: overviewLoading } = useQuery({
        queryKey: ['admin-overview'],
        queryFn: getOverview,
        refetchInterval: 5000, // Refresh every 5 seconds
    });

    // Fetch job history
    const { data: jobsData, isLoading: jobsLoading } = useQuery({
        queryKey: ['admin-jobs'],
        queryFn: () => getJobs(50),
        refetchInterval: 5000, // Refresh every 5 seconds
    });

    const isLoading = overviewLoading || jobsLoading;

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-gray-900 text-white py-6 px-4">
                <div className="container mx-auto flex items-center justify-between">
                    <div>
                        <Link href="/" className="text-gray-400 hover:text-white transition text-sm">
                            ← Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold mt-2">Admin Dashboard</h1>
                        <p className="text-gray-400 mt-1">Monitor scraping jobs and system health</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${overview?.cache.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-gray-400">
                            Redis {overview?.cache.connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        title="Categories"
                        value={overview?.counts.categories || 0}
                        color="emerald"
                        icon={
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        }
                    />
                    <StatCard
                        title="Products"
                        value={overview?.counts.products.toLocaleString() || 0}
                        color="blue"
                        icon={
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        }
                    />
                    <StatCard
                        title="Cache Keys"
                        value={overview?.cache.keys || 0}
                        color="purple"
                        icon={
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                            </svg>
                        }
                    />
                    <StatCard
                        title="Memory"
                        value={overview?.cache.memory || 'N/A'}
                        color="amber"
                        icon={
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        }
                    />
                </div>

                {/* Jobs Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-800">Scrape Jobs</h2>
                        <div className="flex items-center gap-4 text-sm">
                            {jobsData?.stats && (
                                <>
                                    <span className="text-green-600">
                                        ✓ {jobsData.stats.completed || 0} completed
                                    </span>
                                    <span className="text-blue-600">
                                        ⟳ {jobsData.stats.running || 0} running
                                    </span>
                                    <span className="text-red-600">
                                        ✕ {jobsData.stats.failed || 0} failed
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-8 text-center">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                            <p className="text-gray-500 mt-2">Loading jobs...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 text-left text-sm text-gray-500">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium">Type</th>
                                        <th className="px-6 py-3 font-medium">Target</th>
                                        <th className="px-6 py-3 font-medium">Items</th>
                                        <th className="px-6 py-3 font-medium">Duration</th>
                                        <th className="px-6 py-3 font-medium">Started</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {jobsData?.jobs.map((job) => (
                                        <tr key={job.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <StatusBadge status={job.status} />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {job.target_type}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-800 font-mono">
                                                {formatUrl(job.target_url)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {job.items_found}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {formatDuration(job.duration_ms)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {formatTime(job.started_at)}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!jobsData?.jobs || jobsData.jobs.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                No scrape jobs found. Visit a category to trigger a scrape.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Auto-refresh indicator */}
                <p className="text-center text-gray-400 text-sm mt-4">
                    Auto-refreshing every 5 seconds
                </p>
            </div>
        </div>
    );
}
