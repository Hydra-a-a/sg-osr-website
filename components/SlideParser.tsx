'use client';

import DOMPurify from 'isomorphic-dompurify';
import { SlideData, PageElement } from '../lib/google';
import { extractYouTubeId, extractDriveFileId } from '../lib/smartLinks';
import Image from 'next/image';

interface SlideParserProps {
    slides: SlideData[];
}

export default function SlideParser({ slides }: SlideParserProps) {

    // huge switch statement disguised as ifs because i gave up on typescript
    const renderElement = (el: PageElement, index: number) => {
        if (el.image?.contentUrl) {
            return (
                <div key={`img-${index}`} className="relative w-full aspect-video rounded-xl overflow-hidden mb-6 bg-gray-100 shadow-md">
                    <Image
                        src={el.image.contentUrl}
                        alt="Slide Image"
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, 800px"
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
                        className="text-lg leading-relaxed mb-4 text-gray-800 break-words"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanText).replace(/\n/g, '<br />') }}
                    />
                );
            });
        }

        return null; // silently ignoring the weird geometry stuff people draw
    };

    return (
        <div className="space-y-8">
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
                    <article key={slide.objectId || sIndex} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-2">
                        {slide.pageElements?.map((el, elIndex) => renderElement(el, elIndex))}
                    </article>
                );
            })}
        </div>
    );
}
