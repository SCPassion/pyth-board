import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pyth Network Staking Dashboard",
  description: "Track your Pyth Network staking across multiple wallets",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AppLayout>{children}</AppLayout>
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
