import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SupabaseProvider from "@/components/SupabaseProvider";
import { supabase } from "@/lib/supabase";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HSTN - Shop With Sight",
  description: "Fabric Transparency for Every Trend",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "HSTN",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseProvider>
          <Navbar />
          <main>
            {children}
          </main>
        </SupabaseProvider>
        {/* Expose supabase globally for debugging */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.supabase = ${JSON.stringify({ available: true })};
              console.log('🔧 Supabase debug: Script loaded');
            `,
          }}
        />
      </body>
    </html>
  );
}
