'use client';

import { useRef } from 'react';
import { SlideData, PageElement } from '../lib/google';
import { extractYouTubeId, extractDriveFileId } from '../lib/smartLinks';
import { sanitizeRichText } from '../lib/security';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideParserProps {
    slides: SlideData[];
    variant?: 'light' | 'dark';
    layout?: 'vertical' | 'horizontal';
}

export default function SlideParser({ slides, variant = 'light', layout = 'vertical' }: SlideParserProps) {
    const dark = variant === 'dark';
    const horizontal = layout === 'horizontal';
    const rowRef = useRef<HTMLDivElement>(null);

    const scrollRow = (direction: 'prev' | 'next') => {
        if (!rowRef.current) return;
        const amount = Math.max(240, Math.round(rowRef.current.clientWidth * 0.85));
        rowRef.current.scrollBy({
            left: direction === 'next' ? amount : -amount,
            behavior: 'smooth',
        });
    };

    // huge switch statement disguised as ifs because i gave up on typescript
    const renderElement = (el: PageElement, index: number) => {
        if (el.image?.contentUrl) {
            return (
                <div key={`img-${index}`} className="slide-media-wrap w-full rounded-xl overflow-hidden mb-6 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={el.image.contentUrl}
                        alt="Slide Image"
                        className="slide-media-image w-full h-auto block"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                    />
                </div>
            );
        }


        if (el.video) {
            if (el.video.source === 'YOUTUBE' && el.video.id) {
                return (
                    <div key={`vid-${index}`} className="relative w-full aspect-video rounded-xl overflow-hidden mb-6 shadow-md">
                        <iframe
                            src={`https://www.youtube.com/embed/${el.video.id}`}
                            className="absolute top-0 left-0 w-full h-full"
                            allowFullScreen
                            title="YouTube Video"
                        />
                    </div>
                );
            }
            // other videos go here if anyone remembers to code it
        }


        if (el.shape?.text?.textElements) {
            const paragraphs = el.shape.text.textElements
                .map(t => t.textRun?.content || '')
                .filter(content => content.trim());

            return paragraphs.map((text, pIndex) => {
                const cleanText = text.trim();


                if (cleanText.startsWith('YOUTUBE:')) {
                    const ytId = extractYouTubeId(cleanText.replace('YOUTUBE:', ''));
                    if (ytId) {
                        return (
                            <div key={`txt-yt-${index}-${pIndex}`} className="relative w-full aspect-video rounded-xl overflow-hidden mb-6 shadow-md">
                                <iframe
                                    src={`https://www.youtube.com/embed/${ytId}`}
                                    className="absolute top-0 left-0 w-full h-full"
                                    allowFullScreen
                                    title="YouTube Video"
                                />
                            </div>
                        );
                    }
                }


                if (cleanText.startsWith('DRIVE_VIDEO:')) {
                    const driveId = extractDriveFileId(cleanText.replace('DRIVE_VIDEO:', ''));
                    if (driveId) {
                        return (
                            <div key={`txt-drive-${index}-${pIndex}`} className="relative w-full aspect-video rounded-xl overflow-hidden mb-6 shadow-md">
                                <iframe
                                    src={`https://drive.google.com/file/d/${driveId}/preview`}
                                    className="absolute top-0 left-0 w-full h-full"
                                    allowFullScreen
                                    title="Google Drive Video"
                                />
                            </div>
                        );
                    }
                }


                if (cleanText.startsWith('MUSIC:')) {
                    const driveId = extractDriveFileId(cleanText.replace('MUSIC:', ''));
                    if (driveId) {
                        return (
                            <div key={`txt-music-${index}-${pIndex}`} className="w-full mb-6">
                                <audio controls className="w-full rounded-full shadow-sm">
                                    {/* google drive refuses to stream mp3s natively so we proxy and hope it doesn't break */}
                                    <source src={`https://drive.google.com/uc?export=download&id=${driveId}`} type="audio/mpeg" />
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                        );
                    }
                }

                // please god don't show the secret config slides to users
                if (cleanText.startsWith('CONFIG:') || cleanText.startsWith('NEWS:') || cleanText.startsWith('GALLERY:')) {
                    return null;
                }


                return (
                    <p
                        key={`txt-${index}-${pIndex}`}
                        className={`text-lg leading-relaxed mb-4 break-words ${dark ? 'text-slate-200' : 'text-gray-800'}`}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(cleanText) }}
                    />
                );
            });
        }

        return null; // silently ignoring the weird geometry stuff people draw
    };

    return (
        <div className={horizontal ? 'slide-parser-shell' : ''}>
            {horizontal && slides.length > 3 && (
                <div className="slide-row-controls" aria-label="Slide controls">
                    <button type="button" className="slide-row-control-btn" onClick={() => scrollRow('prev')} aria-label="Previous slide">
                        <ChevronLeft size={16} />
                    </button>
                    <button type="button" className="slide-row-control-btn" onClick={() => scrollRow('next')} aria-label="Next slide">
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
            <div
                ref={rowRef}
                className={horizontal ? 'slide-parser-row' : 'space-y-8'}
                tabIndex={horizontal ? 0 : undefined}
                role={horizontal ? 'region' : undefined}
                aria-label={horizontal ? 'Announcement slides' : undefined}
            >
                {slides.map((slide, sIndex) => {
                let isDraft = false;
                let isEmpty = true;

                // reading ahead so we don't render an empty div
                slide.pageElements?.forEach(element => {
                    element.shape?.text?.textElements?.forEach(t => {
                        const content = t.textRun?.content || "";
                        if (content.includes("DRAFT - DO NOT PUBLISH")) {
                            isDraft = true;
                        }
                        if (content.trim() && !content.trim().startsWith('CONFIG:') && !content.trim().startsWith('NEWS:') && !content.trim().startsWith('GALLERY:')) {
                            isEmpty = false;
                        }
                    });
                    if (element.image || element.video) {
                        isEmpty = false;
                    }
                });

                if (isDraft || isEmpty) return null;

                return (
                    <article
                        key={slide.objectId || sIndex}
                        className={
                            dark
                                ? `osr-announcement-card p-6 md:p-8 rounded-2xl flex flex-col gap-2 ${horizontal ? 'slide-row-card' : ''}`
                                : `bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-2 ${horizontal ? 'slide-row-card' : ''}`
                        }
                    >
                        {slide.pageElements?.map((el, elIndex) => renderElement(el, elIndex))}
                    </article>
                );
                })}
            </div>
        </div>
    );
}
