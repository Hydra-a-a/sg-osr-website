'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronLeft, AlertTriangle } from 'lucide-react';

function LoginContent() {
    const [isLoading, setIsLoading] = useState(false);
    const [activePortal, setActivePortal] = useState<'student' | 'leader' | null>(null);
    const searchParams = useSearchParams();

    const requestedCallbackUrl = searchParams.get('callbackUrl');
    const callbackUrl = requestedCallbackUrl?.startsWith('/') && !requestedCallbackUrl.startsWith('//')
        ? requestedCallbackUrl
        : '/';
    const errorParam = searchParams.get('error');

    // Map NextAuth error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
        AccessDenied: 'Access denied. Only @rtu.edu.ph email addresses are permitted.',
        OAuthAccountNotLinked: 'This email is already linked to another sign-in method.',
        Default: 'An unexpected error occurred. Please try again.',
    };

    const errorMessage = errorParam
        ? errorMessages[errorParam] || errorMessages.Default
        : null;

    const handleLogin = async (portal: 'student' | 'leader') => {
        setIsLoading(true);
        setActivePortal(portal);
        try {
            await signIn('google', { callbackUrl });
        } catch {
            setIsLoading(false);
            setActivePortal(null);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#fafafa]">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-rtu-blue opacity-[0.03] blur-3xl" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full bg-rtu-gold opacity-[0.05] blur-3xl" />
            </div>

            <div className="container-main relative z-10 flex justify-center">
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-rtu-blue transition-colors mb-6 no-underline">
                            <ChevronLeft size={16} />
                            Back to Portal
                        </Link>
                        <div className="relative w-20 h-20 mx-auto mb-4">
                            <Image
                                src="/images/OSR_LOGO.jpg"
                                alt="Logo"
                                fill
                                className="object-contain rounded-full shadow-lg"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-rtu-blue">Identity Access Management</h1>
                        <p className="text-text-muted mt-2">RTU Student Government Portal</p>
                    </div>

                    <div className="card shadow-xl border-t-4 border-t-rtu-blue bg-white p-8 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key="login-step"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                            >
                                <div className="mb-8">
                                    <h2 className="text-xl font-bold mb-2">Sign In</h2>
                                    <p className="text-sm text-text-muted">
                                        Authorized access only. Use your institutional <strong>@rtu.edu.ph</strong> email to continue.
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

                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleLogin('student')}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm group disabled:opacity-70"
                                    >
                                        {isLoading && activePortal === 'student' ? (
                                            <div className="w-5 h-5 border-2 border-rtu-blue border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Image src="https://www.google.com/favicon.ico" alt="Google" width={18} height={18} />
                                                <span className="font-semibold text-gray-700">Student Access (RTU Email)</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => handleLogin('leader')}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-amber-200 rounded-xl hover:bg-amber-50 transition-all duration-200 shadow-sm group disabled:opacity-70"
                                    >
                                        {isLoading && activePortal === 'leader' ? (
                                            <div className="w-5 h-5 border-2 border-rtu-gold-dark border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Image src="https://www.google.com/favicon.ico" alt="Google" width={18} height={18} />
                                                <span className="font-semibold text-gray-700">Student Leader Access</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100">
                                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                                        <ShieldCheck className="text-rtu-blue mt-0.5 shrink-0" size={18} />
                                        <div>
                                            <h4 className="text-xs font-bold text-rtu-blue uppercase tracking-wider">Enterprise Security</h4>
                                            <p className="text-[11px] text-rtu-blue/70 leading-relaxed mt-1">
                                                Our Zero-Trust architecture ensures your credentials are encrypted and never stored on local servers.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <p className="text-center text-[10px] text-text-muted mt-8 opacity-50">
                        &copy; 2026 RTU Supreme Student Council &middot; Digital Transformation Initiative
                    </p>
                </motion.div>
            </div>
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen flex items-center justify-center bg-[#fafafa]">
                <div className="w-8 h-8 border-2 border-rtu-blue border-t-transparent rounded-full animate-spin" />
            </main>
        }>
            <LoginContent />
        </Suspense>
    );
}
