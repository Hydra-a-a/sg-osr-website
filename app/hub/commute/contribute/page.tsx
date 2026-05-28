'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MapPinned, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { NoncedStyle } from '@/components/CspNonceProvider';

type StepType = 'WALK' | 'JEEP' | 'BUS' | 'MRT' | 'LRT' | 'TRICYCLE' | 'UV';

type StepDraft = {
    type: StepType;
    instruction: string;
};

const STEP_TYPES: StepType[] = ['WALK', 'JEEP', 'BUS', 'MRT', 'LRT', 'TRICYCLE', 'UV'];

const INITIAL_STEP: StepDraft = { type: 'WALK', instruction: '' };

export default function CommuteContributePage() {
    const { data: session } = useSession();
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [steps, setSteps] = useState<StepDraft[]>([{ ...INITIAL_STEP }]);
    const [fareEstimateRange, setFareEstimateRange] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('');
    const [notes, setNotes] = useState('');
    const [contributorName, setContributorName] = useState(session?.user?.name || '');
    const [contributorStudentId, setContributorStudentId] = useState('');
    const [contributorDisplayMode, setContributorDisplayMode] = useState<'nickname' | 'real_name' | 'masked'>('nickname');
    const [contributorPublicLabel, setContributorPublicLabel] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successLabel, setSuccessLabel] = useState('');

    const canAddStep = steps.length < 4;
    const showPublicLabelInput = contributorDisplayMode !== 'real_name';

    const previewLabel = useMemo(() => {
        if (contributorDisplayMode === 'real_name') {
            return contributorName.trim() || 'Your real name';
        }
        if (contributorDisplayMode === 'nickname') {
            return contributorPublicLabel.trim() || 'your-nickname';
        }
        const compact = contributorStudentId.replace(/\s+/g, '');
        return compact.length >= 4 ? `student-${compact.slice(-4)}` : 'verified-student';
    }, [contributorDisplayMode, contributorName, contributorPublicLabel, contributorStudentId]);

    const sanitizedSteps = useMemo(
        () => steps.map((step) => step.instruction.trim()).filter(Boolean),
        [steps],
    );

    const repeatedStep = useMemo(() => {
        const seen = new Set<string>();
        return sanitizedSteps.find((instruction) => {
            const key = instruction.toLowerCase();
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
        }) || '';
    }, [sanitizedSteps]);

    const inlineValidation = useMemo(() => {
        const issues: string[] = [];
        if (!origin.trim()) issues.push('Add an origin.');
        if (!destination.trim()) issues.push('Add a destination.');
        if (sanitizedSteps.length === 0) issues.push('Add at least one route step.');
        if (steps.some((step) => step.instruction.trim().length > 0 && step.instruction.trim().length < 6)) issues.push('Each step should be specific enough to follow.');
        if (repeatedStep) issues.push('Remove repeated route steps so officers get a clean submission.');
        if (durationMinutes && (!Number.isFinite(Number(durationMinutes)) || Number(durationMinutes) <= 0)) issues.push('Duration must be a positive number.');
        if (fareEstimateRange && !/^\d+(?:-\d+)?$/.test(fareEstimateRange.trim())) issues.push('Fare range should look like 46 or 46-76.');
        if (!contributorName.trim()) issues.push('Add your name for officer verification.');
        if (!contributorStudentId.trim()) issues.push('Add your student ID for officer verification.');
        if (contributorDisplayMode === 'nickname' && !contributorPublicLabel.trim()) issues.push('Add a nickname for public credit.');
        return issues;
    }, [contributorDisplayMode, contributorName, contributorPublicLabel, contributorStudentId, destination, durationMinutes, fareEstimateRange, origin, repeatedStep, sanitizedSteps.length, steps]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccessLabel('');

        try {
            const payload = {
                origin,
                destination,
                steps,
                fareEstimateRange,
                durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
                notes,
                contributorName,
                contributorStudentId,
                contributorDisplayMode,
                contributorPublicLabel,
            };

            const response = await fetch('/api/hub/commute/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error?.message || 'Unable to submit route right now.');
            }

            setSuccessLabel(data.publicLabel || previewLabel);
            setOrigin('');
            setDestination('');
            setSteps([{ ...INITIAL_STEP }]);
            setFareEstimateRange('');
            setDurationMinutes('');
            setNotes('');
            setContributorStudentId('');
            setContributorPublicLabel('');
        } catch (submitError: any) {
            setError(submitError?.message || 'Unable to submit route right now.');
        } finally {
            setSubmitting(false);
        }
    }

    function updateStep(index: number, next: Partial<StepDraft>) {
        setSteps((current) => current.map((step, currentIndex) => (
            currentIndex === index ? { ...step, ...next } : step
        )));
    }

    function addStep() {
        if (!canAddStep) return;
        setSteps((current) => [...current, { ...INITIAL_STEP }]);
    }

    function removeStep(index: number) {
        setSteps((current) => current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index));
    }

    return (
        <div className="commute-contribute-shell min-h-screen">
            <section className="max-w-4xl mx-auto px-4 py-10 md:py-14">
                <Link href="/hub/commute" className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors">
                    <ArrowLeft size={16} /> Back to Commuter Maps
                </Link>

                <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                    <div>
                        <span className="commute-kicker">Local Guides</span>
                        <h1 className="mt-4 text-4xl font-bold text-white leading-tight">Contribute a route</h1>
                        <p className="mt-4 text-slate-200 leading-relaxed max-w-2xl">
                            Share the exact commute flow you trust. Officers will review every submission before it becomes public, and approved routes earn guide credit on the board.
                        </p>

                        <div className="commute-side-panel mt-8">
                            <div className="commute-side-icon">
                                <MapPinned size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">Public credit preview</p>
                                <p className="mt-1 text-sm text-slate-300">Your approved route would show as <span className="text-amber-200 font-semibold">Mapped by @{previewLabel}</span>.</p>
                            </div>
                        </div>

                        {successLabel ? (
                            <div className="commute-success mt-6">
                                <div className="flex items-center gap-2 text-emerald-100 font-semibold">
                                    <Sparkles size={16} />
                                    Route submitted
                                </div>
                                <p className="mt-2 text-sm text-emerald-50/90">
                                    Thanks. Officers can now review it, tidy the aliases if needed, and publish it once approved. Your public guide label is set to @{successLabel}, and the route stays in review until an officer checks it.
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <form onSubmit={handleSubmit} className="commute-form-panel">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="commute-field">
                                <span>Origin</span>
                                <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="e.g. PITX" />
                            </label>
                            <label className="commute-field">
                                <span>Destination</span>
                                <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="e.g. RTU Boni" />
                            </label>
                        </div>

                        <div className="mt-5">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-white">Route steps</p>
                                <button type="button" onClick={addStep} disabled={!canAddStep} className="commute-mini-action">
                                    <Plus size={14} /> Add Step
                                </button>
                            </div>

                            <div className="mt-3 space-y-3">
                                {steps.map((step, index) => (
                                    <div key={`step-${index}`} className="commute-step-card">
                                        <div className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
                                            <label className="commute-field">
                                                <span>Mode</span>
                                                <select value={step.type} onChange={(event) => updateStep(index, { type: event.target.value as StepType })}>
                                                    {STEP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
                                                </select>
                                            </label>
                                            <label className="commute-field">
                                                <span>Instruction</span>
                                                <input value={step.instruction} onChange={(event) => updateStep(index, { instruction: event.target.value })} placeholder="Describe exactly where to walk, ride, or transfer." />
                                            </label>
                                            <button type="button" onClick={() => removeStep(index)} className="commute-icon-action" aria-label={`Remove step ${index + 1}`}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="commute-field">
                                <span>Fare range</span>
                                <input value={fareEstimateRange} onChange={(event) => setFareEstimateRange(event.target.value)} placeholder="e.g. 46-76" />
                            </label>
                            <label className="commute-field">
                                <span>Duration in minutes</span>
                                <input type="number" min="1" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="e.g. 60" />
                            </label>
                        </div>

                        <label className="commute-field mt-4">
                            <span>Notes</span>
                            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Curfews, transfer warnings, or late-night caveats." />
                        </label>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="commute-field">
                                <span>Your name</span>
                                <input value={contributorName} onChange={(event) => setContributorName(event.target.value)} placeholder="Your real name" />
                            </label>
                            <label className="commute-field">
                                <span>Student ID</span>
                                <input value={contributorStudentId} onChange={(event) => setContributorStudentId(event.target.value)} placeholder="Used for verification and points" />
                            </label>
                        </div>

                        <div className="mt-5">
                            <p className="text-sm font-semibold text-white">Public credit mode</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                                {[
                                    { key: 'nickname', label: 'Nickname' },
                                    { key: 'real_name', label: 'Real name' },
                                    { key: 'masked', label: 'Masked' },
                                ].map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setContributorDisplayMode(option.key as 'nickname' | 'real_name' | 'masked')}
                                        className={`commute-mode-card ${contributorDisplayMode === option.key ? 'commute-mode-card-active' : ''}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {showPublicLabelInput ? (
                            <label className="commute-field mt-4">
                                <span>{contributorDisplayMode === 'nickname' ? 'Nickname' : 'Optional public label'}</span>
                                <input
                                    value={contributorPublicLabel}
                                    onChange={(event) => setContributorPublicLabel(event.target.value)}
                                    placeholder={contributorDisplayMode === 'nickname' ? 'e.g. jeepwizard' : 'Optional masked label'}
                                />
                            </label>
                        ) : null}

                        <div className="commute-review-summary mt-5">
                            <p className="text-sm font-semibold text-white">Review before submit</p>
                            <p className="mt-2 text-sm text-slate-300">
                                Sanity-check your route: <span className="text-white">{origin || 'Origin'}</span> to <span className="text-white">{destination || 'Destination'}</span>,
                                {` `}{sanitizedSteps.length} step{sanitizedSteps.length === 1 ? '' : 's'}, fare <span className="text-white">{fareEstimateRange || 'not set'}</span>,
                                duration <span className="text-white">{durationMinutes || 'not set'}</span>.
                            </p>
                            {inlineValidation.length > 0 ? (
                                <ul className="mt-3 space-y-1 text-sm text-amber-200">
                                    {inlineValidation.map((issue) => (
                                        <li key={issue}>• {issue}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-3 text-sm text-emerald-200">Looks ready for officer review.</p>
                            )}
                        </div>

                        {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}

                        <button type="submit" disabled={submitting || inlineValidation.length > 0} className="commute-submit mt-6">
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            {submitting ? 'Submitting route...' : 'Submit for review'}
                        </button>
                    </form>
                </div>
            </section>

            <NoncedStyle css={`
                .commute-contribute-shell {
                    background:
                        radial-gradient(90% 110% at 8% 10%, rgba(244, 192, 82, 0.16) 0%, rgba(244, 192, 82, 0) 48%),
                        radial-gradient(110% 120% at 92% 12%, rgba(94, 184, 255, 0.16) 0%, rgba(94, 184, 255, 0) 52%),
                        linear-gradient(135deg, #102845 0%, #1c436c 45%, #245f82 100%);
                    color: #e2e8f0;
                }
                .commute-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.45rem 0.9rem;
                    border-radius: 999px;
                    border: 1px solid rgba(244, 192, 82, 0.25);
                    background: rgba(244, 192, 82, 0.12);
                    color: #fde68a;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .commute-side-panel,
                .commute-form-panel {
                    border-radius: 1.5rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: linear-gradient(145deg, rgba(12, 22, 36, 0.42), rgba(11, 20, 34, 0.62));
                    box-shadow: 0 20px 50px rgba(4, 10, 22, 0.26);
                    backdrop-filter: blur(18px);
                }
                .commute-side-panel {
                    display: flex;
                    gap: 1rem;
                    padding: 1.15rem 1.25rem;
                }
                .commute-side-icon {
                    width: 2.5rem;
                    height: 2.5rem;
                    display: grid;
                    place-items: center;
                    border-radius: 0.95rem;
                    background: rgba(244, 192, 82, 0.14);
                    color: #facc15;
                    border: 1px solid rgba(244, 192, 82, 0.2);
                    flex-shrink: 0;
                }
                .commute-success {
                    border-radius: 1.25rem;
                    border: 1px solid rgba(16, 185, 129, 0.25);
                    background: rgba(16, 185, 129, 0.12);
                    padding: 1rem 1.1rem;
                }
                .commute-review-summary {
                    border-radius: 1.2rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(8, 15, 28, 0.38);
                    padding: 1rem 1.05rem;
                }
                .commute-form-panel {
                    padding: 1.4rem;
                }
                .commute-field {
                    display: block;
                }
                .commute-field span {
                    display: block;
                    margin-bottom: 0.45rem;
                    color: #cbd5e1;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .commute-field input,
                .commute-field select,
                .commute-field textarea {
                    width: 100%;
                    border-radius: 0.95rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(15, 23, 42, 0.55);
                    color: white;
                    padding: 0.85rem 0.95rem;
                    outline: none;
                }
                .commute-field textarea {
                    resize: vertical;
                    min-height: 7rem;
                }
                .commute-field input::placeholder,
                .commute-field textarea::placeholder {
                    color: #64748b;
                }
                .commute-step-card {
                    border-radius: 1.1rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    padding: 0.9rem;
                }
                .commute-mini-action,
                .commute-icon-action,
                .commute-submit,
                .commute-mode-card {
                    transition: all 0.2s ease;
                }
                .commute-mini-action {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.06);
                    color: white;
                    padding: 0.5rem 0.85rem;
                    font-size: 0.82rem;
                    font-weight: 600;
                }
                .commute-mini-action:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }
                .commute-icon-action {
                    align-self: end;
                    width: 2.9rem;
                    height: 2.9rem;
                    display: grid;
                    place-items: center;
                    border-radius: 0.95rem;
                    border: 1px solid rgba(248, 113, 113, 0.2);
                    background: rgba(239, 68, 68, 0.08);
                    color: #fecaca;
                }
                .commute-mode-card {
                    border-radius: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    color: white;
                    padding: 0.95rem 1rem;
                    font-weight: 600;
                }
                .commute-mode-card-active {
                    border-color: rgba(244, 192, 82, 0.35);
                    background: rgba(244, 192, 82, 0.16);
                    color: #fde68a;
                }
                .commute-submit {
                    width: 100%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.6rem;
                    border-radius: 1rem;
                    padding: 0.95rem 1.1rem;
                    font-weight: 700;
                    color: #0f172a;
                    background: #fbbf24;
                }
                .commute-submit:disabled {
                    opacity: 0.65;
                    cursor: not-allowed;
                }
            `} />
        </div>
    );
}
