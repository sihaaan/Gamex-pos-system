import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { PwaBoot } from "@/components/pwa/pwa-boot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GameX POS",
  description: "Production POS for GST-registered pool and gaming shops.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-950">
        <PwaBoot />
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/pos" className="text-base font-semibold tracking-normal">
              GameX POS
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/pos">
                POS
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/reports">
                Reports
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/admin">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
