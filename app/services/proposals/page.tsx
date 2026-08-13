'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { NoncedStyle } from '@/components/CspNonceProvider';
import { clearDraft, getOrCreateIdempotencyKey, readDraft, resetIdempotencyKey, writeDraft } from '@/lib/draft-storage';
import {
    Lightbulb, ArrowLeft, FileText, CheckCircle,
    Users, Target, Calendar, Send, ShieldCheck, UploadCloud, X, AlertCircle, ArrowRight, ChevronDown, Search
} from 'lucide-react';



const UN_SDGS = [
    'No Poverty',
    'Zero Hunger',
    'Good Health and Well-being',
    'Quality Education',
    'Gender Equality',
    'Clean Water and Sanitation',
    'Affordable and Clean Energy',
    'Decent Work and Economic Growth',
    'Industry, Innovation and Infrastructure',
    'Reduced Inequality',
    'Sustainable Cities and Communities',
    'Responsible Consumption and Production',
    'Climate Action',
    'Life Below Water',
    'Life on Land',
    'Peace and Justice Strong Institutions',
    'Partnerships to achieve the Goal'
] as const;

const ACCESS_TOKEN_STORAGE_KEY = 'osr_proposal_access_tokens';
const PROPOSAL_DRAFT_KEY = 'osr:draft:proposal:v1';
const PROPOSAL_IDEMPOTENCY_KEY = 'osr:idempotency:proposal:v1';
const PROPOSAL_DRAFT_VERSION = 1;

type ProposalDraft = { title: string; categories: string[]; projectType: string; description: string };

function saveStoredAccessToken(proposalId: string, accessToken: string): void {
    const normalizedProposalId = String(proposalId || '').trim().toUpperCase();
    const normalizedToken = String(accessToken || '').trim();
    if (!normalizedProposalId || !normalizedToken) {
        return;
    }

    try {
        const raw = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        const existing = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        existing[normalizedProposalId] = normalizedToken;
        sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, JSON.stringify(existing));
    } catch {
    }
}

