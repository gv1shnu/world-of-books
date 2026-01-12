/**
 * Product Detail Page - /product/[id]
 * 
 * Shows full product information including description, specs, reviews,
 * and recommended products. Triggers on-demand scraping if details are missing.
 */

'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ProductDetail, Review } from '@/types/api';

// -----------------------------------------------------------------------------
// API Calls
// -----------------------------------------------------------------------------

const getProduct = async (id: string) => {
    const { data } = await api.get<ProductDetail>(`/products/${id}`);
    return data;
};

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/** Star rating display */
function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <svg
                    key={star}
                    className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    );
}

/** Review card component */
function ReviewCard({ review }: { review: Review }) {
    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{review.author}</span>
                <StarRating rating={review.rating} />
            </div>
            <p className="text-gray-600 text-sm">{review.text}</p>
            {review.date && (
                <p className="text-gray-400 text-xs mt-2">{review.date}</p>
            )}
        </div>
    );
}

/** Specs table component */
function SpecsTable({ specs }: { specs: Record<string, unknown> }) {
    const entries = Object.entries(specs).filter(([, value]) => value);

    if (entries.length === 0) return null;

    return (
        <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Specifications</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {entries.map(([key, value]) => (
                    <div key={key} className="flex">
                        <dt className="text-gray-500 font-medium min-w-[120px]">{key}:</dt>
                        <dd className="text-gray-800">{String(value)}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function ProductPage() {
    const params = useParams();
    const id = params.id as string;

    const { data: product, isLoading, error } = useQuery({
        queryKey: ['product', id],
        queryFn: () => getProduct(id),
        staleTime: 1000 * 60 * 3, // 3 minutes
    });

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-emerald-800 font-medium animate-pulse">Loading product details...</p>
                    <p className="text-gray-500 text-sm mt-2">Scraping live data if needed...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Product Not Found</h1>
                    <p className="text-gray-500 mb-6">The book you&apos;re looking for doesn&apos;t exist.</p>
                    <Link
                        href="/"
                        className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                        ← Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-emerald-900 text-white py-6 px-4">
                <div className="container mx-auto">
                    <Link
                        href={product.category ? `/category/${product.category.slug}` : '/'}
                        className="text-emerald-300 hover:text-white transition inline-flex items-center gap-2 mb-4"
                    >
                        ← Back to {product.category?.title || 'Categories'}
                    </Link>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="grid md:grid-cols-3 gap-8 p-6 md:p-8">

                        {/* Product Image */}
                        <div className="md:col-span-1">
                            <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* Buy Button */}
                            <a
                                href={product.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
                            >
                                View on World of Books
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>

                        {/* Product Details */}
                        <div className="md:col-span-2 space-y-6">
                            {/* Title & Author */}
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
                                {product.author && (
                                    <p className="text-xl text-gray-600">by {product.author}</p>
                                )}
                            </div>

                            {/* Price & Availability */}
                            <div className="flex items-center gap-4">
                                <span className="text-3xl font-bold text-emerald-600">
                                    £{product.price.toFixed(2)}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${product.is_in_stock
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                    {product.is_in_stock ? 'In Stock' : 'Out of Stock'}
                                </span>
                            </div>

                            {/* Description */}
                            {product.description && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                                    <p className="text-gray-600 leading-relaxed">{product.description}</p>
                                </div>
                            )}

                            {/* Specs */}
                            {product.specs && Object.keys(product.specs).length > 0 && (
                                <SpecsTable specs={product.specs} />
                            )}
                        </div>
                    </div>

                    {/* Reviews Section */}
                    {product.reviews && product.reviews.length > 0 && (
                        <div className="border-t border-gray-100 p-6 md:p-8">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">
                                Customer Reviews ({product.reviews.length})
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {product.reviews.map((review, index) => (
                                    <ReviewCard key={index} review={review} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommendations Section */}
                    {product.recommendations && product.recommendations.length > 0 && (
                        <div className="border-t border-gray-100 p-6 md:p-8 bg-gray-50">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">
                                You Might Also Like
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {product.recommendations.map((rec, index) => (
                                    <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                                        <p className="font-medium text-gray-800 text-sm line-clamp-2">{rec.title}</p>
                                        {rec.price > 0 && (
                                            <p className="text-emerald-600 font-semibold mt-2">
                                                £{rec.price.toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
