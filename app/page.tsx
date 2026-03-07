import { getSlidesData } from '../lib/google';
import SlideParser from '../components/SlideParser';
import Hero from '../components/Hero';

export const revalidate = 24; // cache it so vercel doesn't bill me

export default async function Home() {
  const allSlides = await getSlidesData();

  // don't show the ugly config stuff
  const contentSlides = allSlides.filter(slide => {
    let isStructural = false;
    slide.pageElements?.forEach(element => {
      element.shape?.text?.textElements?.forEach(t => {
        const content = t.textRun?.content?.trim() || "";
        if (content.startsWith('CONFIG:') ||
          content.startsWith('NEWS:') ||
          content.startsWith('GALLERY:') ||
          content.startsWith('LINK:')) {
          isStructural = true;
        }
      });
    });
    return !isStructural;
  });

  return (
    <>
      <Hero />

      {/* dumping slides here */}
      {contentSlides && contentSlides.length > 0 && (
        <section className="section" style={{ background: 'var(--bg-primary)' }}>
          <div className="container-main">
            <h2
              className="text-3xl font-bold mb-2 text-center section-heading"
              style={{ color: 'var(--rtu-blue)' }}
            >
              Latest Announcements
            </h2>
            <p
              className="text-center mb-10"
              style={{ color: 'var(--text-muted)' }}
            >
              Pulled directly from our official Google Slides
            </p>
            <SlideParser slides={contentSlides} />
          </div>
        </section>
      )}
    </>
  );
}