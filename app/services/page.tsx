'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { extractGoogleFormId } from '@/lib/smartLinks';

const FORM_TYPE = 'grievance' as const;

export default function ServicesPage() {
    const { data: session, status } = useSession();
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '', honeypot: '' });
    // fake input field. if a bot fills this in, we drop the request. got tired of spam emails.
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const isAuthenticated = status === 'authenticated' && Boolean(session?.user?.email);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
            setResult({ success: false, message: 'Please sign in with your @rtu.edu.ph account to submit this form.' });
            return;
        }

        setSubmitting(true);
        setResult(null);

        try {
            const formId = extractGoogleFormId(FORM_TYPE) || FORM_TYPE;

            const res = await fetch('/api/forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formType: formId,
                    timestamp: Date.now(), // timestamp so we know when they complained
                    name: isAnonymous ? '' : formData.name,
                    email: isAnonymous ? '' : (session?.user?.email || formData.email),
                    subject: formData.subject,
                    message: formData.message,
                    honeypot: formData.honeypot, // gotcha, bots
                    isAnonymous,
                }),
            });

            const json = await res.json();

            if (res.ok) {
                setResult({ success: true, message: json.message || 'Submitted successfully!' });
                setFormData({ name: '', email: '', subject: '', message: '', honeypot: '' });
                setIsAnonymous(false);
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
                    <p className="text-white/70 max-w-lg mx-auto">
                        Submit student grievances securely, anonymously, to the University Student Government.
                    </p>
                </div>
            </section>

            <section className="section-tight">
                <div className="container-main max-w-3xl">
                    <p className="text-center text-xs mb-6 text-subtle">
                        Use this form to report an issue or concern.
                    </p>
                    <motion.form
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
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

                                    <div className="rounded-xl border border-soft p-4 bg-surface-muted">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isAnonymous}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setIsAnonymous(checked);
                                                    if (checked) {
                                                        setFormData(prev => ({ ...prev, name: '', email: '' }));
                                                    }
                                                }}
                                                disabled={!isAuthenticated || submitting}
                                                className="h-4 w-4"
                                            />
                                            <span className="text-sm font-medium text-body">Remain anonymous</span>
                                        </label>
                                        <p className="mt-2 text-xs text-subtle">
                                            When enabled, your grievance is sent without your name or email. Please ensure that all submissions are conducive to a respectful and constructive environment, even when anonymous.    
                                        </p>
                                    </div>

                                    {!isAnonymous && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5 text-body">
                                                    Name
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    minLength={2}
                                                    maxLength={100}
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    disabled={!isAuthenticated || submitting}
                                                    className="field-input text-sm"
                                                    placeholder="Juan Dela Cruz"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-1.5 text-body">
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    required
                                                    maxLength={254}
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    disabled={!isAuthenticated || submitting}
                                                    className="field-input text-sm"
                                                    placeholder="juan@rtu.edu.ph"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-body">
                                            Subject <span className="text-subtle">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={200}
                                            value={formData.subject}
                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            disabled={!isAuthenticated || submitting}
                                            className="field-input text-sm"
                                            placeholder="Brief subject line"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-body">
                                            Message
                                        </label>
                                        <textarea
                                            required
                                            minLength={10}
                                            maxLength={5000}
                                            rows={5}
                                            value={formData.message}
                                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                                            disabled={!isAuthenticated || submitting}
                                            className="field-input text-sm resize-none"
                                            placeholder="Describe your grievance in detail..."
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

                                {isAuthenticated ? (
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="btn-primary w-full mt-6 gap-2 text-base"
                                        style={{ opacity: submitting ? 0.6 : 1 }}
                                    >
                                        {submitting ? <span className="btn-spinner" /> : <Send size={18} />}
                                        {submitting ? 'Submitting...' : 'Submit Grievance'}
                                    </button>
                                ) : (
                                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-sm text-amber-900">
                                            Log in with your <strong>@rtu.edu.ph</strong> account to submit this form.
                                        </p>
                                        <Link
                                            href={`/login?callbackUrl=${encodeURIComponent('/services')}`}
                                            className="btn-primary w-full mt-3 inline-flex items-center justify-center gap-2 text-base"
                                        >
                                            Continue to Login
                                        </Link>
                                    </div>
                                )}
                    </motion.form>

                </div>
            </section>
        </>
    );
}
