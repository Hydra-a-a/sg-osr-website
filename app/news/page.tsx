'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { ExternalLink, Globe, Newspaper } from 'lucide-react';
import { NewsPost } from '@/schemas/news';

const PAGE_STEP = 12;

interface NewsResponse {
    data?: NewsPost[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

function sourceVariant(source: string): string {
    const variants = ['facebook', 'brand', 'azure', 'gold', 'green', 'violet'];
    let hash = 0;
    for (const ch of source) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return variants[Math.abs(hash) % variants.length];
}

function excerpt(text: string, maxLength = 360): string {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, maxLength).trimEnd()}...`;
}

export default function NewsPage() {
    const [limit, setLimit] = useState(PAGE_STEP);
    const { data: response, error, isLoading } = useSWR<NewsResponse>(
        `/api/news?limit=${limit}`,
        (url: string) => fetch(url).then((res) => res.json()),
    );
    const posts = response?.data || [];
    const hasMore = Boolean(response?.pagination?.hasMore);

    return (
        <>
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <Newspaper className="mx-auto mb-4 text-white/80" size={40} aria-hidden="true" />
                    <h1 className="font-bold text-white mb-3">
                        News & <span className="text-gradient-gold">Updates</span>
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Article-style updates from official student government Facebook pages.
                    </p>
                </div>
            </section>

            <section className="section-tight">
                <div className="container-main max-w-4xl">
                    {isLoading ? (
                        <div className="flex flex-col gap-4" aria-label="Loading news updates">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="fb-card" aria-hidden="true">
                                    <div className="fb-card-header">
                                        <div className="skeleton skeleton-avatar" />
                                        <div className="flex-1">
                                            <div className="skeleton skeleton-title-line" />
                                            <div className="skeleton skeleton-meta-line" />
                                        </div>
                                    </div>
                                    <div className="news-skeleton-body">
                                        <div className="skeleton skeleton-body-line skeleton-body-line-wide" />
                                        <div className="skeleton skeleton-body-line skeleton-body-line-medium" />
                                        <div className="skeleton skeleton-body-line skeleton-body-line-short" />
                                    </div>
                                    <div className="skeleton skeleton-media" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-20 text-white/70" role="status">
                            News updates could not be loaded right now. Please try again later.
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-20 text-white/60" role="status">
                            No visible news updates are available yet.
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-5">
                                {posts.map((post, index) => {
                                    const title = post.displayTitle || post.manualTitle || post.articleTitle || 'Student government update';
                                    const body = post.displayBody || post.manualBody || post.articleBody || post.caption;
                                    const source = post.sourcePageName || post.source || 'Student Government';

                                    return (
                                        <article key={post.id || post.articleSlug || `news-post-${index}`} className="fb-card fade-in-up content-visibility-auto">
                                            <div className="fb-card-header">
                                                <div className={`fb-avatar fb-avatar--${sourceVariant(source)}`} aria-hidden="true">
                                                    {source.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="fb-header-copy">
                                                    <p className="fb-card-name">{source}</p>
                                                    <div className="fb-card-meta">
                                                        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                                                        <span aria-hidden="true">.</span>
                                                        <Globe size={12} aria-hidden="true" />
                                                        {post.primaryTag && <span>{post.primaryTag}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="px-5 pb-4">
                                                <h2 className="text-xl md:text-2xl font-semibold text-white leading-tight">
                                                    {title}
                                                </h2>
                                                {body && (
                                                    <p className="mt-3 text-sm md:text-base leading-7 text-slate-200">
                                                        {excerpt(body)}
                                                    </p>
                                                )}
                                            </div>

                                            {post.imageUrl && (
                                                <div className="fb-card-media">
                                                    <Image
                                                        src={post.imageUrl}
                                                        alt={post.imageAlt || title}
                                                        width={900}
                                                        height={506}
                                                        className="fb-media-image"
                                                        sizes="(max-width: 768px) 100vw, 896px"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}

                                            <div className="fb-card-actions">
                                                {post.fbLink && (
                                                    <a
                                                        href={post.fbLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`View original Facebook post from ${source}`}
                                                        className="fb-action-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
                                                    >
                                                        <ExternalLink size={16} aria-hidden="true" />
                                                        View on Facebook
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            {hasMore && (
                                <div className="mt-8 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setLimit((current) => current + PAGE_STEP)}
                                        className="btn-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
                                        aria-label="Load more news updates"
                                    >
                                        Load more
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </>
    );
}
