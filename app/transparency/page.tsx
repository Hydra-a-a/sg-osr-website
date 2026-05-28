import { BookOpen, ClipboardCheck, DollarSign, FileText, Lock, ShieldCheck } from 'lucide-react';
import ClassroomSubmissionForm from '@/components/ClassroomSubmissionForm';

const sections = [
    {
        title: 'Financial Statements',
        desc: 'Budget allocations, expenditure reports, and audit summaries for authorized publication.',
        icon: DollarSign,
    },
    {
        title: 'Board Resolutions',
        desc: 'Official resolutions and governance records from recognized student-government bodies.',
        icon: FileText,
    },
    {
        title: 'Minutes of Meetings',
        desc: 'Council meeting records, committee proceedings, and approved session documentation.',
        icon: BookOpen,
    },
];

export default function TransparencyPage() {
    return (
        <>
            <section className="portal-section-dark transparency-hero-section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="transparency-hero-grid">
                        <div className="transparency-hero-copy">
                            <span className="portal-eyebrow transparency-eyebrow">
                                <ShieldCheck size={16} aria-hidden="true" />
                                Public Records
                            </span>
                            <h1 className="portal-title mt-6">
                                Governance and <span className="portal-title-accent">Transparency</span>
                            </h1>
                            <p className="portal-lead mt-5">
                                Access published student-government records, accountability materials, and official reporting channels in one place.
                            </p>
                        </div>

                        <div className="portal-panel-soft transparency-access-panel p-6">
                            <div className="transparency-access-linework" aria-hidden="true" />
                            <div className="flex items-start gap-4">
                                <div className="transparency-icon-wrap">
                                    <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Submission Access</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-300">
                                        Authorized student leaders may submit records through the Google Classroom workflow below.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="transparency-section-header">
                        <div>
                            <span className="portal-kicker">Record Categories</span>
                            <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Published materials</h2>
                        </div>
                        <p className="max-w-xl text-sm leading-7 text-slate-300">
                            These categories will display public records once authorized submissions are reviewed and published.
                        </p>
                    </div>

                    <div className="transparency-ledger-shell">
                        <div className="transparency-ledger-rail" aria-hidden="true">
                            <span className="transparency-ledger-knot" />
                            <span className="transparency-ledger-knot" />
                            <span className="transparency-ledger-knot" />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 transparency-record-grid">
                        {sections.map((section) => {
                            const Icon = section.icon;

                            return (
                                <article key={section.title} className="transparency-record-card portal-panel p-6 md:p-7">
                                    <div className="transparency-record-card-header">
                                        <div className="transparency-icon-wrap">
                                            <Icon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <span className="transparency-status-chip">
                                            <Lock size={13} aria-hidden="true" />
                                            Pending
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-300">{section.desc}</p>
                                </article>
                            );
                        })}
                        </div>
                    </div>

                    <div className="transparency-submission-grid">
                        <div className="transparency-submission-shell">
                            <ClassroomSubmissionForm />
                        </div>

                        <aside className="portal-panel-soft p-6 transparency-status-rail">
                            <div className="transparency-status-linework" aria-hidden="true" />
                            <span className="portal-kicker">Publication Status</span>
                            <h2 className="mt-3 text-xl font-semibold text-white">Records pending publication</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">
                                Public records will appear on this page after the publishing workflow is enabled and authorized submissions are reviewed.
                            </p>
                        </aside>
                    </div>
                </div>
            </section>
        </>
    );
}
