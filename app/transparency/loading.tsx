export default function TransparencyLoading() {
    return <section className="portal-section-slate section min-h-screen" aria-busy="true" aria-label="Loading financial reports">
        <div className="container-main space-y-8"><h1 className="text-3xl font-bold text-white">SSC financial transparency</h1><span className="sr-only">Loading financial reports. Please wait.</span>
            <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse"><div className="h-12 rounded-lg bg-white/10" /><div className="grid grid-cols-2 gap-6 md:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="h-20 rounded-lg bg-white/10" />)}</div>{[0, 1, 2].map(item => <div key={item} className="h-16 rounded-lg bg-white/10" />)}</div>
        </div>
    </section>;
}
