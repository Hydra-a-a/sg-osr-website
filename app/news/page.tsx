'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { Newspaper, Globe, ThumbsUp, MessageSquare, Share2 } from 'lucide-react';
import { NewsPost } from '@/schemas/news';


function timeAgo(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Yesterday';
    if (diffD < 7) return `${diffD}d`;
    return then.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// pick a finite avatar variant so it stays interesting without runtime styles
function sourceVariant(source: string): string {
    const variants = ['facebook', 'brand', 'azure', 'gold', 'green', 'violet'];
    let hash = 0;
    for (const ch of source) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return variants[Math.abs(hash) % variants.length];
}

// stop facebook essays from ruining the layout
const MAX_CAPTION_LENGTH = 280;

function CaptionText({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > MAX_CAPTION_LENGTH;

    if (!isLong || expanded) {
        return (
            <div className="fb-card-body">
                {text}
                {isLong && (
                    <button className="fb-see-more" onClick={() => setExpanded(false)}>
                        See less
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="fb-card-body">
            {text.slice(0, MAX_CAPTION_LENGTH).trimEnd()}…
            <button className="fb-see-more" onClick={() => setExpanded(true)}>
                See more
            </button>
        </div>
    );
}

export default function NewsPage() {
    const { data: response, error, isLoading } = useSWR('/api/news', (url: string) => fetch(url).then(res => res.json()));
    const posts: NewsPost[] = response?.data || [];

    return (
        <>
            {/* Header */}
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <Newspaper className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        News & <span className="text-gradient-gold">Updates</span>
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Live from our official Facebook pages — automatically aggregated.
                    </p>
                </div>
            </section>

            {/* Feed */}
            <section className="section-tight">
                <div className="container-main max-w-2xl">
                    {isLoading ? (
                        /* loading state nobody looks at */
                        <div className="flex flex-col gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="fb-card">
                                    {/* Skeleton header */}
                                    <div className="fb-card-header">
                                        <div className="skeleton skeleton-avatar" />
                                        <div className="flex-1">
                                            <div className="skeleton skeleton-title-line" />
                                            <div className="skeleton skeleton-meta-line" />
                                        </div>
                                    </div>
                                    {/* Skeleton body */}
                                    <div className="news-skeleton-body">
                                        <div className="skeleton skeleton-body-line skeleton-body-line-wide" />
                                        <div className="skeleton skeleton-body-line skeleton-body-line-medium" />
                                        <div className="skeleton skeleton-body-line skeleton-body-line-short" />
                                    </div>
                                    {/* Skeleton image */}
                                    <div className="skeleton skeleton-media" />
                                    {/* Skeleton actions */}
                                    <div className="news-skeleton-actions">
                                        <div className="skeleton skeleton-action-chip" />
                                        <div className="skeleton skeleton-action-chip" />
                                        <div className="skeleton skeleton-action-chip" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-20 text-white/50">No news updates yet.</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {posts.map((post) => (
                                <article key={post.id} className="fb-card fade-in-up content-visibility-auto">

                                    {/* ── Header ── */}
                                    <div className="fb-card-header">
                                        <div
                                            className={`fb-avatar fb-avatar--${sourceVariant(post.source)}`}
                                        >
                                            {post.source.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="fb-header-copy">
                                            <div className="fb-card-name">{post.source}</div>
                                            <div className="fb-card-meta">
                                                <span>{timeAgo(post.publishedAt)}</span>
                                                <span>·</span>
                                                <Globe size={12} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Caption ── */}
                                    <CaptionText text={post.caption} />

                                    {/* ── Image (edge-to-edge) ── */}
                                    {post.imageUrl && post.imageUrl !== '' && (
                                        <div className="fb-card-media">
                                            <Image
                                                src={post.imageUrl}
                                                alt=""
                                                width={800}
                                                height={450}
                                                className="fb-media-image"
                                                unoptimized
                                            />
                                        </div>
                                    )}

                                    {/* ── Action Bar ── */}
                                    <div className="fb-card-actions">
                                        <a
                                            href={post.fbLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="fb-action-btn"
                                        >
                                            <ThumbsUp size={16} /> Like
                                        </a>
                                        <a
                                            href={post.fbLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="fb-action-btn"
                                        >
                                            <MessageSquare size={16} /> Comment
                                        </a>
                                        <a
                                            href={post.fbLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="fb-action-btn"
                                        >
                                            <Share2 size={16} /> Go to Post
                                        </a>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    <p className="text-center mt-10 text-xs text-subtle">
                        This feed updates automatically whenever a new Facebook post is detected.
                    </p>
                </div>
            </section >
        </>
    );
}
