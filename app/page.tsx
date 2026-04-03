'use client';

import Hero from '../components/Hero';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, Users, FileText, Newspaper } from 'lucide-react';
import { useSession } from 'next-auth/react';

const features = [
  {
    title: 'Transparency',
    desc: 'View financial statements, board resolutions, and meeting minutes.',
    href: '/news',
    linkLabel: 'Enter Portal',
    icon: ShieldCheck,
    accent: 'blue' as const,
  },
  {
    title: 'Office of the Student Regent',
    desc: 'Updates and services specifically for the RTU Student Regent.',
    href: '/osr',
    linkLabel: 'View Office',
    icon: Users,
    accent: 'gold' as const,
  },
  {
    title: 'Grievances',
    desc: 'Connect with the right office to address your concerns and feedback.',
    href: '/services',
    linkLabel: 'File Request',
    icon: FileText,
    accent: 'blue' as const,
  },
  {
    title: 'News Feed',
    desc: 'Live updates and announcements across all Student Government branches.',
    href: '/news',
    linkLabel: 'Read More',
    icon: Newspaper,
    accent: 'gold' as const,
  },
];

const accentStyles = {
  blue: { bg: 'rgba(0, 43, 127, 0.1)', color: 'var(--rtu-blue)', linkColor: 'var(--rtu-blue)' },
  gold: { bg: 'rgba(212, 168, 67, 0.1)', color: 'var(--rtu-gold)', linkColor: 'var(--rtu-gold)' },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Home() {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <Hero />

      {/* Centralized Hub Section */}
      <section className="section bg-surface-base">
        <div className="container-main">
          <motion.div
            className="text-center mb-12 md:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            variants={fadeInUp}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 section-heading text-brand">
              Rizal Technological University Unified Student Government Portal
            </h2>
            <p className="text-lg max-w-2xl mx-auto text-body">
              The central digital hub for the Supreme Student Council, Constitutional Commissions, and the Office of the Student Regent.
              Access contacts, transparency reports, and university-wide updates.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7 lg:gap-8">
            {features.map((feat, i) => {
              const style = accentStyles[feat.accent];
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  className="feature-card card p-6 md:p-8 text-center flex flex-col items-center"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  variants={fadeInUp}
                >
                  <div
                    className="feature-icon w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                    style={{ background: style.bg, color: style.color }}
                  >
                    <Icon size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                  <p className="text-sm mb-6 text-subtle">
                    {feat.desc}
                  </p>
                  <Link
                    href={feat.href}
                    className="text-sm font-semibold no-underline uppercase tracking-wider mt-auto"
                    style={{ color: style.linkColor }}
                  >
                    {`${feat.linkLabel} \u2192`}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Portal Access CTA */}
      <section className="section bg-surface-soft">
        <div className="container-main">
          <motion.div
            className="card p-7 md:p-12 overflow-hidden relative"
            style={{ background: 'var(--rtu-blue)', color: 'white' }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            variants={fadeInUp}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <ShieldCheck size={120} />
            </div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">
                  {isLoggedIn ? 'Portal Access Active' : 'Portal Access Protocol'}
                </h2>
                <p className="text-lg opacity-80 mb-8">
                  {isLoggedIn
                    ? `You are signed in${session?.user?.email ? ` as ${session.user.email}` : ''}. You can now use protected portal features.`
                    : 'Certain features like grievance handling, classroom submissions, and officer-only tools require authentication via your institutional RTU Google Account.'}
                </p>
                {status !== 'loading' && (
                  <div className="flex gap-4 flex-wrap">
                    {isLoggedIn ? (
                      <>
                        <Link
                          href="/services"
                          className="btn-shimmer btn-secondary bg-white text-[#002B7F] border-none hover:bg-white/90 no-underline"
                        >
                          Go to Services
                        </Link>
                        <Link
                          href="/directory"
                          className="btn-secondary no-underline"
                        >
                          Open Directory
                        </Link>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        className="btn-shimmer btn-secondary bg-white text-[#002B7F] border-none hover:bg-white/90 no-underline"
                      >
                        Login with Institutional Email
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="hidden lg:block border-l border-white/20 pl-12">
                <ul className="space-y-4 text-sm opacity-90">
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--rtu-gold)' }} />
                    Student Access: File grievances & email directory.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--rtu-gold)' }} />
                    Student Leader Access: Sync Classroom & upload transparency files.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--rtu-gold)' }} />
                    Enterprise-grade security powered by Google OAuth.
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}