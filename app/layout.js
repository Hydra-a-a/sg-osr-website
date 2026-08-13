import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavbarClient from "@/components/NavbarClient";
import AlphaTestingNotice from "@/components/AlphaTestingNotice";
import SectionNavigationRail from "@/components/SectionNavigationRail";
import Footer from "@/components/Footer";
import { CspNonceProvider } from "@/components/CspNonceProvider";
import ViewportModeGuard from "@/components/ViewportModeGuard";
import DeferredAnnouncementPopup from "@/components/DeferredAnnouncementPopup";
import RouteAwareSiteChrome from "@/components/RouteAwareSiteChrome";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";
import { getSiteConfig } from "@/lib/slideConfig";
import { auth } from "@/lib/auth";
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
  const [config, session, requestHeaders] = await Promise.all([
    getSiteConfig(),
    auth(),
    headers(),
  ]);
  const nonce = requestHeaders.get('x-nonce') || '';

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <CspNonceProvider nonce={nonce}>
          <NetworkStatusBanner />
          <ViewportModeGuard />
          <RouteAwareSiteChrome
            publicHeader={<NavbarClient config={config} session={session} />}
            publicAlphaNotice={<AlphaTestingNotice />}
            publicNavigationRail={<SectionNavigationRail />}
            publicFooter={<Footer isLoggedIn={Boolean(session?.user)} />}
            publicAnnouncement={<DeferredAnnouncementPopup />}
          >
            {children}
          </RouteAwareSiteChrome>
        </CspNonceProvider>
      </body>
    </html>
  );
}

