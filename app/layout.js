import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import NavbarClient from "@/components/NavbarClient";
import SectionNavigationRail from "@/components/SectionNavigationRail";
import Footer from "@/components/Footer";
import AuthProvider from "@/components/AuthProvider";
import PageTransition from "@/components/PageTransition";
import { CspNonceProvider } from "@/components/CspNonceProvider";
import ViewportModeGuard from "@/components/ViewportModeGuard";
import AnnouncementPopup from "@/components/AnnouncementPopup";
import { getSiteConfig } from "@/lib/slideConfig";
import { headers } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "RTU Student Government Portal",
  description: "The unified digital portal of the RTU Supreme Student Council and Office of the Student Regent. Access student services, officer directory, transparency reports, and campus resources.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }) {
  const config = await getSiteConfig();
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') || '';

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <CspNonceProvider nonce={nonce}>
          <ViewportModeGuard />
          <AuthProvider>
            <NavbarClient config={config} />
            <SectionNavigationRail />
            <main id="main-content" className="flex-1" tabIndex={-1}>
              <PageTransition>
                {children}
              </PageTransition>
            </main>
            <Footer />
            <AnnouncementPopup />
          </AuthProvider>
        </CspNonceProvider>
      </body>
    </html>
  );
}

