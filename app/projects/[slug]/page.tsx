import { getSlidePages } from '@/lib/slidePages';
import SlideParser from '@/components/SlideParser';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export async function generateStaticParams() {
    const pages = await getSlidePages();
    return pages.map((page) => ({
        slug: page.slug,
    }));
}

export default async function DynamicSlidePage({ params }: { params: { slug: string } }) {
    const pages = await getSlidePages();
    const currentPage = pages.find((p) => p.slug === params.slug);

    if (!currentPage) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-32 pb-24">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Breadcrumbs */}
                <nav className="flex items-center text-sm text-gray-500 mb-8 overflow-x-auto whitespace-nowrap">
                    <Link href="/" className="hover:text-amber-500 transition-colors">Home</Link>
                    <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
                    <span className="text-gray-900 font-medium truncate">{currentPage.title}</span>
                </nav>

                {/* Page Header */}
                <header className="mb-12">
                    <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold tracking-wider uppercase rounded-full mb-4">
                        {currentPage.prefix}
                    </span>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-[#0D2163] leading-tight mb-4">
                        {currentPage.title}
                    </h1>
                </header>

                {/* Slide Content */}
                {/* We pass a single slide 'array' to the parser so it treats it as one continuous document */}
                <div className="prose prose-lg prose-amber max-w-none">
                    <SlideParser slides={[currentPage.slideData]} />
                </div>

            </div>
        </div>
    );
}
