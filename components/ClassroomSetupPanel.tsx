'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { AlertCircle, BookPlus, CheckCircle, ExternalLink, FilePlus, Loader2 } from 'lucide-react';
import { deriveEffectivePortalRole, hasOfficerPrivilege, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { formatClassroomDueDateTime } from '@/lib/date-time';

interface ClassroomCourse {
    id: string;
    name: string;
    section?: string;
    courseState?: string;
    alternateLink?: string;
}

interface ClassroomSetupStatus {
    success: boolean;
    message: string;
    requestId?: string;
    alternateLink?: string;
}

interface ClassroomCourseWork {
    id: string;
    title: string;
    state?: string;
    alternateLink?: string;
    dueDate?: {
        year?: number;
        month?: number;
        day?: number;
    };
    dueTime?: {
        hours?: number;
        minutes?: number;
        seconds?: number;
        nanos?: number;
    };
}

const apiFetcher = async (url: string) => {
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
        const message = typeof json?.error === 'string' ? json.error : 'Request failed';
        throw new Error(message);
    }

    return json;
};

function readPortalModeCookie() {
    if (typeof document === 'undefined') return '';

    const cookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${PORTAL_MODE_COOKIE}=`));

    return cookie ? decodeURIComponent(cookie.slice(PORTAL_MODE_COOKIE.length + 1)) : '';
}

export default function ClassroomSetupPanel() {
    const { data: session, status } = useSession();
    const { mutate } = useSWRConfig();
    const [portalMode, setPortalMode] = useState('');
    const [courseName, setCourseName] = useState('');
    const [courseSection, setCourseSection] = useState('');
    const [courseRoom, setCourseRoom] = useState('');
    const [courseHeading, setCourseHeading] = useState('');
    const [courseDescription, setCourseDescription] = useState('');
    const [courseWorkCourseId, setCourseWorkCourseId] = useState('');
    const [courseWorkTitle, setCourseWorkTitle] = useState('');
    const [courseWorkDescription, setCourseWorkDescription] = useState('');
    const [courseWorkMaxPoints, setCourseWorkMaxPoints] = useState('');
    const [courseWorkDueDate, setCourseWorkDueDate] = useState('');
    const [courseWorkDueTime, setCourseWorkDueTime] = useState('');
    const [creatingCourse, setCreatingCourse] = useState(false);
    const [creatingCourseWork, setCreatingCourseWork] = useState(false);
    const [setupStatus, setSetupStatus] = useState<ClassroomSetupStatus | null>(null);

    useEffect(() => {
        setPortalMode(readPortalModeCookie());
    }, [status]);

    const isAuthenticated = status === 'authenticated' && Boolean(session?.user?.email);
    const effectiveRole = deriveEffectivePortalRole(session?.user?.role, portalMode);
    const isOfficer = hasOfficerPrivilege(effectiveRole);

    const { data: coursesResponse, error: coursesError, isLoading: coursesLoading } = useSWR(
        isAuthenticated && isOfficer ? '/api/classroom/courses' : null,
        apiFetcher,
        { revalidateOnFocus: false }
    );

    const { data: courseworkResponse, error: courseworkError, isLoading: courseworkLoading, mutate: mutateCoursework } = useSWR(
        isAuthenticated && isOfficer && courseWorkCourseId
            ? `/api/classroom/courses/${encodeURIComponent(courseWorkCourseId)}/coursework`
            : null,
        apiFetcher,
        { revalidateOnFocus: false }
    );

    const courses: ClassroomCourse[] = useMemo(() => coursesResponse?.data || [], [coursesResponse?.data]);
    const courseworkItems: ClassroomCourseWork[] = useMemo(() => courseworkResponse?.data || [], [courseworkResponse?.data]);
    const draftCourseworkItems = useMemo(
        () => courseworkItems.filter((item) => String(item.state || '').toUpperCase() === 'DRAFT'),
        [courseworkItems]
    );
    const courseCreationBlocked = courseName.trim().length < 3;
    const courseWorkCreationBlocked = !courseWorkCourseId || courseWorkTitle.trim().length < 3;

    const handleCourseCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isOfficer) {
            setSetupStatus({ success: false, message: 'Officer access is required to create Classroom structures.' });
            return;
        }

        if (courseCreationBlocked) {
            setSetupStatus({ success: false, message: 'Add a course name before creating a Classroom class.' });
            return;
        }

        setCreatingCourse(true);
        setSetupStatus(null);

        try {
            const res = await fetch('/api/classroom/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: courseName.trim(),
                    section: courseSection.trim() || undefined,
                    room: courseRoom.trim() || undefined,
                    descriptionHeading: courseHeading.trim() || undefined,
                    description: courseDescription.trim() || undefined,
                }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSetupStatus({
                    success: false,
                    message: json?.error || 'Failed to create Classroom class.',
                    requestId: json?.requestId,
                });
                return;
            }

            const createdCourse = json?.data as ClassroomCourse | undefined;
            if (createdCourse?.id) {
                setCourseWorkCourseId(createdCourse.id);
            }

            setSetupStatus({
                success: true,
                message: 'Classroom class created. It is now available for portal-managed coursework.',
                requestId: json?.requestId,
                alternateLink: createdCourse?.alternateLink,
            });
            setCourseName('');
            setCourseSection('');
            setCourseRoom('');
            setCourseHeading('');
            setCourseDescription('');
            await mutate('/api/classroom/courses');
        } catch {
            setSetupStatus({ success: false, message: 'Network error while creating the Classroom class.' });
        } finally {
            setCreatingCourse(false);
        }
    };

    const handleCourseWorkCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!isOfficer) {
            setSetupStatus({ success: false, message: 'Officer access is required to create Classroom coursework.' });
            return;
        }

        if (courseWorkCreationBlocked) {
            setSetupStatus({ success: false, message: 'Select a class and add a coursework title before creating the draft assignment.' });
            return;
        }

        setCreatingCourseWork(true);
        setSetupStatus(null);

        try {
            const res = await fetch(`/api/classroom/courses/${encodeURIComponent(courseWorkCourseId)}/coursework`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: courseWorkTitle.trim(),
                    description: courseWorkDescription.trim() || undefined,
                    maxPoints: courseWorkMaxPoints.trim() || undefined,
                    dueDate: courseWorkDueDate || undefined,
                    dueTime: courseWorkDueTime || undefined,
                    state: 'DRAFT',
                }),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSetupStatus({
                    success: false,
                    message: json?.error || 'Failed to create Classroom coursework.',
                    requestId: json?.requestId,
                });
                return;
            }

            setSetupStatus({
                success: true,
                message: 'Draft coursework created through the portal. Leaders can submit once you publish or assign it in Classroom.',
                requestId: json?.requestId,
                alternateLink: json?.data?.alternateLink,
            });
            setCourseWorkTitle('');
            setCourseWorkDescription('');
            setCourseWorkMaxPoints('');
            setCourseWorkDueDate('');
            setCourseWorkDueTime('');
            await mutate(`/api/classroom/courses/${encodeURIComponent(courseWorkCourseId)}/coursework`);
        } catch {
            setSetupStatus({ success: false, message: 'Network error while creating Classroom coursework.' });
        } finally {
            setCreatingCourseWork(false);
        }
    };

    const handlePublishCoursework = async (courseWorkId: string) => {
        if (!courseWorkCourseId) {
            return;
        }

        setSetupStatus(null);

        try {
            const res = await fetch(
                `/api/classroom/courses/${encodeURIComponent(courseWorkCourseId)}/coursework/${encodeURIComponent(courseWorkId)}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: 'PUBLISHED' }),
                }
            );

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSetupStatus({
                    success: false,
                    message: json?.error || 'Failed to publish draft coursework.',
                    requestId: json?.requestId,
                });
                return;
            }

            setSetupStatus({
                success: true,
                message: 'Draft coursework published in Google Classroom.',
                requestId: json?.requestId,
                alternateLink: json?.data?.alternateLink,
            });
            await mutateCoursework();
        } catch {
            setSetupStatus({ success: false, message: 'Network error while publishing draft coursework.' });
        }
    };

    if (!isAuthenticated) {
        return (
            <section className="portal-panel transparency-setup-panel transparency-classroom-surface p-6 md:p-8">
                <div className="transparency-setup-linework" aria-hidden="true" />
                <p className="portal-kicker">Classroom Setup</p>
                <h3 className="mt-3 text-xl font-semibold text-white">Officer setup required</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                    Sign in with Officer Access to create portal-managed Classroom classes and draft assignments.
                </p>
                <Link href={`/login?callbackUrl=${encodeURIComponent('/transparency')}`} className="btn-primary mt-5 inline-flex">
                    Continue to Login
                </Link>
            </section>
        );
    }

    if (!isOfficer) {
        return null;
    }

    return (
        <section className="portal-panel transparency-setup-panel transparency-classroom-surface p-6 md:p-8">
            <div className="transparency-setup-linework" aria-hidden="true" />
            <div className="relative z-10">
                <div className="transparency-setup-header">
                    <div>
                        <p className="portal-kicker">Classroom Setup</p>
                        <h3 className="mt-3 text-xl font-semibold text-white">Create portal-managed classes and draft assignments</h3>
                    </div>
                    <p className="max-w-lg text-sm leading-7 text-slate-300">
                        Classes and assignments created here are associated with this portal project, which keeps leader submissions compatible with Google Classroom.
                    </p>
                </div>

                <div className="transparency-setup-forms">
                    <form onSubmit={handleCourseCreate} className="transparency-setup-block">
                        <div className="flex items-center gap-3">
                            <BookPlus className="h-5 w-5 text-sky-300" aria-hidden="true" />
                            <h4 className="text-base font-semibold text-white">Create class</h4>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Class name</span>
                                <input
                                    value={courseName}
                                    onChange={(event) => setCourseName(event.target.value)}
                                    disabled={creatingCourse}
                                    maxLength={120}
                                    className="field-input text-sm"
                                    placeholder="OSR Transparency Reports"
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Section</span>
                                <input
                                    value={courseSection}
                                    onChange={(event) => setCourseSection(event.target.value)}
                                    disabled={creatingCourse}
                                    maxLength={120}
                                    className="field-input text-sm"
                                    placeholder="Minutes of Meetings"
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Room</span>
                                <input
                                    value={courseRoom}
                                    onChange={(event) => setCourseRoom(event.target.value)}
                                    disabled={creatingCourse}
                                    maxLength={120}
                                    className="field-input text-sm"
                                    placeholder="Online"
                                />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Heading</span>
                                <input
                                    value={courseHeading}
                                    onChange={(event) => setCourseHeading(event.target.value)}
                                    disabled={creatingCourse}
                                    maxLength={200}
                                    className="field-input text-sm"
                                    placeholder="Official student-government reporting"
                                />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Description</span>
                                <textarea
                                    value={courseDescription}
                                    onChange={(event) => setCourseDescription(event.target.value)}
                                    disabled={creatingCourse}
                                    maxLength={3000}
                                    rows={3}
                                    className="field-input text-sm"
                                    placeholder="Use this class for recognized offices and councils to submit transparency materials."
                                />
                            </label>
                        </div>

                        <button type="submit" disabled={creatingCourse || courseCreationBlocked} className="btn-primary mt-5 gap-2">
                            {creatingCourse ? <Loader2 size={17} className="animate-spin" /> : <BookPlus size={17} />}
                            {creatingCourse ? 'Creating class...' : 'Create Classroom class'}
                        </button>
                    </form>

                    <form onSubmit={handleCourseWorkCreate} className="transparency-setup-block">
                        <div className="flex items-center gap-3">
                            <FilePlus className="h-5 w-5 text-amber-200" aria-hidden="true" />
                            <h4 className="text-base font-semibold text-white">Create draft coursework</h4>
                        </div>

                        {coursesError && (
                            <p className="mt-4 text-sm leading-6 text-rose-200">
                                Failed to load officer classes: {coursesError.message}
                            </p>
                        )}

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Class</span>
                                <select
                                    value={courseWorkCourseId}
                                    onChange={(event) => setCourseWorkCourseId(event.target.value)}
                                    disabled={coursesLoading || creatingCourseWork}
                                    className="field-input text-sm"
                                >
                                    <option value="">{coursesLoading ? 'Loading classes...' : 'Select a class'}</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name}{course.section ? ` - ${course.section}` : ''}{course.courseState === 'PROVISIONED' ? ' - provisioned' : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Coursework title</span>
                                <input
                                    value={courseWorkTitle}
                                    onChange={(event) => setCourseWorkTitle(event.target.value)}
                                    disabled={creatingCourseWork}
                                    maxLength={180}
                                    className="field-input text-sm"
                                    placeholder="Minutes of Meeting Submission"
                                />
                            </label>
                            <label className="sm:col-span-2">
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Instructions</span>
                                <textarea
                                    value={courseWorkDescription}
                                    onChange={(event) => setCourseWorkDescription(event.target.value)}
                                    disabled={creatingCourseWork}
                                    maxLength={30000}
                                    rows={3}
                                    className="field-input text-sm"
                                    placeholder="Attach the official Google Docs link and mark as turned in after review."
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Max points</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    value={courseWorkMaxPoints}
                                    onChange={(event) => setCourseWorkMaxPoints(event.target.value)}
                                    disabled={creatingCourseWork}
                                    className="field-input text-sm"
                                    placeholder="100"
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Due date</span>
                                <input
                                    type="date"
                                    value={courseWorkDueDate}
                                    onChange={(event) => {
                                        setCourseWorkDueDate(event.target.value);
                                        if (!event.target.value) setCourseWorkDueTime('');
                                    }}
                                    disabled={creatingCourseWork}
                                    className="field-input text-sm"
                                />
                            </label>
                            <label>
                                <span className="mb-1.5 block text-sm font-medium text-slate-200">Due time</span>
                                <input
                                    type="time"
                                    value={courseWorkDueTime}
                                    onChange={(event) => setCourseWorkDueTime(event.target.value)}
                                    disabled={creatingCourseWork || !courseWorkDueDate}
                                    className="field-input text-sm"
                                />
                            </label>
                        </div>

                        <p className="mt-4 text-xs leading-6 text-slate-400">
                            Draft-first, class-wide assignment. Publish or adjust recipients in Google Classroom after review.
                        </p>

                        <button type="submit" disabled={creatingCourseWork || courseWorkCreationBlocked} className="btn-primary mt-5 gap-2">
                            {creatingCourseWork ? <Loader2 size={17} className="animate-spin" /> : <FilePlus size={17} />}
                            {creatingCourseWork ? 'Creating draft...' : 'Create draft coursework'}
                        </button>
                    </form>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                            <p className="portal-kicker">Officer Drafts</p>
                            <h4 className="mt-2 text-base font-semibold text-white">View and publish draft coursework</h4>
                        </div>
                        <p className="text-xs leading-6 text-slate-300">Select a class above to load its draft queue.</p>
                    </div>

                    {!courseWorkCourseId ? (
                        <p className="mt-4 text-sm leading-6 text-slate-400">Choose a class to see its draft coursework.</p>
                    ) : courseworkLoading ? (
                        <p className="mt-4 text-sm leading-6 text-slate-400">Loading coursework drafts...</p>
                    ) : courseworkError ? (
                        <p className="mt-4 text-sm leading-6 text-rose-200">Failed to load coursework: {courseworkError.message}</p>
                    ) : draftCourseworkItems.length === 0 ? (
                        <p className="mt-4 text-sm leading-6 text-slate-400">No draft coursework exists for the selected class yet.</p>
                    ) : (
                        <div className="mt-4 grid gap-3">
                            {draftCourseworkItems.map((item) => (
                                <article key={item.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            <p className="mt-1 text-xs leading-6 text-slate-400">
                                                Due: {formatClassroomDueDateTime(item.dueDate, item.dueTime)}
                                            </p>
                                        </div>
                                        <span className="transparency-status-chip">Draft</span>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {item.alternateLink && (
                                            <a
                                                href={item.alternateLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary inline-flex items-center gap-2"
                                            >
                                                Open in Classroom <ExternalLink size={14} />
                                            </a>
                                        )}
                                        <button type="button" onClick={() => handlePublishCoursework(item.id)} className="btn-primary gap-2">
                                            Publish draft
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                {setupStatus && (
                    <div className={`transparency-setup-status ${setupStatus.success ? 'is-success' : 'is-error'}`}>
                        {setupStatus.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <div>
                            <p>{setupStatus.message}</p>
                            {setupStatus.requestId && <p className="mt-1 text-xs opacity-80">Ref: {setupStatus.requestId}</p>}
                            {setupStatus.alternateLink && (
                                <a href={setupStatus.alternateLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 underline">
                                    Open in Classroom <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
