'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, BadgeCheck, GraduationCap } from 'lucide-react';
import { LEADER_ATTEMPT_COOKIE, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import BackLink from '@/components/BackLink';

type AuthProviderResponse = Record<string, {
    id?: string;
    name?: string;
    type?: string;
    signinUrl?: string;
    callbackUrl?: string;
}>;

function extractProviderOrigin(provider?: { signinUrl?: string; callbackUrl?: string }): string | null {
    const candidate = provider?.callbackUrl || provider?.signinUrl;
    if (!candidate) {
        return null;
    }

    try {
        return new URL(candidate).origin;
    } catch {
        return null;
    }
}

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
    const [devRole, setDevRole] = useState<'student' | 'leader' | 'officer'>('student');
    const [devToken, setDevToken] = useState('');
    const [isLocalHost, setIsLocalHost] = useState(false);
    const [googleProviderReady, setGoogleProviderReady] = useState<boolean | null>(null);
    const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
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

    useEffect(() => {
        let cancelled = false;

        const loadProviders = async () => {
            try {
                const response = await fetch('/api/auth/providers', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error('Failed to load auth providers.');
                }

                const providers = await response.json() as AuthProviderResponse;
                const googleProvider = providers.google;
                const providerOrigin = extractProviderOrigin(googleProvider);
                const currentOrigin = typeof window === 'undefined' ? null : window.location.origin;
                const hasMismatchedOrigin = Boolean(
                    googleProvider?.id
                    && providerOrigin
                    && currentOrigin
                    && providerOrigin !== currentOrigin
                );

                if (!cancelled) {
                    setGoogleProviderReady(Boolean(googleProvider?.id) && !hasMismatchedOrigin);
                    setProviderLoadError(
                        hasMismatchedOrigin
                            ? 'Google sign-in is configured for a different deployment host. Update NEXTAUTH_URL or AUTH_URL for this environment.'
                            : null
                    );
                }
            } catch {
                if (!cancelled) {
                    setGoogleProviderReady(false);
                    setProviderLoadError('Google sign-in is not available on this deployment right now.');
                }
            }
        };

        loadProviders();
        return () => {
            cancelled = true;
        };
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
        Configuration: 'Google sign-in is not fully configured on this deployment. Check the auth environment variables for the active platform.',
        Default: 'An unexpected error occurred. Please try again.',
    };

    const authErrorMessage = errorParam
        ? errorMessages[errorParam] || errorMessages.Default
        : null;
    const errorMessage = localSimError || providerLoadError || authErrorMessage;
    const showFacebookLiteHelp = isFacebookLite && (errorParam === 'OAuthSignin' || errorParam === 'OAuthCallback');
    const disableGoogleSignIn = isLoading || googleProviderReady === false;

    const handleLogin = async (portal: 'student' | 'leader') => {
        if (googleProviderReady === false) {
            setLocalSimError('Google sign-in is not available on this deployment right now.');
            return;
        }

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
        // For officer sim, use 'leader' as the portal cookie default (gating is handled server-side)
        const portalCookieMode = devRole === 'officer' ? 'leader' : devRole;
        setActivePortal(portalCookieMode);
        writePortalSelectionCookies(portalCookieMode);
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
        <section className="portal-section-dark login-portal-shell min-h-screen flex items-center justify-center relative overflow-hidden py-10 md:py-14" aria-label="Login section">
            <div className="portal-noise-overlay" aria-hidden="true" />
            <div className="login-portal-glow login-portal-glow-blue" aria-hidden="true" />

            <div className="container-main relative z-10 flex justify-center">
                <motion.div
                    className="w-full max-w-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="mb-8 flex justify-center md:mb-10">
                        <BackLink href="/" label="Return to Portal" className="mb-2" />
                    </div>

                    <div className="login-portal-layout">
                        <div className="login-portal-copy text-center">
                            <span className="portal-eyebrow mb-6 block">Institutional Account Access</span>
                            <div className="relative mx-auto h-20 w-20 md:h-24 md:w-24 aspect-square">
                                <Image
                                    src="/images/OSR_LOGO.jpg"
                                    alt="RTU OSR logo"
                                    fill
                                    sizes="96px"
                                    className="object-cover rounded-full shadow-lg ring-1 ring-white/10"
                                />
                            </div>
                            <h1 className="portal-title portal-title-fluid mb-4">
                                RTU Account <span className="portal-title-accent">Sign In</span>
                            </h1>
                            <p className="portal-lead mx-auto">
                                Sign in using your official <strong className="font-semibold text-slate-100">@rtu.edu.ph</strong> account to access institutional portal services.
                                Google verifies your identity, and access is granted in accordance with your authorized RTU role and permissions.
                            </p>
                        </div>

                        <div className="portal-panel sg-hover-card login-portal-card p-6 sm:p-8 md:p-9">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key="login-step"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                >
                                    <div className="mb-7 text-center">
                                        <span className="pill-label pill-label-tight mb-4 border border-sky-400/15 bg-sky-400/10 text-sky-100">
                                            Institutional Authentication
                                        </span>
                                        <h2 className="text-2xl font-semibold text-white leading-tight mb-2">Select Access Type</h2>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            Select the appropriate sign-in route for your account. Access privileges are determined after authentication based on your verified RTU credentials and institutional authorization policies.
                                        </p>
                                    </div>

                                    {/* Error Banner */}
                                    {errorMessage && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="login-alert-panel login-alert-panel-danger mb-6 flex items-start gap-3 rounded-2xl p-4"
                                        >
                                            <AlertTriangle className="mt-0.5 shrink-0 text-red-200" size={18} />
                                            <p className="text-sm text-red-50">{errorMessage}</p>
                                        </motion.div>
                                    )}

                                    {showFacebookLiteHelp && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="login-alert-panel login-alert-panel-warn mb-6 rounded-2xl p-4"
                                        >
                                            <p className="text-sm font-semibold text-amber-50">Facebook Lite Sign-In Guidance</p>
                                            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-100">
                                                <li>Tap the 3-dot menu in Facebook Lite.</li>
                                                <li>Choose Open in browser.</li>
                                                <li>Use Chrome, Safari, Firefox, or Edge to continue Google sign-in.</li>
                                            </ol>
                                        </motion.div>
                                    )}

                                    <div className="space-y-3">
                                        <button
                                            onClick={() => handleLogin('student')}
                                            disabled={disableGoogleSignIn}
                                            className="login-gateway-button login-gateway-button-student w-full"
                                        >
                                            {isLoading && activePortal === 'student' ? (
                                                <div className="w-5 h-5 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <div className="flex w-full items-start gap-4 text-left">
                                                    <span className="login-gateway-icon login-gateway-icon-student" aria-hidden="true">
                                                        <GraduationCap size={18} />
                                                    </span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-white">Student Access</p>
                                                            <Image src="https://www.google.com/favicon.ico" alt="Google" width={16} height={16} />
                                                        </div>
                                                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                                                            {googleProviderReady === false ? 'Unavailable until Google sign-in is configured.' : 'For students submitting grievances, tracking records, and accessing student-facing portal services.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => handleLogin('leader')}
                                            disabled={disableGoogleSignIn}
                                            className="login-gateway-button login-gateway-button-leader w-full"
                                        >
                                            {isLoading && activePortal === 'leader' ? (
                                                <div className="w-5 h-5 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <div className="flex w-full items-start gap-4 text-left">
                                                    <span className="login-gateway-icon login-gateway-icon-leader" aria-hidden="true">
                                                        <BadgeCheck size={18} />
                                                    </span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-white">Student Leader Access</p>
                                                            <Image src="https://www.google.com/favicon.ico" alt="Google" width={16} height={16} />
                                                        </div>
                                                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                                                            {googleProviderReady === false ? 'Unavailable until Google sign-in is configured.' : 'For councils, committees, and other recognized student leadership accounts with authorized access.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    {localDevLoginEnabled && (
                                        <div className="mt-6 border-t border-white/10 pt-5">
                                            <h4 className="pill-label pill-label-tight mb-3 border border-amber-300/15 bg-amber-500/10 text-amber-100">
                                                Local Development Sign-In Simulation
                                            </h4>
                                            <div className="space-y-3">
                                                <input
                                                    type="email"
                                                    value={devEmail}
                                                    onChange={(e) => setDevEmail(e.target.value)}
                                                    placeholder="student@rtu.edu.ph"
                                                    className="login-dev-input w-full"
                                                />
                                                <label htmlFor="local-dev-role" className="sr-only">
                                                    Local development role
                                                </label>
                                                <select
                                                    id="local-dev-role"
                                                    value={devRole}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        setDevRole(v === 'officer' ? 'officer' : v === 'leader' ? 'leader' : 'student');
                                                    }}
                                                    className="login-dev-input w-full"
                                                >
                                                    <option value="student">Student</option>
                                                    <option value="leader">Student Leader</option>
                                                    <option value="officer">Officer (Admin)</option>
                                                </select>
                                                <input
                                                    type="password"
                                                    value={devToken}
                                                    onChange={(e) => setDevToken(e.target.value)}
                                                    placeholder="Local development token"
                                                    className="login-dev-input w-full"
                                                />
                                                <button
                                                    onClick={handleLocalDevLogin}
                                                    disabled={isLoading || !devToken}
                                                    className="login-dev-submit w-full"
                                                >
                                                    {isLoading && activePortal === devRole ? (
                                                        <div className="w-5 h-5 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="font-semibold text-amber-50">Simulate Local Sign-In</span>
                                                    )}
                                                </button>
                                                <p className="micro-note text-amber-100/80">
                                                    Available only in non-production environments with explicit local development safeguards.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-8 border-t border-white/10 pt-6">
                                        <div className="login-alert-panel login-alert-panel-info flex items-start gap-3 rounded-2xl p-4">
                                            <ShieldCheck className="mt-0.5 shrink-0 text-sky-200" size={18} />
                                            <div>
                                                <h4 className="pill-label pill-label-tight border border-sky-300/15 bg-sky-400/10 text-sky-100">Security Notice</h4>
                                                <p className="micro-note mt-1 text-sky-100/80">
                                                    Authentication is managed through Google Sign-In. This portal does not store user passwords, and all access levels are enforced after authentication.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    <p className="text-center micro-note mt-8 text-slate-400/70">
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
            <main className="portal-section-dark min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
            </main>
        }>
            <LoginContent />
        </Suspense>
    );
}
