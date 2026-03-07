import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="bg-gradient-rtu text-white mt-auto">
            <div className="container-main py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <Image
                                src="/images/OSR_LOGO.jpg"
                                alt="OSR Logo"
                                width={36}
                                height={36}
                                className="rounded-full"
                            />
                            <span className="font-bold text-lg">Rizal Technological University - Office of the Student Regent</span>
                        </div>
                        <p className="text-white/60 text-sm leading-relaxed">
                            The Office of the Student Regent serves as the official voice of the student body in the Board of Regents, championing student rights, transparency, and welfare across all campuses.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--rtu-gold-light)' }}>
                            Quick Links
                        </h4>
                        <div className="flex flex-col gap-2">
                            {[
                                { href: '/', label: 'Home' },
                                { href: '/directory', label: 'Officer Directory' },
                                { href: '/services', label: 'Services & Forms' },
                                { href: '/news', label: 'News & Updates' },
                            ].map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-white/60 text-sm no-underline hover:text-white transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-semibold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--rtu-gold-light)' }}>
                            Contact
                        </h4>
                        <p className="text-white/60 text-sm leading-relaxed">
                            Rizal Technological University<br />
                            Cities of Mandaluyong and Pasig<br />
                            Metro Manila, Philippines
                        </p>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="footer-divider mt-10 mb-6" />
                <div className="text-center">
                    <p className="text-white/40 text-xs">
                        © {new Date().getFullYear()} Rizal Technological University - Office of the Student Regent. All rights reserved.
                    </p>
                </div>
            </div>
        </footer >
    );
}
