import Link from 'next/link';
import ClassroomSetupPanel from '@/components/ClassroomSetupPanel';
import ClassroomSubmissionForm from '@/components/ClassroomSubmissionForm';

export default function TransparencySubmissionPage() {
    return <section className="portal-section-slate section min-h-screen">
        <div className="container-main space-y-8">
            <Link href="/transparency" className="text-sm text-sky-300 underline underline-offset-4">Back to transparency</Link>
            <header>
                <h1 className="text-3xl font-bold text-white md:text-4xl">Submit an SSC financial report</h1>
                <p className="mt-4 max-w-2xl text-slate-300">Student leaders submit privately through Google Classroom. Reports become public only after preparation and approval by two different officers.</p>
            </header>
            <ClassroomSetupPanel />
            <ClassroomSubmissionForm />
        </div>
    </section>;
}
