import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CU.Setu — A bridge connecting the students of Chanakya University",
  description: "The CU.Setu network for Chanakya University students. Share projects, grow your network and discover students — powered by real data structures: graphs, BFS, Trie and Jaccard similarity.",
  keywords: ["CU.Setu", "Chanakya University", "student network", "networking", "graph", "BFS", "Trie", "Jaccard"],
  icons: {
    icon: "/cu-setu-logo.png",
  },
  openGraph: {
    title: "CU.Setu — A bridge connecting the students of Chanakya University",
    description: "Connect · Share · Grow — graphs, BFS, Trie and Jaccard under the hood.",
    siteName: "CU.Setu",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
