'use client';

import { useEffect, useRef, useState } from 'react';
import PdfCanvasViewer from './PdfCanvasViewer';
import { api } from '@/lib/api';
import type { PdfExtraction } from '@/types/api';

export default function PdfReader({ productId, title }: { productId: number; title: string }) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<PdfExtraction | null>(null);
    const [error, setError] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');
    const controller = useRef<AbortController | null>(null);
    const objectUrl = useRef('');
    const reader = useRef<HTMLElement | null>(null);

    useEffect(() => () => {
        controller.current?.abort();
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    }, []);

    useEffect(() => {
        if (pdfUrl) reader.current?.focus();
    }, [pdfUrl]);

    async function extract() {
        controller.current?.abort();
        const request = new AbortController();
        controller.current = request;
        setBusy(true);
        setError('');
        setResult(null);
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = '';
        setPdfUrl('');
        try {
            const { data } = await api.post<PdfExtraction>(`/products/${productId}/pdf/extract`, {}, {
                signal: request.signal, timeout: 75000,
            });
            if (request.signal.aborted) return;
            setResult(data);
            if (data.status === 'matched' && data.token) {
                const response = await api.get<Blob>(`/products/${productId}/pdf/${data.token}`, {
                    responseType: 'blob', signal: request.signal, timeout: 30000,
                });
                if (request.signal.aborted) return;
                const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                objectUrl.current = url;
                setPdfUrl(url);
            }
        } catch {
            if (!request.signal.aborted) {
                setError('PDF search or download failed. Please try again; the search provider or PDF source may be unavailable.');
            }
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    }

    function closeReader() {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = '';
        setPdfUrl('');
    }

    return (
        <section aria-label="Find a readable PDF" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <button type="button" disabled={busy} onClick={extract}
                className="w-full rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-wait disabled:opacity-70">
                {busy ? 'Searching and checking pages…' : 'Extract PDF'}
            </button>
            <p className="mt-2 text-sm text-emerald-950">Search by title and author, then compare the PDF’s pages with the World of Books listing.</p>
            <div role="status" aria-live="polite" className="mt-2 text-sm text-gray-700">
                {busy && <p>This can take up to a minute while PDF files are checked.</p>}
                {result && <p>{result.message}</p>}
                {result?.expectedPages && <p className="mt-1">Listing: {result.expectedPages} pages · allowed difference: {result.tolerancePages} pages</p>}
            </div>
            {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
            {result?.query && !pdfUrl && !busy && (
                <a href={`https://www.google.com/search?q=${encodeURIComponent(result.query)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-emerald-900 underline focus-visible:outline-2 focus-visible:outline-offset-2">
                    View the search on Google
                </a>
            )}
            {pdfUrl && result && (
                <section ref={reader} tabIndex={-1} aria-label={`PDF reader for ${title}`} className="mt-4 outline-emerald-800">
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                        <p className="font-semibold text-emerald-950">PDF: {result.pdfPages} pages</p>
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-900 underline">Open PDF in a new tab</a>
                        <button type="button" onClick={closeReader} className="text-gray-700 underline">Close reader</button>
                    </div>
                    <p className="mb-3 text-sm text-gray-700">Similar pagination is a useful check, but does not confirm the book or edition.</p>
                    {result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="mb-3 block break-all text-xs text-emerald-900 underline">Source: {result.sourceUrl}</a>}
                    <PdfCanvasViewer key={pdfUrl} url={pdfUrl} title={title} />
                </section>
            )}
        </section>
    );
}
