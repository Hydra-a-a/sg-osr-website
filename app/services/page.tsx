'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, MessageSquare, Mail, Send, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { extractGoogleFormId } from '@/lib/smartLinks';

const formTypes = [
    { key: 'grievance', label: 'Grievance', icon: FileText, desc: 'Report an issue or concern' },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare, desc: 'Share suggestions or comments' },
    { key: 'contact', label: 'Contact', icon: Mail, desc: 'Get in touch with the Office of the Student Regent' },
] as const;

type FormType = typeof formTypes[number]['key'];

export default function ServicesPage() {
    const [activeForm, setActiveForm] = useState<FormType>('grievance');
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '', honeypot: '' });
    // fake input field. if a bot fills this in, we drop the request. got tired of spam emails.
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setResult(null);

        try {
            // maybe i'll pull this from the sheet later if i stop being lazy
            const formId = extractGoogleFormId(activeForm) || activeForm;

            const res = await fetch('/api/forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formType: formId,
                    timestamp: Date.now(), // timestamp so we know when they complained
                    name: formData.name,
                    email: formData.email,
                    subject: formData.subject,
                    message: formData.message,
                    honeypot: formData.honeypot, // gotcha, bots
                }),
            });

            const json = await res.json();

            if (res.ok) {
                setResult({ success: true, message: json.message || 'Submitted successfully!' });
                setFormData({ name: '', email: '', subject: '', message: '', honeypot: '' });
            } else {
                const errorMsg = json.details
                    ? json.details.map((d: any) => `${d.field}: ${d.message}`).join('. ')
                    : json.error || 'Submission failed';
                setResult({ success: false, message: errorMsg });
            }
        } catch {
            setResult({ success: false, message: 'Network error. Please try again.' });
        }

        setSubmitting(false);
    };

    return (
        <>
            {/* Header — instant, no motion */}
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <FileText className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        Student <span className="text-gradient-gold">Services</span>
                    </h1>
                    <p className="text-white/60 max-w-lg mx-auto">
                        File grievances, share feedback, or contact any branch of the RTU Student Government.
                    </p>
                </div>
            </section>

            <section className="section">
                <div className="container-main max-w-2xl">
                    {/* Form Type Tabs */}
                    <p className="text-center text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                        💡 Not sure where to start? An AI assistant will be available soon to help guide you.
                    </p>
                    <div className="flex gap-3 mb-8 justify-center flex-wrap">
                        {formTypes.map(ft => (
                            <button
                                key={ft.key}
                                onClick={() => { setActiveForm(ft.key); setResult(null); }}
                                className="card px-5 py-3 flex items-center gap-2 transition-all cursor-pointer border-2"
                                style={{
                                    borderColor: activeForm === ft.key ? 'var(--rtu-gold)' : 'transparent',
                                }}
                            >
                                <ft.icon size={18} style={{ color: activeForm === ft.key ? 'var(--rtu-gold-dark)' : 'var(--text-muted)' }} />
                                <div className="text-left">
                                    <span
                                        className="block text-sm font-semibold"
                                        style={{ color: activeForm === ft.key ? 'var(--rtu-blue)' : 'var(--text-secondary)' }}
                                    >
                                        {ft.label}
                                    </span>
                                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {ft.desc}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Conditional Rendering: Native Form vs Smart Fallback */}
                    {formTypes.some(ft => ft.key === activeForm) ? (
                        <form
                            onSubmit={handleSubmit}
                            className="card p-8"
                        >
                            <div className="space-y-5">
                                {/* hidden bot trap */}
                                <div style={{ position: 'absolute', opacity: 0, top: '-9999px', left: '-9999px' }} aria-hidden="true">
                                    <label htmlFor="user_website_url">Website URL (leave blank)</label>
                                    <input
                                        type="text"
                                        id="user_website_url"
                                        name="user_website_url"
                                        value={formData.honeypot}
                                        onChange={e => setFormData({ ...formData, honeypot: e.target.value })}
                                        tabIndex={-1}
                                        autoComplete="off"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        minLength={2}
                                        maxLength={100}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm"
                                        style={{
                                            borderColor: 'var(--glass-border)',
                                            background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                        }}
                                        placeholder="Juan Dela Cruz"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        maxLength={254}
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm"
                                        style={{
                                            borderColor: 'var(--glass-border)',
                                            background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                        }}
                                        placeholder="juan@rtu.edu.ph"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Subject <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={200}
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm"
                                        style={{
                                            borderColor: 'var(--glass-border)',
                                            background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                        }}
                                        placeholder="Brief subject line"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Message
                                    </label>
                                    <textarea
                                        required
                                        minLength={10}
                                        maxLength={5000}
                                        rows={5}
                                        value={formData.message}
                                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm resize-none"
                                        style={{
                                            borderColor: 'var(--glass-border)',
                                            background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                        }}
                                        placeholder="Describe your concern, feedback, or inquiry in detail..."
                                    />
                                </div>
                            </div>

                            {/* Result Banner — this animation is appropriate (user-triggered) */}
                            <AnimatePresence>
                                {result && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className={`mt-5 p-4 rounded-xl flex items-start gap-3 text-sm ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                            }`}
                                    >
                                        {result.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                        <span>{result.message}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary w-full mt-6 gap-2 text-base"
                                style={{ opacity: submitting ? 0.6 : 1 }}
                            >
                                {submitting ? <span className="btn-spinner" /> : <Send size={18} />}
                                {submitting ? 'Submitting...' : `Submit ${formTypes.find(f => f.key === activeForm)?.label}`}
                            </button>
                        </form>
                    ) : (
                        <div className="card p-10 text-center flex flex-col items-center justify-center">
                            <ExternalLink size={40} className="mb-4" style={{ color: 'var(--text-muted)' }} />
                            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>External Form</h3>
                            <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                This form is hosted externally. Please open it in a new tab to complete your submission.
                            </p>
                            <a
                                href={String(activeForm).startsWith('http') ? String(activeForm) : `https://docs.google.com/forms/d/e/${extractGoogleFormId(String(activeForm)) || activeForm}/viewform`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary flex items-center justify-center gap-2"
                            >
                                Open Form <ExternalLink size={16} />
                            </a>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
