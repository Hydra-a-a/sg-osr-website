'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText, Send, CheckCircle, AlertCircle, Search, ArrowRight, BookOpen, UploadCloud } from 'lucide-react';
import {
    CAMPUSES,
    COLLEGE_INSTITUTES,
    GRIEVANCE_CATEGORIES,
    type Campus,
    type CollegeInstitute,
    type GrievanceCategory,
} from '@/lib/ticket-constants';
import { saveTicketToHistory } from '@/app/services/track/page';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type AttachmentKind = 'image' | 'document';

const ATTACHMENT_KIND_CONFIG: Record<AttachmentKind, {
    label: string;
    accept: string;
    extensions: Set<string>;
}> = {
    image: {
        label: 'Image (PNG/JPG)',
        accept: '.png,.jpg,.jpeg,image/png,image/jpeg',
        extensions: new Set(['.png', '.jpg', '.jpeg']),
    },
    document: {
        label: 'Document (PDF/DOC)',
        accept: '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extensions: new Set(['.pdf', '.doc', '.docx']),
    },
};

const ALL_ALLOWED_EXTENSIONS_NOTE = 'Allowed file extensions: .png, .jpg, .jpeg, .pdf, .doc, .docx';

function getFileExtension(fileName: string): string {
    const lowered = fileName.toLowerCase();
    return lowered.includes('.') ? lowered.slice(lowered.lastIndexOf('.')) : '';
}

