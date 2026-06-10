import type { Metadata, Viewport } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/components/providers/query-provider";
import { SwRegister } from "@/components/providers/sw-register";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "EduOps AI",
  description: "Operations platform for Indian educational institutions",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground">
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
