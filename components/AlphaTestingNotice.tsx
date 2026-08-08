export default function AlphaTestingNotice() {
    return (
        <aside
            aria-label="Alpha closed testing notice"
            className="border-b border-red-300/40 bg-red-950/75 text-red-50 shadow-[0_10px_24px_-20px_rgba(127,29,29,0.9)]"
        >
            <div className="container-main flex items-start gap-3 py-3 text-sm leading-relaxed md:items-center">
                <span
                    aria-hidden="true"
                    className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-red-300 shadow-[0_0_0_4px_rgba(248,113,113,0.14)] md:mt-0"
                />
                <p>
                    <strong className="font-semibold text-red-100">Alpha closed testing:</strong>{' '}
                    This website is still in alpha closed testing. Please expect bugs, unfinished features, and unexpected UI breakage. If you find an issue, contact{' '}
                    <a
                        href="mailto:2023-100433@rtu.edu.ph"
                        className="font-semibold text-white underline decoration-red-300/80 underline-offset-4 transition-colors hover:text-red-200"
                    >
                        2023-100433@rtu.edu.ph
                    </a>
                    .
                </p>
            </div>
        </aside>
    );
}
