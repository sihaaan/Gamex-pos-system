import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MainNav } from "@/components/main-nav";
import { PwaBoot } from "@/components/pwa/pwa-boot";
import { getAuthContext } from "@/lib/auth/session";
import { visibleNavItems } from "@/lib/navigation";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const auth = await getAuthContext();
  const navItems = auth ? visibleNavItems(auth.role) : [];

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-ink">
        <PwaBoot />
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur print:hidden">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              href="/pos"
              className="flex items-center gap-2 text-base font-semibold tracking-normal text-ink"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white dark:text-zinc-950">
                <Gamepad2 className="h-5 w-5" />
              </span>
              GameX POS
            </Link>
            <div className="flex items-center gap-2">
              <MainNav items={navItems} />
              {auth ? <SignOutButton /> : null}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
