'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { CheckCircle, AlertCircle, ExternalLink, GraduationCap, ClipboardCheck, Loader2 } from 'lucide-react';
import { deriveEffectivePortalRole, hasLeaderPrivilege, normalizePortalRole, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';

interface ClassroomCourse {
    id: string;
    name: string;
    section?: string;
    room?: string;
}

interface ClassroomCourseWork {
    id: string;
    title: string;
    description?: string;
    alternateLink?: string;
}

interface RecentClassroomSubmission {
    courseName: string;
    courseworkTitle: string;
    linkUrl: string;
    turnIn: boolean;
    submittedAtIso: string;
}

interface ClassroomSubmissionStatus {
    success: boolean;
    message: string;
    errorCode?: string;
    requestId?: string;
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

export default function ClassroomSubmissionForm() {
    const { data: session, status } = useSession();
    const [portalMode, setPortalMode] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedCourseWorkId, setSelectedCourseWorkId] = useState('');
    const [reportLink, setReportLink] = useState('');
    const [reportTitle, setReportTitle] = useState('');
    const [turnInImmediately, setTurnInImmediately] = useState(true);
    const [classroomSubmitting, setClassroomSubmitting] = useState(false);
    const [classroomResult, setClassroomResult] = useState<ClassroomSubmissionStatus | null>(null);
    const [recentClassroomSubmission, setRecentClassroomSubmission] = useState<RecentClassroomSubmission | null>(null);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const cookie = document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${PORTAL_MODE_COOKIE}=`));

        setPortalMode(cookie ? decodeURIComponent(cookie.slice(PORTAL_MODE_COOKIE.length + 1)) : '');
    }, [status]);

    const isAuthenticated = status === 'authenticated' && Boolean(session?.user?.email);
    const effectiveRole = deriveEffectivePortalRole(session?.user?.role, portalMode);
    const isLeader = hasLeaderPrivilege(effectiveRole);
    const isLeaderAccountInStudentMode = hasLeaderPrivilege(session?.user?.role) && !isLeader;

    const { data: coursesResponse, error: coursesError, isLoading: coursesLoading } = useSWR(
        isAuthenticated && isLeader ? '/api/classroom/courses' : null,
        apiFetcher,
        { revalidateOnFocus: false }
    );

    const courses: ClassroomCourse[] = coursesResponse?.data || [];

    const { data: courseworkResponse, error: courseworkError, isLoading: courseworkLoading } = useSWR(
        isAuthenticated && isLeader && selectedCourseId
            ? `/api/classroom/courses/${encodeURIComponent(selectedCourseId)}/coursework`
            : null,
        apiFetcher,
        { revalidateOnFocus: false }
    );

    const courseworkItems: ClassroomCourseWork[] = courseworkResponse?.data || [];

    const handleClassroomSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated || !isLeader) {
            setClassroomResult({ success: false, message: 'Only authenticated student leaders can submit through Google Classroom.' });
            return;
        }

        if (!selectedCourseId || !selectedCourseWorkId) {
            setClassroomResult({ success: false, message: 'Please select both a course and a coursework item.' });
            return;
        }

        let normalizedLink = reportLink.trim();
        if (!/^https:\/\//i.test(normalizedLink)) {
            setClassroomResult({ success: false, message: 'Report link must start with https://.' });
            return;
        }

        try {
            normalizedLink = new URL(normalizedLink).toString();
        } catch {
            setClassroomResult({ success: false, message: 'Please provide a valid report URL.' });
            return;
        }

        setClassroomSubmitting(true);
        setClassroomResult(null);

        try {
            const res = await fetch('/api/classroom/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    courseId: selectedCourseId,
                    courseWorkId: selectedCourseWorkId,
                    linkUrl: normalizedLink,
                    linkTitle: reportTitle.trim() || undefined,
                    turnIn: turnInImmediately,
                }),
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok) {
                if (json?.errorCode === 'DUPLICATE_SUBMISSION') {
                    setClassroomResult({
                        success: false,
                        message: 'Duplicate submission detected. Please wait a moment before retrying.',
                        errorCode: json?.errorCode,
                        requestId: json?.requestId,
                    });
                    return;
                }
                setClassroomResult({
                    success: false,
                    message: json?.error || 'Submission failed',
                    errorCode: json?.errorCode,
                    requestId: json?.requestId,
                });
                return;
            }

            setClassroomResult({
                success: true,
                message: turnInImmediately
                    ? 'Report submitted and marked as turned in successfully.'
                    : 'Report attached successfully. You can turn it in from Google Classroom when ready.',
                requestId: json?.requestId,
            });

            const selectedCourse = courses.find((course) => course.id === selectedCourseId);
            const selectedCoursework = courseworkItems.find((item) => item.id === selectedCourseWorkId);
            setRecentClassroomSubmission({
                courseName: selectedCourse?.name || selectedCourseId,
                courseworkTitle: selectedCoursework?.title || selectedCourseWorkId,
                linkUrl: normalizedLink,
                turnIn: turnInImmediately,
                submittedAtIso: new Date().toISOString(),
            });

            setReportLink('');
            setReportTitle('');
        } catch {
            setClassroomResult({ success: false, message: 'Network error while submitting to Google Classroom.' });
        } finally {
            setClassroomSubmitting(false);
        }
    };

    return (
        <div className="card p-8">
            <div className="flex items-center gap-3 mb-3">
                <GraduationCap size={22} className="text-rtu-blue" />
                <h3 className="text-xl font-bold text-strong">Google Classroom Report Submission</h3>
            </div>
            <p className="text-sm text-body mb-6">
                Student leaders can submit transparency reports and official correspondence directly to assigned Google Classroom coursework.
            </p>

            {!isAuthenticated ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-900">
                        People with <strong>Student Leader Access</strong> can log in with their <strong>@rtu.edu.ph</strong> account to access Classroom submission tools.
                    </p>
                    <Link
                        href={`/login?callbackUrl=${encodeURIComponent('/transparency')}`}
                        className="btn-primary w-full mt-3 inline-flex items-center justify-center gap-2 text-base"
                    >
                        Continue to Login
                    </Link>
                </div>
            ) : !isLeader ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    {isLeaderAccountInStudentMode
                        ? 'You are signed in as a Student Leader account in Student Access mode. Switch to Student Leader mode from your profile menu, or sign in with Student Leader Access, to open Classroom tools.'
                        : 'Classroom submission tools are available to authenticated student leaders.'}
                </div>
            ) : (
                <form onSubmit={handleClassroomSubmit} className="space-y-5">
                    {coursesError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                            {coursesError.message.includes('token')
                                ? 'Classroom access token missing. Please sign out and sign in again to grant Classroom permissions.'
                                : `Failed to load courses: ${coursesError.message}`}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-body">Classroom Course</label>
                        <select
                            value={selectedCourseId}
                            onChange={(e) => {
                                setSelectedCourseId(e.target.value);
                                setSelectedCourseWorkId('');
                                setClassroomResult(null);
                            }}
                            disabled={coursesLoading || classroomSubmitting || courses.length === 0}
                            className="field-input text-sm"
                        >
                            <option value="">{coursesLoading ? 'Loading courses...' : 'Select a course'}</option>
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.name}{course.section ? ` — ${course.section}` : ''}
                                </option>
                            ))}
                        </select>
                        {!coursesLoading && !coursesError && courses.length === 0 && (
                            <p className="text-xs text-subtle mt-2">
                                No active courses found for your account. Ensure you are enrolled in the expected Classroom.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-body">Coursework Item</label>
                        <select
                            value={selectedCourseWorkId}
                            onChange={(e) => {
                                setSelectedCourseWorkId(e.target.value);
                                setClassroomResult(null);
                            }}
                            disabled={!selectedCourseId || courseworkLoading || classroomSubmitting}
                            className="field-input text-sm"
                        >
                            <option value="">
                                {selectedCourseId
                                    ? (courseworkLoading ? 'Loading coursework...' : 'Select coursework')
                                    : 'Select a course first'}
                            </option>
                            {courseworkItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                        {courseworkError && (
                            <p className="text-xs text-red-600 mt-2">
                                Failed to load coursework: {courseworkError.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-body">Report / Correspondence Link</label>
                        <input
                            type="url"
                            required
                            placeholder="https://docs.google.com/document/d/..."
                            value={reportLink}
                            onChange={(e) => setReportLink(e.target.value)}
                            disabled={classroomSubmitting}
                            className="field-input text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-body">
                            Link Title <span className="text-subtle">(optional)</span>
                        </label>
                        <input
                            type="text"
                            maxLength={150}
                            placeholder="March Transparency Report"
                            value={reportTitle}
                            onChange={(e) => setReportTitle(e.target.value)}
                            disabled={classroomSubmitting}
                            className="field-input text-sm"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={turnInImmediately}
                            onChange={(e) => setTurnInImmediately(e.target.checked)}
                            disabled={classroomSubmitting}
                        />
                        Mark as <strong>Turned In</strong> immediately after attaching link
                    </label>

                    <AnimatePresence>
                        {classroomResult && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`p-4 rounded-xl flex items-start gap-3 text-sm ${classroomResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
                            >
                                {classroomResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                <div className="space-y-1">
                                    <p>{classroomResult.message}</p>
                                    {!classroomResult.success && (classroomResult.errorCode || classroomResult.requestId) && (
                                        <p className="text-xs opacity-80">
                                            {classroomResult.errorCode && <span>Code: {classroomResult.errorCode}</span>}
                                            {classroomResult.errorCode && classroomResult.requestId && <span> </span>}
                                            {classroomResult.requestId && <span>Ref: {classroomResult.requestId}</span>}
                                        </p>
                                    )}
                                    {classroomResult.success && classroomResult.requestId && (
                                        <p className="text-xs opacity-80">Ref: {classroomResult.requestId}</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {recentClassroomSubmission && (
                        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 space-y-1.5">
                            <p className="font-semibold">Most recent submission</p>
                            <p>Course: {recentClassroomSubmission.courseName}</p>
                            <p>Coursework: {recentClassroomSubmission.courseworkTitle}</p>
                            <p>
                                Status: {recentClassroomSubmission.turnIn ? 'Turned In' : 'Attached (not yet turned in)'}
                            </p>
                            <p>
                                Submitted:{' '}
                                {new Date(recentClassroomSubmission.submittedAtIso).toLocaleString('en-PH', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                })}
                            </p>
                            <a
                                href={recentClassroomSubmission.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-green-900 underline"
                            >
                                Open submitted link <ExternalLink size={14} />
                            </a>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={
                            classroomSubmitting ||
                            !selectedCourseId ||
                            !selectedCourseWorkId ||
                            !reportLink.trim() ||
                            courseworkLoading
                        }
                        className={`btn-primary w-full gap-2 text-base ${classroomSubmitting ? 'is-submitting' : ''}`}
                    >
                        {classroomSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
                        {classroomSubmitting ? 'Submitting to Classroom...' : 'Submit to Google Classroom'}
                    </button>
                </form>
            )}
        </div>
    );
}
