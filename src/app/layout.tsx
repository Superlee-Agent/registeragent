// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import dynamic from "next/dynamic";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f1a" },
  ],
  colorScheme: "light dark",
};

export const metadata: Metadata = {
  title: "Superlee AI Agent - Advanced IP Registration",
  description: "Advanced IP registration assistant with AI detection and smart license recommendations on Story Protocol",
};


const Providers = dynamic(() => import("./providers"), { ssr: false });
const Topbar = dynamic(() => import("@/components/Topbar"), { ssr: false });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gradient-to-br from-ai-bg via-ai-bg to-slate-900 text-white selection:bg-ai-primary/30">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Topbar />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
