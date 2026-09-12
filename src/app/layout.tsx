import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
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
  title: "MediCore CRM — Enterprise Hospital Management System",
  description:
    "Premium hospital CRM & management system for patient care, operations, billing, pharmacy, lab, radiology, insurance, and analytics.",
  keywords: [
    "Hospital CRM",
    "Hospital Management",
    "Healthcare ERP",
    "Patient Management",
    "Electronic Health Records",
  ],
  authors: [{ name: "MediCore Systems" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MediCore",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Intentionally minimal: all interactive UI (theme provider, toasts, app
  // shell) renders client-side inside home-client.tsx. Server HTML is limited
  // to the html/body shell, so browser extensions that mutate the DOM cannot
  // trigger hydration mismatches.
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
