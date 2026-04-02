import { ShieldCheck, DollarSign, FileText, BookOpen, Lock } from 'lucide-react';
import ClassroomSubmissionForm from '@/components/ClassroomSubmissionForm';

const sections = [
    {
        title: 'Financial Statements',
        desc: 'Budget allocations, expenditure reports, and audit summaries from the SSC and OSR.',
        icon: DollarSign,
    },
    {
        title: 'Board Resolutions',
        desc: 'Official resolutions passed by the Supreme Student Council and related governing bodies.',
        icon: FileText,
    },
    {
        title: 'Minutes of Meetings',
        desc: 'Archived records of council meetings, committee deliberations, and special sessions.',
        icon: BookOpen,
    },
];

export default function TransparencyPage() {
    return (
        <>
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <ShieldCheck className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        Governance & <span className="text-gradient-gold">Transparency</span>
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Full visibility into how your student government fees are managed and how decisions are made.
                    </p>
                </div>
            </section>

            <section className="section bg-surface-base">
                <div className="container-main">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                        {sections.map((section) => {
                            const isFinancial = section.title === 'Financial Statements';
                            return (
                            <div key={section.title} className="feature-card card p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
                                {/* Coming Soon Overlay */}
                                <div className="coming-soon-overlay">
                                    <Lock size={28} className="text-subtle mb-2" />
                                    <span className="coming-soon-label">
                                        Coming Soon
                                    </span>
                                </div>

                                <div className={isFinancial ? 'icon-chip-gold mb-5' : 'icon-chip-blue mb-5'}>
                                    <section.icon size={28} />
                                </div>
                                <h3 className="text-lg font-bold mb-2">{section.title}</h3>
                                <p className="text-sm text-subtle">
                                    {section.desc}
                                </p>
                            </div>
                        );})}
                    </div>

                    <div className="mt-10">
                        <div className="card card-muted-cta p-6 md:p-8 mb-6 text-center">
                            <p className="text-sm text-body">
                                Student leaders submit transparency records here through Google Classroom.
                                Public viewers can track this page as submissions are synced and published.
                            </p>
                        </div>
                        <ClassroomSubmissionForm />
                    </div>

                    <div className="card card-muted-cta p-6 md:p-8 mt-10 text-center">
                        <p className="text-sm text-body">
                            📌 Transparency records from authorized submissions will appear here as soon as publishing sync is enabled.
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}
