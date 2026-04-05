'use client';

import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type PdfGuideViewerProps = {
    fileUrl: string;
    title: string;
};

export default function PdfGuideViewer({ fileUrl, title }: PdfGuideViewerProps) {
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [containerWidth, setContainerWidth] = useState(900);
    const [loadError, setLoadError] = useState('');
    const viewerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = viewerRef.current;
        if (!element) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const nextWidth = entries[0]?.contentRect?.width || 900;
            setContainerWidth(Math.max(360, Math.floor(nextWidth)));
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const canGoPrevious = pageNumber > 1;
    const canGoNext = numPages > 0 && pageNumber < numPages;
    const computedPageWidth = Math.max(320, Math.floor(containerWidth - 56) * zoomLevel);

    return (
        <div className="h-[40rem] rounded-2xl overflow-hidden bg-slate-950 flex flex-col">
            <div className="h-12 border-b border-white/10 bg-slate-900 text-slate-200 px-3 sm:px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                        disabled={!canGoPrevious}
                        className="h-8 w-8 rounded-md border border-white/15 flex items-center justify-center text-slate-100 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs sm:text-sm font-medium min-w-[72px] text-center">
                        {numPages > 0 ? `${pageNumber} / ${numPages}` : '...'}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPageNumber((current) => Math.min(numPages || 1, current + 1))}
                        disabled={!canGoNext}
                        className="h-8 w-8 rounded-md border border-white/15 flex items-center justify-center text-slate-100 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Next page"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <p className="hidden md:block text-xs uppercase tracking-wide text-slate-300/80 truncate max-w-[18rem]">
                    {title}
                </p>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setZoomLevel((current) => Math.max(0.6, current - 0.15))}
                        className="h-8 w-8 rounded-md border border-white/15 flex items-center justify-center text-slate-100 hover:bg-white/10"
                        aria-label="Zoom out"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-xs sm:text-sm font-medium min-w-[52px] text-center">{Math.round(zoomLevel * 100)}%</span>
                    <button
                        type="button"
                        onClick={() => setZoomLevel((current) => Math.min(2.4, current + 0.15))}
                        className="h-8 w-8 rounded-md border border-white/15 flex items-center justify-center text-slate-100 hover:bg-white/10"
                        aria-label="Zoom in"
                    >
                        <ZoomIn size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setZoomLevel(1);
                            setPageNumber(1);
                        }}
                        className="h-8 w-8 rounded-md border border-white/15 flex items-center justify-center text-slate-100 hover:bg-white/10"
                        aria-label="Reset view"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>

            <div ref={viewerRef} className="flex-1 overflow-auto bg-gradient-to-b from-slate-100 to-slate-200/90">
                <Document
                    file={fileUrl}
                    onLoadSuccess={({ numPages: totalPages }) => {
                        setNumPages(totalPages);
                        setPageNumber((current) => Math.min(current, totalPages || 1));
                    }}
                    onLoadError={() => {
                        setLoadError('Unable to render this PDF in custom mode. Use Open or Download instead.');
                    }}
                    loading={
                        <div className="h-full min-h-[16rem] flex items-center justify-center text-slate-600 text-sm">
                            Rendering document...
                        </div>
                    }
                >
                    {loadError ? (
                        <div className="h-full min-h-[16rem] flex items-center justify-center p-6">
                            <div className="max-w-md w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm flex items-start gap-3">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <p>{loadError}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="py-5 px-2 sm:px-4 flex justify-center">
                            <Page
                                pageNumber={pageNumber}
                                width={computedPageWidth}
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                            />
                        </div>
                    )}
                </Document>
            </div>
        </div>
    );
}
