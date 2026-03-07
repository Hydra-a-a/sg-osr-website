import { ShieldCheck, DollarSign, FileText, BookOpen, Lock } from 'lucide-react';

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
                    <p className="text-white/60 max-w-lg mx-auto">
                        Full visibility into how your student government fees are managed and how decisions are made.
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: 'var(--bg-primary)' }}>
                <div className="container-main">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {sections.map((section) => (
                            <div key={section.title} className="card p-8 flex flex-col items-center text-center relative overflow-hidden">
                                {/* Coming Soon Overlay */}
                                <div
                                    className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                                    style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)' }}
                                >
                                    <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                        Coming Soon
                                    </span>
                                </div>

                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                                    style={{ background: 'rgba(0, 43, 127, 0.1)', color: 'var(--rtu-blue)' }}
                                >
                                    <section.icon size={28} />
                                </div>
                                <h3 className="text-lg font-bold mb-2">{section.title}</h3>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    {section.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="card p-8 mt-10 text-center" style={{ background: 'rgba(0, 43, 127, 0.04)', border: '1px dashed var(--rtu-blue-light)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            📌 This section will auto-sync with Google Classroom once authentication is live.
                            Council officers will be able to submit documents through the portal that are automatically reflected here.
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}
