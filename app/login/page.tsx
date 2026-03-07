'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, LogIn, ChevronLeft } from 'lucide-react';

export default function LoginPage() {
    const [step, setStep] = useState<'login' | 'select-role'>('login');
    const [isLoading, setIsLoading] = useState(false);

    const handleLoginClick = () => {
        setIsLoading(true);
        // Simulate Google OAuth delay
        setTimeout(() => {
            setIsLoading(false);
            setStep('select-role');
        }, 1500);
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
                            {step === 'login' ? (
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

                                    <button
                                        onClick={handleLoginClick}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm group disabled:opacity-70"
                                    >
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-rtu-blue border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Image src="https://www.google.com/favicon.ico" alt="Google" width={18} height={18} />
                                                <span className="font-semibold text-gray-700">Continue with Google</span>
                                            </>
                                        )}
                                    </button>

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
                            ) : (
                                <motion.div
                                    key="role-step"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <div className="mb-6">
                                        <h2 className="text-xl font-bold mb-2">Identification Required</h2>
                                        <p className="text-sm text-text-muted">
                                            We've verified your email. Please select your organizational role to enter the portal.
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <button className="w-full card p-4 flex items-center justify-between hover:border-rtu-blue transition-all group border-2 border-transparent">
                                            <div className="text-left">
                                                <h4 className="font-bold text-rtu-blue">Regular Student</h4>
                                                <p className="text-xs text-text-muted mt-1">Grievances, directory, & community hub</p>
                                            </div>
                                            <ArrowRight className="text-gray-300 group-hover:text-rtu-blue -translate-x-2 group-hover:translate-x-0 transition-all" size={18} />
                                        </button>

                                        <button className="w-full card p-4 flex items-center justify-between hover:border-rtu-gold transition-all group border-2 border-transparent">
                                            <div className="text-left">
                                                <h4 className="font-bold text-rtu-gold">Student Leader</h4>
                                                <p className="text-xs text-text-muted mt-1">Document submission & council tools</p>
                                            </div>
                                            <ArrowRight className="text-gray-300 group-hover:text-rtu-gold -translate-x-2 group-hover:translate-x-0 transition-all" size={18} />
                                        </button>
                                    </div>

                                    <p className="text-[10px] text-center text-text-muted mt-6 uppercase tracking-widest">
                                        Verified: student.name@rtu.edu.ph
                                    </p>
                                </motion.div>
                            )}
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