export default function GrievancePage() {
    const { data: session, status } = useSession();
    const formStartTimestampRef = useRef<number | null>(null);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [wantsCopy, setWantsCopy] = useState(false);
    const [wantsAnonymousUpdates, setWantsAnonymousUpdates] = useState(false);
    const [anonymousUpdateEmail, setAnonymousUpdateEmail] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        studentId: '',
        campus: CAMPUSES[0] as Campus,
        college: COLLEGE_INSTITUTES[0] as CollegeInstitute,
        subject: '',
        category: GRIEVANCE_CATEGORIES[0] as GrievanceCategory,
        complaintNarrative: '',
        honeypot: ''
    });
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentKind, setAttachmentKind] = useState<AttachmentKind>('document');
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    // fake input field. if a bot fills this in, we drop the request. got tired of spam emails.
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        ticketId?: string;
        trackingAccessToken?: string;
    } | null>(null);

    const isAuthenticated = status === 'authenticated' && Boolean(session?.user?.email);
    const sessionEmail = session?.user?.email?.trim().toLowerCase() || '';

    useEffect(() => {
        formStartTimestampRef.current = Date.now();
    }, []);

    const handleAttachmentChange = (file: File | null) => {
        if (!file) {
            setAttachment(null);
            setAttachmentError(null);
            return;
        }

        const fileName = file.name.toLowerCase();
        const extension = getFileExtension(fileName);
        const config = ATTACHMENT_KIND_CONFIG[attachmentKind];

        if (!config.extensions.has(extension)) {
            setAttachment(null);
            setAttachmentError(`File does not match selected type. Please upload ${config.label} files only.`);
            return;
        }

        if (file.size > MAX_ATTACHMENT_BYTES) {
            setAttachment(null);
            setAttachmentError('Attachment must be 10MB or smaller.');
            return;
        }

        setAttachment(file);
        setAttachmentError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
            setResult({ success: false, message: 'Please sign in with your @rtu.edu.ph account to submit this form.' });
            return;
        }

        setSubmitting(true);
        setResult(null);

        try {
            if (attachmentError) {
                setResult({ success: false, message: attachmentError });
                setSubmitting(false);
                return;
            }

            if (!attachment) {
                const proceedWithoutProof = window.confirm(
                    'You are submitting without supporting proof. This may make it harder to establish a prima facie case quickly, and verification may depend on corroborating reports from other students. Do you want to continue?'
                );
                if (!proceedWithoutProof) {
                    setSubmitting(false);
                    return;
                }
            }

            if (isAnonymous && wantsAnonymousUpdates) {
                const destination = anonymousUpdateEmail.trim().toLowerCase();
                const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination);
                if (!isEmail) {
                    setResult({ success: false, message: 'Please enter a valid email for optional anonymous updates.' });
                    setSubmitting(false);
                    return;
                }
            }

            const formStartTimestamp = formStartTimestampRef.current ?? Date.now();

            const payload = new FormData();
            payload.set('studentId', formData.studentId.trim());
            payload.set('campus', formData.campus);
            payload.set('college', formData.college);
            payload.set('category', formData.category);
            payload.set('subject', formData.subject);
            payload.set('complaintNarrative', formData.complaintNarrative);
            payload.set('attachmentKind', attachmentKind);
            payload.set('honeypot', formData.honeypot);
            payload.set('isAnonymous', String(isAnonymous));
            payload.set('timestamp', String(formStartTimestamp));

            if (wantsCopy) {
                payload.set('contactEmail', sessionEmail);
            }

            const updatesOptIn = isAnonymous && wantsAnonymousUpdates;
            payload.set('updatesOptIn', String(updatesOptIn));
            if (updatesOptIn) {
                payload.set('updatesChannel', 'email');
                payload.set('updatesDestination', anonymousUpdateEmail.trim().toLowerCase());
                payload.set('updatesNotes', 'Student opted in for anonymous update notifications');
            }

            if (attachment) {
                payload.set('attachment', attachment);
            }

            const res = await fetch('/api/tickets', {
                method: 'POST',
                body: payload,
            });

            const json = await res.json();

            if (res.ok) {
                const ticketId: string = json.ticketId;
                const trackingAccessToken = typeof json.trackingAccessToken === 'string'
                    ? json.trackingAccessToken
                    : undefined;

                setResult({
                    success: true,
                    message: json.message || 'Submitted successfully!',
                    ticketId,
                    trackingAccessToken,
                });
                // Persist so the Track page can show history even after navigation
                saveTicketToHistory({
                    id: ticketId,
                    submittedAt: new Date().toISOString(),
                    category: formData.category,
                    subject: formData.subject,
                }, trackingAccessToken);
                setFormData({
                    name: '',
                    email: '',
                    studentId: '',
                    campus: CAMPUSES[0],
                    college: COLLEGE_INSTITUTES[0],
                    subject: '',
                    category: GRIEVANCE_CATEGORIES[0],
                    complaintNarrative: '',
                    honeypot: '',
                });
                setAttachment(null);
                setAttachmentKind('document');
                setAttachmentError(null);
                setIsAnonymous(false);
                setWantsCopy(false);
                setWantsAnonymousUpdates(false);
                setAnonymousUpdateEmail('');
                formStartTimestampRef.current = Date.now();
            } else {
                const errorPayload = json.error;
                const errorMsg = typeof errorPayload === 'object' && errorPayload !== null
                    ? (errorPayload.message as string) || 'Submission failed'
                    : typeof json.message === 'string'
                        ? json.message
                        : 'Submission failed';
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
                    <h1 className="page-header-title font-bold text-white mb-3">
                        Student <span className="text-gradient-gold">Grievance</span> Form
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Submit student grievances securely, anonymously, to the University Student Government.
                    </p>
                </div>
            </section>

            <section className="section-tight">
                <div className="container-main max-w-3xl">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                        <Link href="/services" className="text-sm inline-flex items-center gap-2 font-medium text-subtle hover:text-body transition-colors">
                            ← Back to Services
                        </Link>
                        <Link href="/services/track" className="text-sm inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl border-2 border-rtu-blue text-rtu-blue hover:bg-rtu-blue hover:text-white transition-all">
                            <BookOpen size={16} /> Track Submitted Grievances
                        </Link>
                    </div>
                    <motion.form
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleSubmit}
                        className="card p-8"
                    >
                        <div className="space-y-5">
                            {/* hidden bot trap */}
                            <div className="is-hidden-offscreen" aria-hidden="true">
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
                                                setFormData(prev => ({ ...prev, name: '', email: '', studentId: '' }));
                                            } else {
                                                setWantsAnonymousUpdates(false);
                                                setAnonymousUpdateEmail('');
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

                                {isAnonymous && !wantsAnonymousUpdates && (
                                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                                        <p className="text-xs text-amber-900">
                                            Recommendation: enable <strong>Receive optional updates anonymously</strong> so you can receive case updates by email.
                                            If you skip this, updates are still possible, but you may need to check the tracker manually using your ticket ID and access link.
                                        </p>
                                    </div>
                                )}

                                {isAnonymous && (
                                    <div className="mt-3 rounded-lg border border-soft bg-surface-base p-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={wantsAnonymousUpdates}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setWantsAnonymousUpdates(checked);
                                                    if (!checked) {
                                                        setAnonymousUpdateEmail('');
                                                    }
                                                }}
                                                disabled={!isAuthenticated || submitting}
                                                className="h-4 w-4"
                                            />
                                            <span className="text-sm font-medium text-body">Receive optional updates anonymously</span>
                                        </label>
                                        <p className="mt-1 text-xs text-subtle">
                                            This contact channel is separate from your identity and requires officer verification before updates can be delivered.
                                        </p>

                                        {wantsAnonymousUpdates && (
                                            <div className="mt-3">
                                                <label className="block text-sm font-medium mb-1.5 text-body">
                                                    Optional update email
                                                </label>
                                                <input
                                                    type="email"
                                                    required
                                                    maxLength={254}
                                                    value={anonymousUpdateEmail}
                                                    onChange={(e) => setAnonymousUpdateEmail(e.target.value)}
                                                    disabled={!isAuthenticated || submitting}
                                                    className="field-input text-sm"
                                                    placeholder="you@example.com"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isAnonymous && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                                            placeholder="2026-xxxxxx@rtu.edu.ph"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Optional: receive a copy */}
                            <div className="pt-3 border-t border-soft mb-5">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={wantsCopy}
                                        onChange={(e) => setWantsCopy(e.target.checked)}
                                        disabled={submitting}
                                        className="h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-body">Send me a copy <span className="text-subtle font-normal">(optional)</span></span>
                                </label>

                                {wantsCopy && (
                                    <p className="text-xs text-subtle mt-1.5 pl-7">
                                        We will send your confirmation and secure tracking link to <strong>{sessionEmail}</strong>.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {!isAnonymous && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5 text-body">
                                            Student ID
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            minLength={3}
                                            maxLength={40}
                                            value={formData.studentId}
                                            onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                                            disabled={!isAuthenticated || submitting}
                                            className="field-input text-sm"
                                            placeholder="2026-xxxxxx"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-body">
                                        Campus
                                    </label>
                                    <select
                                        required
                                        value={formData.campus}
                                        onChange={e => setFormData({ ...formData, campus: e.target.value as Campus })}
                                        disabled={!isAuthenticated || submitting}
                                        className="field-input text-sm"
                                    >
                                        {CAMPUSES.map(campus => (
                                            <option key={campus} value={campus}>{campus}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium mb-1.5 text-body">
                                        College / Institute
                                    </label>
                                    <select
                                        required
                                        value={formData.college}
                                        onChange={e => setFormData({ ...formData, college: e.target.value as CollegeInstitute })}
                                        disabled={!isAuthenticated || submitting}
                                        className="field-input text-sm"
                                    >
                                        {COLLEGE_INSTITUTES.map(college => (
                                            <option key={college} value={college}>{college}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-body">
                                        Category
                                    </label>
                                    <select
                                        required
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value as GrievanceCategory })}
                                        disabled={!isAuthenticated || submitting}
                                        className="field-input text-sm"
                                    >
                                        {GRIEVANCE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

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
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-body">
                                    Complaint Narrative
                                </label>
                                <textarea
                                    required
                                    minLength={10}
                                    maxLength={5000}
                                    rows={5}
                                    value={formData.complaintNarrative}
                                    onChange={e => setFormData({ ...formData, complaintNarrative: e.target.value })}
                                    disabled={!isAuthenticated || submitting}
                                    className="field-input text-sm resize-none"
                                    placeholder="Describe your grievance in detail..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-body">
                                    Attachment <span className="text-subtle">(optional)</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-subtle">Attachment type</label>
                                        <select
                                            value={attachmentKind}
                                            onChange={(e) => {
                                                const nextKind = e.target.value as AttachmentKind;
                                                setAttachmentKind(nextKind);
                                                if (attachment) {
                                                    const ext = getFileExtension(attachment.name);
                                                    if (!ATTACHMENT_KIND_CONFIG[nextKind].extensions.has(ext)) {
                                                        setAttachment(null);
                                                        setAttachmentError(`Selected file was removed. Please choose ${ATTACHMENT_KIND_CONFIG[nextKind].label} files only.`);
                                                    } else {
                                                        setAttachmentError(null);
                                                    }
                                                }
                                            }}
                                            disabled={!isAuthenticated || submitting}
                                            className="field-input text-sm"
                                        >
                                            <option value="document">{ATTACHMENT_KIND_CONFIG.document.label}</option>
                                            <option value="image">{ATTACHMENT_KIND_CONFIG.image.label}</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium mb-1 text-subtle">Choose file</label>
                                        <input
                                            id="grievance-attachment"
                                            type="file"
                                            accept={ATTACHMENT_KIND_CONFIG[attachmentKind].accept}
                                            disabled={!isAuthenticated || submitting}
                                            onChange={(e) => handleAttachmentChange(e.target.files?.[0] || null)}
                                            className="sr-only"
                                        />
                                        <label
                                            htmlFor="grievance-attachment"
                                            className="field-input text-sm min-h-[44px] flex items-center justify-center gap-2 cursor-pointer border-dashed"
                                        >
                                            <UploadCloud size={16} />
                                            <span>{attachment ? 'Replace selected file' : 'Click to add a file'}</span>
                                        </label>
                                    </div>
                                </div>
                                <p className="text-xs text-subtle mt-1.5">{ALL_ALLOWED_EXTENSIONS_NOTE}</p>
                                <p className="text-xs text-subtle mt-1">Maximum file size: 10MB.</p>
                                {attachmentError && (
                                    <p className="text-xs text-red-700 mt-1">{attachmentError}</p>
                                )}
                                {attachment && !attachmentError && (
                                    <p className="text-xs text-green-700 mt-1">Selected: {attachment.name}</p>
                                )}
                                {!attachment && !attachmentError && (
                                    <div className="mt-2 space-y-2">
                                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                                            <p className="text-xs text-amber-900">
                                                Submitting without proof is allowed, but it may be more difficult to establish a prima facie case at intake.
                                                In those cases, the Council may need corroborating complaints or additional supporting details before validation can proceed.
                                            </p>
                                        </div>
                                        <details className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                            <summary className="text-xs font-semibold text-blue-900 cursor-pointer select-none">
                                                What is a prima facie case?
                                            </summary>
                                            <p className="text-xs text-blue-900 mt-2">
                                                It means there is enough initial, credible information to justify opening formal review.
                                                Supporting files, screenshots, documents, or specific factual details help establish this threshold faster.
                                            </p>
                                        </details>
                                    </div>
                                )}
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
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold">{result.success ? 'Success' : 'Error'}</span>
                                        </div>
                                        <p className="mb-2">{result.message}</p>

                                        {result.success && result.ticketId && (
                                            <div className="mt-4 p-4 bg-white/60 dark:bg-black/20 rounded-lg border border-green-200">
                                                <p className="eyebrow-label text-green-700 mb-1">Your Tracking ID</p>
                                                <p className="text-2xl font-mono font-bold text-green-900 mb-3">{result.ticketId}</p>

                                                <Link
                                                    href={result.trackingAccessToken
                                                        ? `/services/track?id=${encodeURIComponent(result.ticketId)}&access=${encodeURIComponent(result.trackingAccessToken)}`
                                                        : `/services/track?id=${encodeURIComponent(result.ticketId)}`}
                                                    className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900 transition-colors"
                                                >
                                                    Track status <ArrowRight size={14} />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {isAuthenticated ? (
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`btn-primary w-full mt-6 gap-2 text-base ${submitting ? 'is-submitting' : ''}`}
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
                                    href={`/login?callbackUrl=${encodeURIComponent('/services/grievance')}`}
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
