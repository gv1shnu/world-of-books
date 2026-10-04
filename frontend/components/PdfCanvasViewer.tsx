'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export default function PdfCanvasViewer({ url, title }: { url: string; title: string }) {
    const canvas = useRef<HTMLCanvasElement | null>(null);
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pageText, setPageText] = useState('');

    useEffect(() => {
        let cancelled = false;
        let task: { destroy: () => Promise<void> } | undefined;
        async function load() {
            try {
                const pdfjs = await import('pdfjs-dist');
                if (cancelled) return;
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
                const pending = pdfjs.getDocument({ url });
                task = pending;
                const pdf = await pending.promise;
                if (!cancelled) setDocument(pdf);
            } catch {
                if (!cancelled) {
                    setError('The PDF could not be displayed. Try opening it in a new tab.');
                    setLoading(false);
                }
            }
        }
        void load();
        return () => { cancelled = true; void task?.destroy(); };
    }, [url]);

    useEffect(() => {
        if (!document || !canvas.current) return;
        let cancelled = false;
        let rendering: { cancel: () => void } | undefined;
        setLoading(true);
        setError('');
        async function draw() {
            try {
                const pdfPage = await document!.getPage(page);
                if (cancelled || !canvas.current) return;
                const base = pdfPage.getViewport({ scale: 1 });
                const safeScale = Math.min(scale, 2000 / base.width, 2400 / base.height);
                const viewport = pdfPage.getViewport({ scale: safeScale });
                const outputScale = Math.min(window.devicePixelRatio || 1, 2);
                const element = canvas.current;
                element.width = Math.floor(viewport.width * outputScale);
                element.height = Math.floor(viewport.height * outputScale);
                element.style.width = `${Math.floor(viewport.width)}px`;
                element.style.height = `${Math.floor(viewport.height)}px`;
                const context = element.getContext('2d');
                if (!context) throw new Error('Canvas unavailable');
                const pending = pdfPage.render({
                    canvas: element, canvasContext: context, viewport,
                    transform: [outputScale, 0, 0, outputScale, 0, 0],
                });
                rendering = pending;
                await pending.promise;
                const text = await pdfPage.getTextContent();
                if (!cancelled) setPageText(text.items.map((item) => 'str' in item ? item.str : '').join(' '));
            } catch {
                if (!cancelled) setError('This page could not be displayed. Try opening the PDF in a new tab.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void draw();
        return () => { cancelled = true; rendering?.cancel(); };
    }, [document, page, scale]);

    const control = 'rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800';
    return (
        <div className="rounded-lg border border-gray-300 bg-gray-100">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-300 p-3" aria-label="PDF page controls">
                <button type="button" className={control} disabled={!document || page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous page</button>
                <span className="text-sm text-gray-900">Page {page} of {document?.numPages ?? '…'}</span>
                <button type="button" className={control} disabled={!document || page >= document.numPages || loading} onClick={() => setPage(page + 1)}>Next page</button>
                <label className="ml-auto text-sm text-gray-900">Zoom{' '}
                    <select aria-label="PDF zoom" value={scale} disabled={loading} onChange={(event) => setScale(Number(event.target.value))} className="rounded border border-gray-300 bg-white px-2 py-2">
                        <option value={0.75}>75%</option><option value={1}>100%</option><option value={1.25}>125%</option><option value={1.5}>150%</option>
                    </select>
                </label>
            </div>
            <p role="status" aria-live="polite" className="px-3 text-sm text-gray-700">{loading ? 'Rendering PDF page…' : `Showing page ${page}`}</p>
            {error && <p role="alert" className="p-3 text-sm text-red-800">{error}</p>}
            <div className="max-h-[70vh] overflow-auto p-3">
                <canvas ref={canvas} aria-label={`${title}, page ${page}`} role="img" className="mx-auto bg-white shadow-sm" />
            </div>
            <p className="sr-only">{pageText}</p>
        </div>
    );
}
