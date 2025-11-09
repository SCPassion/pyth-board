import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pyth Network Staking Dashboard",
  description: "Track your Pyth Network staking across multiple wallets",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pyth Dashboard",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Pyth Dashboard",
    title: "Pyth Network Staking Dashboard",
    description: "Track your Pyth Network staking across multiple wallets",
  },
  twitter: {
    card: "summary",
    title: "Pyth Network Staking Dashboard",
    description: "Track your Pyth Network staking across multiple wallets",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8b5cf6",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/pyth-96.png" />
        <link rel="apple-touch-icon" href="/pyth-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/pyth-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/pyth-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pyth Dashboard" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Pyth Dashboard" />
        <meta name="msapplication-TileColor" content="#8b5cf6" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className={inter.className}>
        <AppLayout>{children}</AppLayout>
        <PWAInstallPrompt />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 1000,
            style: {
              background: "#0f172a",
              color: "#f1f5f9",
              border: "1px solid #1e293b",
            },
            success: {
              style: {
                background: "#065f46",
                color: "#f1f5f9",
                border: "1px solid #047857",
              },
              iconTheme: {
                primary: "#f1f5f9",
                secondary: "#065f46",
              },
            },
            error: {
              style: {
                background: "#7f1d1d",
                color: "#f1f5f9",
                border: "1px solid #991b1b",
              },
              iconTheme: {
                primary: "#f1f5f9",
                secondary: "#7f1d1d",
              },
            },
          }}
        />
      </body>
      <Analytics />
    </html>
  );
}
