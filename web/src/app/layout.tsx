import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: {
    default: "Cannabliz — Wholesale Marketplace",
    template: "%s · Cannabliz",
  },
  description:
    "A blind wholesale marketplace connecting Michigan-licensed Growers, Processors, and Retailers, brokered by a neutral intermediary.",
  // manifest.ts covers Android/desktop install; iOS Safari still needs these
  // explicit tags to offer "Add to Home Screen" with the right icon/name and
  // to launch standalone (no browser chrome) instead of opening Safari.
  // One PWA identity for the whole app (Cannabliz) — Xcelerate POS is a
  // section within it (/retailer/pos), not a separately installable app.
  // See CLAUDE.md §27.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cannabliz",
  },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