export default function ProposalsPage() {
    const { data: session } = useSession();
    const userRole = session?.user?.role ?? 'student';

    const [title, setTitle] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [projectType, setProjectType] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [submittedProposalId, setSubmittedProposalId] = useState('');
    const [submittedAccessToken, setSubmittedAccessToken] = useState('');
    const draftRestoredRef = useRef(false);
    const idempotencyKeyRef = useRef<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const draft = readDraft<ProposalDraft>(PROPOSAL_DRAFT_KEY, PROPOSAL_DRAFT_VERSION);
        const restoreTimer = window.setTimeout(() => {
            if (draft) {
                setTitle(typeof draft.title === 'string' ? draft.title : '');
                setCategories(Array.isArray(draft.categories) ? draft.categories.filter((item): item is string => typeof item === 'string') : []);
                setProjectType(typeof draft.projectType === 'string' ? draft.projectType : '');
                setDescription(typeof draft.description === 'string' ? draft.description : '');
            }
            draftRestoredRef.current = true;
        }, 0);
        return () => window.clearTimeout(restoreTimer);
    }, []);

    useEffect(() => {
        if (!draftRestoredRef.current) return;
        const timeout = window.setTimeout(() => {
            writeDraft<ProposalDraft>(PROPOSAL_DRAFT_KEY, PROPOSAL_DRAFT_VERSION, { title, categories, projectType, description });
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [categories, description, projectType, title]);

    const getSubmissionKey = () => {
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = getOrCreateIdempotencyKey(PROPOSAL_IDEMPOTENCY_KEY);
        }
        return idempotencyKeyRef.current;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {      
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError("File is too large. Maximum size is 10MB.");
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title || categories.length === 0 || !projectType || !description || !file) {
            setError("Please fill out all fields, select at least one SDG, and attach a proposal document.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('category', categories.join(', '));
            formData.append('projectType', projectType);
            formData.append('description', description);
            formData.append('attachment', file);

            const res = await fetch('/api/proposals', {
                method: 'POST',
                headers: { 'Idempotency-Key': getSubmissionKey() },
                body: formData,
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit proposal.');    
            }

            setSubmittedProposalId(typeof data.proposalId === 'string' ? data.proposalId : '');
            setSubmittedAccessToken(typeof data.trackingAccessToken === 'string' ? data.trackingAccessToken : '');
            if (typeof data.proposalId === 'string' && typeof data.trackingAccessToken === 'string') {
                saveStoredAccessToken(data.proposalId, data.trackingAccessToken);
            }
            setIsSuccess(true);
            setTitle('');
            setCategories([]);
            setProjectType('');
            setDescription('');
            setFile(null);
            clearDraft(PROPOSAL_DRAFT_KEY);
            idempotencyKeyRef.current = resetIdempotencyKey(PROPOSAL_IDEMPOTENCY_KEY);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className={`services-shell relative overflow-hidden`}>
                <div className="services-noise" aria-hidden="true" />
                <section className="relative z-10 min-h-[80vh] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="services-card max-w-xl w-full p-10 flex flex-col items-center text-center"
                    >
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),_0_4px_24px_rgba(16,185,129,0.1)]">
                            <CheckCircle size={36} className="text-emerald-400" />
                        </div>
                        <h2 className={`text-3xl font-bold text-white mb-4`}>Proposal Submitted!</h2>
                        <p className="text-slate-300 mb-8 leading-relaxed text-sm md:text-base">        
                            Your project proposal has been successfully logged and sent to the committee for review. We will reach out to you at your active RTU email address regarding the status of your proposal.
                        </p>
                        {submittedProposalId ? (
                            <div className="w-full max-w-sm rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-100 px-4 py-3 text-sm mb-4">
                                Tracker ID: <span className="font-mono font-semibold">{submittedProposalId}</span>
                            </div>
                        ) : null}
                        {submittedProposalId ? (
                            <Link
                                href={`/services/proposals/track?id=${encodeURIComponent(submittedProposalId)}${submittedAccessToken ? `&access=${encodeURIComponent(submittedAccessToken)}` : ''}`}
                                className="w-full max-w-sm py-3.5 px-6 rounded-xl font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-500/10 transition-all flex justify-center items-center gap-2 mb-4"
                            >
                                Open Proposal Tracker <ArrowRight size={18} />
                            </Link>
                        ) : null}
                        <button
                            onClick={() => {
                                setIsSuccess(false);
                                setSubmittedProposalId('');
                                setSubmittedAccessToken('');
                            }}
                            className="w-full max-w-sm py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 border border-blue-400/20 shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2 mb-4"
                        >
                            Submit Another Proposal <ArrowRight size={18} />
                        </button>
                        <Link href="/services" className="text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors inline-flex items-center gap-1.5 pt-2">
                            <ArrowLeft size={14} /> Return to Services Hub
                        </Link>
                    </motion.div>
                </section>

                <NoncedStyle css={getStyles()} />
            </div>
        );
    }

    return (
        <div className={`services-shell relative overflow-hidden`}>
            <div className="services-noise" aria-hidden="true" />

            <section className="relative z-10 pt-20 pb-10 md:pt-28 md:pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Back Link */}
                <Link
                    href="/services"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors mb-10 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm"
                >
                    <ArrowLeft size={16} /> Back to Services
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div className="max-w-2xl">
                        <span className="services-eyebrow inline-flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm mb-4">
                            <Lightbulb size={14} className="text-amber-400" />
                            Program Pipeline
                        </span>
                        <h1 className={`services-display mt-3`}>
                            Project <span className="services-display-accent">Proposals</span>
                        </h1>
                        <p className="services-lead mt-5 max-w-2xl text-slate-200">
                            Submit program and project proposals for the Student Council&apos;s consideration. For Student Leaders and Officers.
                        </p>
                    </div>

                    <Link
                        href="/services/proposals/track"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-400/15 transition-colors shadow-lg shadow-amber-500/10"
                    >
                        <Search size={16} />
                        Track Submitted Proposals
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Submission Form */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            className="services-command-deck p-6 md:p-10"
                        >
                            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 flex justify-center items-center border border-blue-500/20">
                                    <FileText className="text-blue-400" size={24} />
                                </div>
                                <div>
                                    <h2 className={`text-xl md:text-2xl font-semibold text-white`}>Official Proposal Form</h2>
                                    <p className="text-sm text-slate-400">Complete standard fields below</p>
                                </div>
                            </div>

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                                >
                                    <AlertCircle className="text-red-400 mt-0.5 flex-shrink-0" size={18} />
                                    <p className="text-sm text-red-200">{error}</p>
                                </motion.div>
                            )}

                            <p className="mb-6 rounded-lg border border-sky-400/15 bg-sky-400/5 px-4 py-3 text-xs leading-5 text-sky-100/80">
                                Draft text stays in this browser tab for up to two hours. The attachment and tracking credentials are never saved.
                            </p>
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div>
                                    <label htmlFor="title" className="block text-sm font-semibold text-slate-200 mb-2">Project Title</label>
                                    <input
                                        id="title"
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Annual Student Leadership Seminar"
                                        className="w-full px-5 py-4 rounded-xl border border-white/10 bg-black/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all font-medium"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="projectType" className="block text-sm font-semibold text-slate-200 mb-2">Project Type</label>
                                    <div className="relative">
                                        <select
                                            id="projectType"
                                            value={projectType}
                                            onChange={(e) => setProjectType(e.target.value)}
                                            className="w-full px-5 py-4 rounded-xl border border-white/10 bg-black/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all font-medium appearance-none"
                                            required
                                        >
                                            <option value="" disabled className="bg-slate-800">Select Project Type...</option>
                                            <option value="Academic" className="bg-slate-800">Academic</option>
                                            <option value="Non-Academic" className="bg-slate-800">Non-Academic</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-200 mb-3">Project Category (UN SDGs)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-4 rounded-xl border border-white/10 bg-black/20 classic-scrollbar">
                                        {UN_SDGS.map(sdg => (
                                            <label key={sdg} className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                                                    <input
                                                        type="checkbox" 
                                                        className="peer appearance-none w-5 h-5 border-2 border-white/20 rounded bg-white/5 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                                                        checked={categories.includes(sdg)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setCategories(prev => [...prev, sdg]);
                                                            } else {    
                                                                setCategories(prev => prev.filter(c => c !== sdg));
                                                            }
                                                        }}
                                                    />
                                                    <CheckCircle size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                                </div>
                                                <span className="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug pt-0.5">      
                                                    {sdg}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    {categories.length === 0 && (       
                                        <p className="text-xs text-amber-400/80 mt-3 font-medium flex items-center gap-1.5">
                                            <AlertCircle size={12}/> Select at least one Sustainable Development Goal.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="description" className="block text-sm font-semibold text-slate-200 mb-2">Executive Summary</label>
                                    <textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Provide a brief, comprehensive summary of the project goals, target audience, and expected impact..."
                                        rows={5}
                                        className="w-full px-5 py-4 rounded-xl border border-white/10 bg-black/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all font-medium resize-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-200 mb-2">Upload Proposal Document (PDF)</label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                                            file ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                                        }`}
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="application/pdf"
                                            className="hidden"
                                        />
                                        <div className="flex flex-col items-center gap-3">
                                            {file ? (
                                                <>
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-blue-300">{file.name}</p>
                                                        <p className="text-xs text-blue-400/60 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFile(null);
                                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                                        }}
                                                        className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors mt-2"
                                                    >
                                                        Remove File
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-full bg-white/5 text-slate-400 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                                        <UploadCloud size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-200">Click to select or drag and drop</p>
                                                        <p className="text-xs text-slate-500 mt-1">PDF format only. Maximum 10MB.</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full py-4 px-6 rounded-xl font-semibold text-white flex justify-center items-center gap-3 shadow-lg shadow-blue-500/20 transition-all ${
                                            isSubmitting 
                                                ? 'bg-blue-600/50 cursor-not-allowed border border-blue-500/20' 
                                                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 border border-blue-400/20 transform hover:-translate-y-0.5'
                                        }`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Submitting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                <span>Submit Official Proposal</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>

                    {/* Sidebar Information */}
                    <div className="lg:col-span-1 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35, delay: 0.1 }}
                            className="services-process-rail p-6 md:p-8"
                        >
                            <h3 className={`text-xl font-semibold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4`}>
                                <Users size={20} className="text-blue-400" /> Guidance
                            </h3>
                            <div className="space-y-6 text-sm text-slate-300 relative">
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex flex-shrink-0 items-center justify-center text-blue-400 font-bold">1</div>
                                    <div>
                                        <p className="font-semibold text-white mb-1">Verify Alignment</p>
                                        <p className="text-slate-400 leading-relaxed">Ensure the proposal aligns directly with one or more UN Sustainable Development Goals as per university mandate.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex flex-shrink-0 items-center justify-center text-blue-400 font-bold">2</div>
                                    <div>
                                        <p className="font-semibold text-white mb-1">Clear Executives</p>
                                        <p className="text-slate-400 leading-relaxed">Executive Summaries must be concise. Committees review this first before opening the attached document.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex flex-shrink-0 items-center justify-center text-blue-400 font-bold">3</div>
                                    <div>
                                        <p className="font-semibold text-white mb-1">PDF Integrity</p>
                                        <p className="text-slate-400 leading-relaxed">Documents must be properly formatted as PDFs with official council letterheads and signatures embedded where necessary.</p>
                                    </div>
                                </div>
                                <div className="absolute top-2 bottom-6 left-4 w-px bg-gradient-to-b from-blue-500/20 via-blue-500/10 to-transparent -z-10" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35, delay: 0.2 }}
                            className="services-security-callout p-6 md:p-8 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Target size={100} />
                            </div>
                            <h3 className={`text-xl font-semibold text-amber-400 mb-3 flex items-center gap-2 relative z-10`}>
                                Security Notice
                            </h3>
                            <p className="text-sm text-amber-200/80 leading-relaxed relative z-10">
                                All program proposals are logged and digitally stamped with submitting user credentials. Submissions undergo a rigorous review before proceeding to the Officer&apos;s Deck.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Same injected styles as earlier but with adjusted background gradient for this specific page */}
            <NoncedStyle css={getStyles()} />
        </div>
    );
}

