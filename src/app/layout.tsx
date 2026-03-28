import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/app/product/[id]/components/Navbar";
import SupabaseProvider from "@/app/product/[id]/components/SupabaseProvider";
import { supabase } from "@/lib/supabase";
import DebugPanel from "@/components/DebugPanel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HSTNLX - Shop With Sight",
  description: "Fabric Transparency for Every Trend",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "HSTNLX",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

import EngagementTriggers from "@/components/EngagementTriggers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-background text-foreground`}
      >
        <SupabaseProvider>
          <Navbar />
          <main className="min-h-screen">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </main>
          <EngagementTriggers />
        </SupabaseProvider>
        
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
        
        {/* Supabase Global Access Node - Simplified to ensure consistent client-side context */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.hstnlx_version = '2.0.0-PROD';
              (function () {
                function sendEvent(payload) {
                  try {
                    const body = JSON.stringify(payload);
                    if (navigator.sendBeacon) {
                      const blob = new Blob([body], { type: "application/json" });
                      navigator.sendBeacon("/api/log-client-event", blob);
                      return;
                    }
                    fetch("/api/log-client-event", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body,
                      keepalive: true,
                    });
                  } catch (_) {}
                }

                sendEvent({
                  event_type: "client_boot",
                  source: "root_layout",
                  status: "success",
                  metadata: {
                    path: window.location.pathname,
                    version: window.hstnlx_version,
                    userAgent: navigator.userAgent,
                  },
                });

                window.addEventListener("error", function (event) {
                  sendEvent({
                    event_type: "client_error",
                    source: "window_error",
                    status: "failed",
                    metadata: {
                      message: event.message,
                      filename: event.filename,
                      lineno: event.lineno,
                      colno: event.colno,
                      path: window.location.pathname,
                    },
                  });
                });

                window.addEventListener("unhandledrejection", function (event) {
                  sendEvent({
                    event_type: "client_unhandled_rejection",
                    source: "window_unhandledrejection",
                    status: "failed",
                    metadata: {
                      reason: String(event.reason),
                      path: window.location.pathname,
                    },
                  });
                });
              })();
            `,
          }}
        />
        
        {/* Debug Panel - Development Only */}
        <DebugPanel />
      </body>
    </html>
  );
}
