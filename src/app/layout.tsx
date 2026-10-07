import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { Monitoring } from "@/providers/monitoring";
import { ServiceWorkerRegistrar } from "@/providers/service-worker-registrar";
import { ThemeProvider } from "@/providers/theme-provider";

import splashScreens from "./splash-screens.json";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ledger", template: "%s · Ledger" },
  description: "Track every expense in seconds.",
  applicationName: "Ledger",
  appleWebApp: { capable: true, title: "Ledger", statusBarStyle: "default", startupImage: splashScreens },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfe" },
    { media: "(prefers-color-scheme: dark)", color: "#101116" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-center"
              richColors
              closeButton
              // Keep toasts below the status bar / Dynamic Island in the installed app.
              mobileOffset={{ top: "max(16px, calc(env(safe-area-inset-top) + 8px))" }}
            />
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        <Monitoring />
      </body>
    </html>
  );
}
