'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText, Send, CheckCircle, AlertCircle, Search, ArrowRight, BookOpen, UploadCloud, ChevronLeft, ShieldCheck } from 'lucide-react';
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
    const [isPrivacyChecked, setIsPrivacyChecked] = useState(false);
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

        if (!isPrivacyChecked) {
            setResult({ success: false, message: 'You must acknowledge the Data Privacy Act to submit.' });
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
                setIsPrivacyChecked(false);
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
        <main className="portal-section-dark min-h-screen relative pt-24 pb-16">
            <div className="portal-noise-overlay" />
            <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full sg-glow-blue pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full sg-glow-gold pointer-events-none" />

            <div className="container-main max-w-4xl relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-4">
                    <Link href="/services" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-700/50 border border-white/10 text-sm font-medium text-slate-200 transition-all backdrop-blur-sm shadow-sm hover:shadow-md">
                        <ChevronLeft size={16} /> Back to Services
                    </Link>
                    <Link href="/services/track" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rtu-blue/20 hover:bg-rtu-blue/30 border border-rtu-blue/30 text-sm font-medium text-rtu-gold transition-all backdrop-blur-sm shadow-sm hover:shadow-md hover:border-rtu-gold/30">
                        <BookOpen size={16} /> Track Grievances
                    </Link>
                </div>

                <div className="text-center mb-12">
                    <FileText className="mx-auto mb-5 text-rtu-gold drop-shadow-[0_0_15px_rgba(203,165,77,0.3)]" size={56} />
                    <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight">
                        Student Grievance Form
                    </h1>
                    <p className="text-base md:text-lg max-w-xl mx-auto text-slate-400 leading-relaxed">
                        Submit official grievances securely to the Student Council. The strictest confidentiality is maintained.
                    </p>
                </div>

                <motion.form
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleSubmit}
                    className="portal-panel sg-hover-card p-6 sm:p-10 space-y-8 bg-slate-900/60 border border-white/10"
                >
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

                    {!isAuthenticated && (
                        <div className="portal-panel bg-amber-500/5 border-amber-500/20 p-8 md:p-12 rounded-xl flex flex-col items-center text-center shadow-[0_0_30px_rgba(245,158,11,0.05)]">
                            <AlertCircle className="text-amber-400 mb-4 drop-shadow-md" size={40} />
                            <h3 className="text-amber-300 text-xl font-semibold mb-3">Authentication Required</h3>
                            <p className="text-base text-amber-200/80 mb-8 max-w-md flex-1 leading-relaxed">
                                Log in with your current <strong>@rtu.edu.ph</strong> account to submit an official grievance securely.
                            </p>
                            <Link
                                href={`/login?callbackUrl=${encodeURIComponent('/services/grievance')}`}
                                className="inline-flex items-center justify-center gap-2 font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/30 w-full sm:w-auto px-8 py-3 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                            >
                                Log in to Submit
                            </Link>
                        </div>
                    )}

                    {/* Section 1: Submission Mode */}
                    <div className="space-y-4">
                        <h3 className="portal-eyebrow text-rtu-gold">1. Submission Privacy</h3>
                        <div className="rounded-xl border border-white/10 p-5 bg-black/20">
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
                                    className="h-4 w-4 rounded border-white/20 bg-black/50 text-rtu-blue focus:ring-rtu-blue"
                                />
                                <span className="text-sm font-medium text-white">Remain Anonymous</span>
                            </label>
                            <p className="mt-2 text-xs text-slate-400">
                                This will restrict your identity inputs. Please ensure that all submissions are conducive to a respectful environment.
                            </p>

                            {isAnonymous && !wantsAnonymousUpdates && (
                                <div className="mt-4 p-4 rounded-lg bg-rtu-gold/10 border border-rtu-gold/20">
                                    <p className="text-xs text-amber-200/80">
                                        <strong className="text-amber-200 block mb-1">Recommendation: Enable Optional Updates</strong>
                                        Turn on &quot;Receive optional updates&quot; so you can receive case updates via an anonymous email. Otherwise, you must manually track this case using the tracking link sequence we provide at the very end.
                                    </p>
                                </div>
                            )}

                            {isAnonymous && (
                                <div className="mt-4 p-4 rounded-lg border border-white/5 bg-white/5">
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
                                            className="h-4 w-4 rounded border-white/20 bg-black/50 text-rtu-blue focus:ring-rtu-blue"
                                        />
                                        <span className="text-sm font-medium text-white">Receive optional updates anonymously</span>
                                    </label>
                                    <p className="mt-2 text-xs text-slate-400">
                                        This contact channel is separate from your identity and will be used for case updates without exposing your institutional account.
                                    </p>

                                    {wantsAnonymousUpdates && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                                Temporary/Alias Email Address
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                maxLength={254}
                                                value={anonymousUpdateEmail}
                                                onChange={(e) => setAnonymousUpdateEmail(e.target.value)}
                                                disabled={!isAuthenticated || submitting}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm"
                                                placeholder="alias@example.com"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Optional: receive a copy */}
                        <div className="pt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={wantsCopy}
                                    onChange={(e) => setWantsCopy(e.target.checked)}
                                    disabled={submitting}
                                    className="h-4 w-4 rounded border-white/20 bg-black/50 text-rtu-blue focus:ring-rtu-blue"
                                />
                                <span className="text-sm font-medium text-white">Email me a receipt and tracking link <span className="text-slate-400 font-normal">(optional)</span></span>
                            </label>

                            {wantsCopy && (
                                <p className="text-xs text-slate-400 mt-2 pl-7">
                                    We will dispatch your case records to <strong>{sessionEmail}</strong>.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Case Details */}
                    <div className="space-y-5 pt-6 border-t border-white/10">
                        <h3 className="portal-eyebrow text-rtu-gold">2. Case Details</h3>

                        {!isAnonymous && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        minLength={2}
                                        maxLength={100}
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        disabled={!isAuthenticated || submitting}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm"
                                        placeholder="Juan Dela Cruz"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        maxLength={254}
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        disabled={!isAuthenticated || submitting}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm"
                                        placeholder="2026-xxxxxx@rtu.edu.ph"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-slate-200">
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
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm"
                                        placeholder="2026-xxxxxx"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {!isAnonymous ? null : <div className="sm:col-span-2 hidden"></div>} {/* Spacer */}

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                    Campus
                                </label>
                                <select
                                    required
                                    value={formData.campus}
                                    onChange={e => setFormData({ ...formData, campus: e.target.value as Campus })}
                                    disabled={!isAuthenticated || submitting}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm [&>option]:bg-slate-900"
                                >
                                    {CAMPUSES.map(campus => (
                                        <option key={campus} value={campus}>{campus}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                    College / Institute
                                </label>
                                <select
                                    required
                                    value={formData.college}
                                    onChange={e => setFormData({ ...formData, college: e.target.value as CollegeInstitute })}
                                    disabled={!isAuthenticated || submitting}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm [&>option]:bg-slate-900"
                                >
                                    {COLLEGE_INSTITUTES.map(college => (
                                        <option key={college} value={college}>{college}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                    Category
                                </label>
                                <select
                                    required
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value as GrievanceCategory })}
                                    disabled={!isAuthenticated || submitting}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm [&>option]:bg-slate-900"
                                >
                                    {GRIEVANCE_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                    Subject <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    maxLength={200}
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    disabled={!isAuthenticated || submitting}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm"
                                    placeholder="Brief subject line"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-200">
                                Complaint Narrative
                            </label>
                            <textarea
                                required
                                minLength={10}
                                maxLength={5000}
                                rows={6}
                                value={formData.complaintNarrative}
                                onChange={e => setFormData({ ...formData, complaintNarrative: e.target.value })}
                                disabled={!isAuthenticated || submitting}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm resize-y"
                                placeholder="Describe your grievance in extensive detail. Include dates, parties involved, and any past actions taken..."
                            />
                        </div>
                    </div>

                    {/* Section 3: Supporting Documents */}
                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <h3 className="portal-eyebrow text-rtu-gold">3. Supporting Evidence</h3>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100/90">
                            <p className="font-semibold text-amber-200 mb-2">Submit evidence whenever possible.</p>
                            <p className="leading-relaxed">
                                A grievance is easier to assess when it can establish a prima facie case, meaning there is enough initial evidence to show the complaint is credible on its face. Without evidence, the council may need to rely on similar submissions from other students, witness accounts, or later corroboration before it can formally acknowledge and act on the matter.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1 text-slate-400">Reference Format</label>
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
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:border-rtu-blue focus:ring-1 focus:ring-rtu-blue transition-colors text-sm [&>option]:bg-slate-900"
                                >
                                    <option value="document">{ATTACHMENT_KIND_CONFIG.document.label}</option>
                                    <option value="image">{ATTACHMENT_KIND_CONFIG.image.label}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1 text-slate-400">File Upload</label>
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
                                    className="w-full min-h-[38px] bg-white/5 border border-white/20 border-dashed rounded-lg px-4 py-2 flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 hover:border-white/30 transition-all text-sm text-slate-200"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            document.getElementById('grievance-attachment')?.click();
                                        }
                                    }}
                                >
                                    <UploadCloud size={16} className="text-rtu-blue" />
                                    <span>{attachment ? 'Swap File' : 'Click to Upload'}</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-slate-400">
                            <p>{ALL_ALLOWED_EXTENSIONS_NOTE}</p>
                            <p>Maximum file capacity: 10MB.</p>
                        </div>

                        {attachmentError && (
                            <p className="text-xs text-red-400/90 bg-red-900/20 py-2 px-3 rounded border border-red-500/20">{attachmentError}</p>
                        )}
                        {attachment && !attachmentError && (
                            <p className="text-xs text-green-400 bg-green-900/20 py-2 px-3 rounded border border-green-500/20 flex items-center gap-2">
                                <CheckCircle size={14} /> Attached successfully: {attachment.name}
                            </p>
                        )}
                    </div>

                    {/* Section 4: Compliance & Submit */}
                    <div className="space-y-5 pt-8 border-t border-white/10">
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
                            <div className="flex items-start gap-4">
                                <ShieldCheck className="text-sky-400 mt-1 shrink-0" size={24} />
                                <div className="flex-1 space-y-3">
                                    <h3 className="text-sky-300 font-semibold mb-1">Data Privacy Act & Legal Compliance</h3>
                                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                                        In compliance with Republic Act No. 10173 (Data Privacy Act of 2012), the Rizal Technological University Supreme Student Council will securely collect and process your digital grievance forms solely for the purpose of dispute resolution, institutional reform, and organizational records. By submitting this form, you affirm that the details provided are accurate to the best of your knowledge and that you consent to our administrative processing.
                                    </p>
                                    <label className="flex items-center gap-3 cursor-pointer pt-3 pb-1 border-t border-sky-500/10 mt-3">
                                        <input
                                            type="checkbox"
                                            checked={isPrivacyChecked}
                                            onChange={(e) => setIsPrivacyChecked(e.target.checked)}
                                            disabled={!isAuthenticated || submitting}
                                            className="h-4 w-4 rounded border-sky-500/30 bg-black/50 text-sky-500 focus:ring-sky-500"
                                        />
                                        <span className="text-sm font-medium text-white">I have read and consent to the Data Privacy Act stipulations.</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Result Banner */}
                        <AnimatePresence>
                            {result && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`p-4 rounded-xl flex items-start gap-3 border ${result.success ? 'bg-green-500/10 border-green-500/20 text-green-200' : 'bg-red-500/10 border-red-500/20 text-red-200'}`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {result.success ? <CheckCircle size={18} className="text-green-400" /> : <AlertCircle size={18} className="text-red-400" />}
                                            <span className="font-bold">{result.success ? 'Success' : 'Error'}</span>
                                        </div>
                                        <p className="mb-2 text-sm text-slate-300">{result.message}</p>

                                        {result.success && result.ticketId && (
                                            <div className="mt-4 p-5 bg-black/30 rounded-lg border border-green-500/20">
                                                <p className="portal-eyebrow text-green-500 mb-2">Secure Tracking ID</p>
                                                <p className="text-2xl font-mono font-bold text-white mb-4 tracking-wider">{result.ticketId}</p>

                                                <Link
                                                    href={result.trackingAccessToken
                                                        ? `/services/track?id=${encodeURIComponent(result.ticketId)}&access=${encodeURIComponent(result.trackingAccessToken)}`
                                                        : `/services/track?id=${encodeURIComponent(result.ticketId)}`}
                                                    className="sg-inline-link inline-flex items-center gap-2 text-sm font-medium border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 px-5 py-2.5 rounded-lg transition-colors"
                                                >
                                                    Track secure status <ArrowRight size={14} />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={submitting || !isAuthenticated || !isPrivacyChecked}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_20px_rgba(30,58,138,0.3)]
                                ${submitting
                                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-white/10'
                                    : !isPrivacyChecked || !isAuthenticated
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                                        : 'bg-rtu-blue hover:bg-blue-800 text-white border border-blue-400/30 hover:shadow-[0_0_30px_rgba(30,58,138,0.5)]'
                                }`}
                        >
                            {submitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                                    Encrypting & Submitting...
                                </>
                            ) : (
                                <>
                                    <Send size={18} className={!isPrivacyChecked || !isAuthenticated ? 'opacity-50' : ''} />
                                    Submit Official Grievance
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-slate-500 mt-4">
                            Please ensure all inputs are accurate to avoid delays.
                        </p>
                    </div>
                </motion.form>
            </div>
        </main>
    );
}