function getStyles() {
    return `
        /* Custom scrollbar for SDGs list */
        .classic-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .classic-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
        }
        .classic-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
        }
        .classic-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .services-shell {
            background: linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%);
            background-image:
                radial-gradient(130% 120% at 8% 12%, rgba(232, 207, 146, 0.18) 0%, rgba(232, 207, 146, 0) 52%),
                radial-gradient(140% 120% at 92% 8%, rgba(87, 131, 186, 0.28) 0%, rgba(87, 131, 186, 0) 58%),
                linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%);
            color: #e2e8f0;
            min-height: 100vh;
        }

        .services-shell::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top, rgba(255,255,255,0.02) 0%, transparent 100%);
            pointer-events: none;
            z-index: 1;
        }

        .services-noise {
            position: absolute;
            inset: 0;
            background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 32px 32px;
            opacity: 0.2;
            mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
            pointer-events: none;
            z-index: 2;
        }

        .services-eyebrow {
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.2);
            color: #fbd38d;
            font-size: 0.8rem;
            font-weight: 600;
            backdrop-filter: blur(8px);
        }

        .services-display {
                    font-size: clamp(2.2rem, 5vw, 4.2rem);
                    line-height: 1.1;
                    color: #ffffff;
                    max-width: 20ch;
                    text-wrap: pretty;
                    font-weight: 700;
                }

        .services-display-accent {
            color: transparent;
            background: linear-gradient(135deg, #fbd38d 0%, #d97706 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .services-card {
            position: relative;
            border-radius: 1.5rem;
            background: linear-gradient(145deg, rgba(20, 35, 60, 0.3), rgba(10, 20, 36, 0.5));
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease, border-color 0.4s ease;
            overflow: hidden;
        }

        .services-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.06), transparent 40%);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.5s ease;
        }

        .services-card:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .services-command-deck {
            position: relative;
            border-radius: 1.5rem;
            border: 1px solid rgba(125, 211, 252, 0.28);
            background:
                radial-gradient(120% 130% at 0% 0%, rgba(125, 211, 252, 0.15) 0%, transparent 55%),
                linear-gradient(150deg, rgba(9, 20, 36, 0.82), rgba(13, 30, 52, 0.72));
            box-shadow: 0 20px 40px -30px rgba(8, 47, 73, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }

        .services-process-rail {
            position: relative;
            border-radius: 1.25rem;
            border: 1px solid rgba(147, 197, 253, 0.24);
            background:
                linear-gradient(180deg, rgba(10, 21, 37, 0.84), rgba(12, 25, 43, 0.8));
            box-shadow: 0 16px 36px -30px rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .services-security-callout {
            border-radius: 1.25rem;
            border: 1px solid rgba(251, 191, 36, 0.35);
            background:
                radial-gradient(120% 140% at 100% 0%, rgba(251, 191, 36, 0.16) 0%, transparent 50%),
                linear-gradient(145deg, rgba(55, 30, 8, 0.6), rgba(18, 20, 32, 0.78));
            box-shadow: 0 18px 40px -30px rgba(146, 64, 14, 0.8);
        }
    `;
}

