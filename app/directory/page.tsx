'use client';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Users } from 'lucide-react';
import BackLink from '@/components/BackLink';

const ORGANIZATION_HIGHLIGHTS = [
  'Supreme, Central, and College / Institute Councils',
  'Academic and non-academic recognized organizations',
  'Primary email and Facebook handles for each group',
] as const;

const OFFICE_HIGHLIGHTS = [
  "President's Office and supporting Vice Presidents",
  'Academic, administrative, and service offices',
  'Director names, locations, and official contacts',
] as const;

export default function DirectoryPage() {
  return (
    <div className="portal-section-slate section relative overflow-hidden directory-hub-shell">
      <div className="directory-hub-photo" aria-hidden="true">
        <div className="directory-hub-photo-frame">
          <Image
            src="/images/rtu-campus-home.png"
            alt=""
            width={1149}
            height={410}
            priority
            sizes="(max-width: 767px) 88vw, (max-width: 1200px) 58vw, 760px"
            className="directory-hub-photo-image"
          />
        </div>
        <div className="directory-hub-photo-wash" />
      </div>
      <div className="portal-noise-overlay" aria-hidden="true" />

      <section className="relative z-10 pt-20 pb-16 md:pt-28 md:pb-20 directory-hub-hero">
        <div className="container-main">
          <BackLink href="/" label="Back to Home" className="mb-8 text-slate-200 hover:text-white transition-colors directory-hub-back-link" />

          <motion.div
            className="directory-hub-copy mx-auto max-w-[42rem] text-center md:mx-0 md:text-left"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="directory-hub-kicker-line mb-6 md:mx-0">University Directory</span>
            <h1 className="portal-title directory-hub-title mb-4">
              <span className="block">Find Contacts</span>
              <span className="block">&amp; Resources</span>
            </h1>
            <p className="portal-lead directory-hub-lead mb-12 mx-auto max-w-[32ch] md:mx-0 md:max-w-2xl">
              Two directories, Student Organizations for accredited student bodies and University Offices for administrative contacts.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 pb-20">
        <div className="container-main max-w-5xl">
          <div className="grid grid-cols-1 justify-items-center gap-6 md:grid-cols-2 md:justify-items-stretch directory-launcher-grid">
            <motion.div
              className="w-full max-w-[28rem] md:max-w-none"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
            >
              <Link
                href="/directory/student-organizations"
                className="portal-panel directory-launcher-card directory-launcher-card--orgs group flex h-full flex-col items-center p-8 text-center no-underline md:items-start md:text-left"
              >
                <div className="directory-launcher-head">
                  <div className="directory-launcher-emblem">
                    <div className="directory-launcher-icon directory-launcher-icon--orgs">
                    <Users size={28} className="text-sky-300" />
                    </div>
                  </div>
                  <div className="directory-launcher-heading text-center md:text-left">
                    <h2 className="directory-launcher-title group-hover:text-sky-200 transition-colors">
                      Student Organizations
                    </h2>
                  </div>
                </div>

                <p className="directory-launcher-summary flex-1">
                  Recognized councils, commissions, institutes, and affiliated organizations across campus, grouped by organizational family.
                </p>

                <div className="directory-launcher-highlights">
                  {ORGANIZATION_HIGHLIGHTS.map((item) => (
                    <div key={item} className="directory-launcher-highlight">
                      <span className="directory-launcher-highlight-cue" aria-hidden="true" />
                      <span className="directory-launcher-highlight-text">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="directory-launcher-action mt-6 self-center text-sky-300 transition-all group-hover:gap-3 md:self-start">
                  Browse Organizations
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>

            <motion.div
              className="w-full max-w-[28rem] md:max-w-none"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16 }}
            >
              <Link
                href="/directory/university-offices"
                className="portal-panel directory-launcher-card directory-launcher-card--offices group flex h-full flex-col items-center p-8 text-center no-underline md:items-start md:text-left"
              >
                <div className="directory-launcher-head">
                  <div className="directory-launcher-emblem">
                    <div className="directory-launcher-icon directory-launcher-icon--offices">
                    <Building2 size={28} className="text-amber-300" />
                    </div>
                  </div>
                  <div className="directory-launcher-heading text-center md:text-left">
                    <h2 className="directory-launcher-title group-hover:text-amber-200 transition-colors">
                      University Offices
                    </h2>
                  </div>
                </div>

                <p className="directory-launcher-summary flex-1">
                  Academic and administrative offices with their directors, locations, and service contact points, grouped by reporting branch.
                </p>

                <div className="directory-launcher-highlights">
                  {OFFICE_HIGHLIGHTS.map((item) => (
                    <div key={item} className="directory-launcher-highlight">
                      <span className="directory-launcher-highlight-cue" aria-hidden="true" />
                      <span className="directory-launcher-highlight-text">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="directory-launcher-action mt-6 self-center text-amber-300 transition-all group-hover:gap-3 md:self-start">
                  Browse Offices
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
