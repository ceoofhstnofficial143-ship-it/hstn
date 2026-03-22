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
        </SupabaseProvider>
        
        {/* Razorpay Gateway Node */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
        
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
              console.log('🔧 HSTNLX Protocol: Environment Synchronized');
              window.hstnlx_version = '2.0.0-PROD';
            `,
          }}
        />
        
        {/* Debug Panel - Development Only */}
        <DebugPanel />
      </body>
    </html>
  );
}
