import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Archivo, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OnboardingGate } from "@/components/profile/onboarding-gate";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const sans = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Collect Your Cards — Every Card, Every Set, Every Checklist",
    template: "%s · Collect Your Cards",
  },
  description:
    "Search, organize, and track your sports card collection. Every card, every set, every checklist — on any device.",
  applicationName: "Collect Your Cards",
  appleWebApp: {
    capable: true,
    title: "CYC",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b14",
  viewportFit: "cover",
  // Lock the page scale: stops iOS from auto-zooming when a textbox is focused
  // and disables native pinch-to-zoom (which fights our layouts). The one place
  // zoom is wanted — the full-screen card viewer — uses react-zoom-pan-pinch
  // (JS transforms), so it keeps working regardless of this.
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-base text-ink antialiased">
        <div className="atmosphere">
          <div className="binder-grid" />
          <div className="grain" />
        </div>
        <SiteHeader />
        <OnboardingGate />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
