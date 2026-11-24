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
  title: "CampusConnect — University Student Network",
  description: "The university network for builders. Share projects, grow your network and discover students — powered by real data structures: graphs, BFS, Trie and Jaccard similarity.",
  keywords: ["CampusConnect", "student network", "university", "networking", "graph", "BFS", "Trie", "Jaccard"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "CampusConnect — University Student Network",
    description: "The university network for builders. Graphs, BFS, Trie and Jaccard under the hood.",
    siteName: "CampusConnect",
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
