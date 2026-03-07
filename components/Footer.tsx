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
                                alt="RTU Student Government Logo"
                                width={36}
                                height={36}
                                className="rounded-full"
                            />
                            <span className="font-bold text-lg">RTU Student Government Portal</span>
                        </div>
                        <p className="text-white/60 text-sm leading-relaxed">
                            The unified digital platform of the Supreme Student Council and the Office of the Student Regent — championing student rights, transparency, and welfare across all campuses.
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
                                { href: '/osr', label: 'Office of the Student Regent' },
                                { href: '/directory', label: 'Officer Directory' },
                                { href: '/services', label: 'Services & Forms' },
                                { href: '/news', label: 'News & Updates' },
                                { href: '/login', label: 'Portal Login' },
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
                        © {new Date().getFullYear()} RTU Student Government Portal. All rights reserved.
                    </p>
                </div>
            </div>
        </footer >
    );
}
