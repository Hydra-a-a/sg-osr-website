'use client';

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
    <div className="portal-section-slate section relative overflow-hidden">
      <div className="portal-noise-overlay" aria-hidden="true" />

      <section className="relative z-10 pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="container-main">
          <BackLink href="/" label="Back to Home" className="mb-8 text-slate-200 hover:text-white transition-colors" />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="portal-eyebrow mb-6 inline-flex">University Directory</span>
            <h1 className="portal-title mb-4">Find Contacts &amp; Resources</h1>
            <p className="portal-lead mb-12 max-w-2xl">
              Two directories, one entry point. Choose Student Organizations for recognized student-led bodies or University Offices for administrative contacts.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 pb-20">
        <div className="container-main max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
            >
              <Link
                href="/directory/student-organizations"
                className="portal-panel directory-launcher-card directory-launcher-card--orgs group flex flex-col h-full p-8 no-underline"
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-500/10 border border-sky-500/30">
                    <Users size={28} className="text-sky-300" />
                  </div>
                  <span className="portal-kicker text-sky-300/80">Student-led</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-sky-200 transition-colors">
                  Student Organizations
                </h2>

                <p className="portal-lead flex-1">
                  Recognized councils, commissions, institutes, and affiliated organizations across campus, grouped by organizational family.
                </p>

                <div className="directory-launcher-highlights">
                  {ORGANIZATION_HIGHLIGHTS.map((item) => (
                    <div key={item} className="directory-launcher-highlight">
                      <span className="directory-launcher-highlight-dot" aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="inline-flex items-center gap-2 text-sky-300 font-semibold group-hover:gap-3 transition-all mt-6">
                  Browse Organizations
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16 }}
            >
              <Link
                href="/directory/university-offices"
                className="portal-panel directory-launcher-card directory-launcher-card--offices group flex flex-col h-full p-8 no-underline"
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10 border border-amber-500/30">
                    <Building2 size={28} className="text-amber-300" />
                  </div>
                  <span className="portal-kicker text-amber-300/80">Administrative</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-200 transition-colors">
                  University Offices
                </h2>

                <p className="portal-lead flex-1">
                  Academic and administrative offices with their directors, locations, and service contact points, grouped by reporting branch.
                </p>

                <div className="directory-launcher-highlights">
                  {OFFICE_HIGHLIGHTS.map((item) => (
                    <div key={item} className="directory-launcher-highlight">
                      <span className="directory-launcher-highlight-dot" aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="inline-flex items-center gap-2 text-amber-300 font-semibold group-hover:gap-3 transition-all mt-6">
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
