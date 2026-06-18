import type { Metadata, Viewport } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";
import { SwRegister } from "@/components/providers/sw-register";
import { getLocale } from "@/lib/i18n/locale";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://eduops.in"),
  title: {
    default: "EduOps — School and Coaching Centre Operations",
    template: "%s | EduOps",
  },
  description: "Mobile-first attendance, fee tracking, admissions and parent communication for Indian schools and coaching centres.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "EduOps",
    description: "Daily operations for Indian schools and coaching centres.",
    type: "website",
    locale: "en_IN",
    siteName: "EduOps",
  },
  twitter: {
    card: "summary_large_image",
    title: "EduOps",
    description: "Daily operations for Indian schools and coaching centres.",
  },
  manifest: "/manifest.json",
  applicationName: "EduOps AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduOps",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11604e",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale === "te" ? "te" : "en-IN"} className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:shadow-lg"
        >
          Skip to main content
        </a>
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
