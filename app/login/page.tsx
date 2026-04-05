'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronLeft, AlertTriangle } from 'lucide-react';
import { LEADER_ATTEMPT_COOKIE, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';

function writePortalSelectionCookies(portal: 'student' | 'leader') {
    if (typeof window === 'undefined') {
        return;
    }

    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PORTAL_MODE_COOKIE}=${portal}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;

    if (portal === 'leader') {
        document.cookie = `${LEADER_ATTEMPT_COOKIE}=1; Path=/; Max-Age=1200; SameSite=Lax${secure}`;
        return;
    }

    document.cookie = `${LEADER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function LoginContent() {
    const [isLoading, setIsLoading] = useState(false);
    const [activePortal, setActivePortal] = useState<'student' | 'leader' | null>(null);
    const [isFacebookLite, setIsFacebookLite] = useState(false);
    const [localSimError, setLocalSimError] = useState<string | null>(null);
    const [devEmail, setDevEmail] = useState('student@rtu.edu.ph');
    const [devRole, setDevRole] = useState<'student' | 'leader'>('student');
    const [devToken, setDevToken] = useState('');
    const [isLocalHost, setIsLocalHost] = useState(false);
    const searchParams = useSearchParams();
    const localDevLoginEnabled = process.env.NODE_ENV !== 'production'
        && process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN_SIMULATION === 'true'
        && isLocalHost;

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            setIsLocalHost(['localhost', '127.0.0.1', '::1'].includes(window.location.hostname));
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            const ua = (window.navigator.userAgent || '').toLowerCase();
            const isLite = ua.includes('fblite') || ua.includes('fb_iab/fblite') || ua.includes('fb_lite');
            setIsFacebookLite(isLite);
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    const requestedCallbackUrl = searchParams.get('callbackUrl');
    const callbackUrl = requestedCallbackUrl?.startsWith('/') && !requestedCallbackUrl.startsWith('//')
        ? requestedCallbackUrl
        : '/';
    const errorParam = searchParams.get('error');

    // Map NextAuth error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
        AccessDenied: 'Access denied. Only @rtu.edu.ph email addresses are permitted.',
        OAuthSignin: 'Google sign-in was blocked by your current browser session. This commonly happens in in-app browsers. Open this page in Chrome, Firefox, Safari, or Edge and try again.',
        OAuthCallback: 'Google sign-in could not complete in this browser. Open this page in Chrome, Firefox, Safari, or Edge and try again.',
        OAuthAccountNotLinked: 'This email is already linked to another sign-in method.',
        CredentialsSignin: 'Local simulation login failed. Check your token and try again.',
        Configuration: 'Local simulation is not fully configured on the server.',
        Default: 'An unexpected error occurred. Please try again.',
    };

    const authErrorMessage = errorParam
        ? errorMessages[errorParam] || errorMessages.Default
        : null;
    const errorMessage = localSimError || authErrorMessage;
    const showFacebookLiteHelp = isFacebookLite && (errorParam === 'OAuthSignin' || errorParam === 'OAuthCallback');

    const handleLogin = async (portal: 'student' | 'leader') => {
        setLocalSimError(null);
        setIsLoading(true);
        setActivePortal(portal);
        writePortalSelectionCookies(portal);
        try {
            await signIn('google', { callbackUrl });
        } catch {
            setIsLoading(false);
            setActivePortal(null);
        }
    };

    const handleLocalDevLogin = async () => {
        const normalizedEmail = devEmail.trim().toLowerCase();
        const normalizedToken = devToken.trim();

        if (!normalizedEmail.endsWith('@rtu.edu.ph')) {
            setLocalSimError('Use an @rtu.edu.ph email for local simulation.');
            return;
        }

        if (!normalizedToken) {
            setLocalSimError('Enter your local simulation token.');
            return;
        }

        setLocalSimError(null);
        setIsLoading(true);
        setActivePortal(devRole);
        writePortalSelectionCookies(devRole);
        try {
            await signIn('dev-sim', {
                email: normalizedEmail,
                role: devRole,
                devToken: normalizedToken,
                callbackUrl,
            });
        } catch {
            setLocalSimError(errorMessages.Default);
            setIsLoading(false);
            setActivePortal(null);
        }
    };

    return (
        <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-surface-base" aria-label="Login section">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-rtu-blue opacity-[0.03] blur-3xl" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full bg-rtu-gold opacity-[0.05] blur-3xl" />
            </div>

            <div className="container-main relative z-10 flex justify-center">
                <motion.div
                    className="w-full max-w-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="text-center mb-10 md:mb-11">
                        <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-rtu-blue transition-colors mb-6 no-underline">
                            <ChevronLeft size={16} />
                            Back to Portal
                        </Link>
                        <div className="relative w-20 h-20 mx-auto mb-4">
                            <Image
                                src="/images/OSR_LOGO.jpg"
                                alt="Logo"
                                fill
                                sizes="80px"
                                className="object-contain rounded-full shadow-lg"
                            />
                        </div>
                        <h1 className="page-header-title text-[clamp(1.65rem,2.2vw+0.9rem,2.3rem)] font-bold text-rtu-blue">RTU Account Sign In</h1>
                        <p className="text-text-muted mt-2 text-sm leading-relaxed max-w-md mx-auto">Access the grievance portal with your official RTU email.</p>
                    </div>

                    <div className="card shadow-xl border-t-4 border-t-rtu-blue bg-white p-6 sm:p-8 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key="login-step"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                            >
                                <div className="mb-7">
                                    <h2 className="text-xl font-bold text-strong leading-tight mb-2">Sign In</h2>
                                    <p className="text-sm text-text-muted leading-relaxed">
                                        Use your institutional <strong>@rtu.edu.ph</strong> account to submit grievances, track tickets, and access role-based portal tools.
                                    </p>
                                </div>

                                {/* Error Banner */}
                                {errorMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                                    >
                                        <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={18} />
                                        <p className="text-sm text-red-700">{errorMessage}</p>
                                    </motion.div>
                                )}

                                {showFacebookLiteHelp && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg"
                                    >
                                        <p className="text-sm font-semibold text-amber-800">Facebook Lite sign-in fallback</p>
                                        <ol className="mt-2 text-sm text-amber-700 list-decimal pl-5 space-y-1">
                                            <li>Tap the 3-dot menu in Facebook Lite.</li>
                                            <li>Choose Open in browser.</li>
                                            <li>Use Chrome, Safari, Firefox, or Edge to continue Google sign-in.</li>
                                        </ol>
                                    </motion.div>
                                )}

                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleLogin('student')}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white border border-soft rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm group disabled:opacity-70"
                                    >
                                        {isLoading && activePortal === 'student' ? (
                                            <div className="w-5 h-5 border-2 border-rtu-blue border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-3 text-left">
                                                    <Image src="https://www.google.com/favicon.ico" alt="Google" width={18} height={18} />
                                                    <div>
                                                        <p className="font-semibold text-strong">Student Access</p>
                                                        <p className="text-xs text-subtle leading-relaxed">Submit and track grievances</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => handleLogin('leader')}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white border border-amber-200 rounded-xl hover:bg-amber-50 transition-all duration-200 shadow-sm group disabled:opacity-70"
                                    >
                                        {isLoading && activePortal === 'leader' ? (
                                            <div className="w-5 h-5 border-2 border-rtu-gold-dark border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-3 text-left">
                                                    <Image src="https://www.google.com/favicon.ico" alt="Google" width={18} height={18} />
                                                    <div>
                                                        <p className="font-semibold text-strong">Student Leader Access</p>
                                                        <p className="text-xs text-subtle leading-relaxed">Review leadership-only portal tools</p>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {localDevLoginEnabled && (
                                    <div className="mt-6 pt-5 border-t border-amber-100">
                                        <h4 className="pill-label pill-label-tight mb-3 bg-amber-100 text-amber-700">
                                            Localhost Login Simulation
                                        </h4>
                                        <div className="space-y-3">
                                            <input
                                                type="email"
                                                value={devEmail}
                                                onChange={(e) => setDevEmail(e.target.value)}
                                                placeholder="student@rtu.edu.ph"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            />
                                            <select
                                                value={devRole}
                                                onChange={(e) => setDevRole(e.target.value === 'leader' ? 'leader' : 'student')}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                                            >
                                                <option value="student">Student</option>
                                                <option value="leader">Student Leader</option>
                                            </select>
                                            <input
                                                type="password"
                                                value={devToken}
                                                onChange={(e) => setDevToken(e.target.value)}
                                                placeholder="Local simulation token"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                            />
                                            <button
                                                onClick={handleLocalDevLogin}
                                                disabled={isLoading || !devToken}
                                                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all duration-200 shadow-sm disabled:opacity-70"
                                            >
                                                {isLoading && activePortal === devRole ? (
                                                    <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <span className="font-semibold text-amber-800">Simulate Local Login</span>
                                                )}
                                            </button>
                                            <p className="micro-note text-amber-700/80">
                                                Enabled only in non-production with explicit env flags and localhost checks.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 pt-6 border-t border-gray-100">
                                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                                        <ShieldCheck className="text-rtu-blue mt-0.5 shrink-0" size={18} />
                                        <div>
                                            <h4 className="pill-label pill-label-tight bg-blue-100 text-rtu-blue">Security Notice</h4>
                                            <p className="micro-note text-rtu-blue/70 mt-1">
                                                Authentication is handled by Google sign-in; this portal does not store your password.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <p className="text-center micro-note text-text-muted mt-8 opacity-50">
                        &copy; 2026 RTU Supreme Student Council &middot; Rizaliano Konek Initiative
                    </p>
                </motion.div>
            </div>
        </section>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen flex items-center justify-center bg-surface-base">
                <div className="w-8 h-8 border-2 border-rtu-blue border-t-transparent rounded-full animate-spin" />
            </main>
        }>
            <LoginContent />
        </Suspense>
    );
}
