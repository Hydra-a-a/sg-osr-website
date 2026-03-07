'use client';

import { useState, useEffect } from 'react';
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

// pick a color based on the name so it doesn't look boring
function sourceColor(source: string): string {
    const colors = [
        '#1877F2', // Facebook blue
        '#1B3A6B', // RTU blue
        '#2A5298', // RTU blue light
        '#B8922E', // Gold dark
        '#3b7d4f', // Green
        '#8B5CF6', // Violet
    ];
    let hash = 0;
    for (const ch of source) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return colors[Math.abs(hash) % colors.length];
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
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchNews() {
            try {
                const res = await fetch('/api/news');
                const data = await res.json();
                if (data.data) {
                    setPosts(data.data);
                }
            } catch (err) {
                console.error("Failed to load news", err);
            } finally {
                setLoading(false);
            }
        }
        fetchNews();
    }, []);

    return (
        <>
            {/* Header */}
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <Newspaper className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        News & <span className="text-gradient-gold">Updates</span>
                    </h1>
                    <p className="text-white/60 max-w-lg mx-auto">
                        Live from our official Facebook pages — automatically aggregated.
                    </p>
                </div>
            </section>

            {/* Feed */}
            <section className="section">
                <div className="container-main" style={{ maxWidth: '42rem' }}>
                    {loading ? (
                        /* loading state nobody looks at */
                        <div className="flex flex-col gap-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="fb-card">
                                    {/* Skeleton header */}
                                    <div className="fb-card-header">
                                        <div className="skeleton" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%' }} />
                                        <div className="flex-1">
                                            <div className="skeleton" style={{ height: '0.75rem', width: '9rem', marginBottom: '0.375rem' }} />
                                            <div className="skeleton" style={{ height: '0.6rem', width: '5rem' }} />
                                        </div>
                                    </div>
                                    {/* Skeleton body */}
                                    <div style={{ padding: '0 1rem 0.5rem' }}>
                                        <div className="skeleton" style={{ height: '0.7rem', width: '100%', marginBottom: '0.375rem' }} />
                                        <div className="skeleton" style={{ height: '0.7rem', width: '85%', marginBottom: '0.375rem' }} />
                                        <div className="skeleton" style={{ height: '0.7rem', width: '60%' }} />
                                    </div>
                                    {/* Skeleton image */}
                                    <div className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 0 }} />
                                    {/* Skeleton actions */}
                                    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem' }}>
                                        <div className="skeleton" style={{ flex: 1, height: '1.5rem' }} />
                                        <div className="skeleton" style={{ flex: 1, height: '1.5rem' }} />
                                        <div className="skeleton" style={{ flex: 1, height: '1.5rem' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-20 text-white/50">No news updates yet.</div>
                    ) : (
                        /* the actual stuff */
                        <div className="flex flex-col gap-4">
                            {posts.map((post) => (
                                <article key={post.id} className="fb-card fade-in-up">

                                    {/* ── Header ── */}
                                    <div className="fb-card-header">
                                        <div
                                            className="fb-avatar"
                                            style={{ background: sourceColor(post.source) }}
                                        >
                                            {post.source.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
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
                                                style={{ width: '100%', height: 'auto' }}
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

                    <p className="text-center mt-10 text-xs" style={{ color: 'var(--text-muted)' }}>
                        This feed updates automatically whenever a new Facebook post is detected.
                    </p>
                </div>
            </section>
        </>
    );
}
