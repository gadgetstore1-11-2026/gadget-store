import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./home.css";
import "./cart.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gadget Store | Premium Gadgets in Bangladesh",
  description: "Shop premium gadgets, electronics and accessories at Gadget Store Bangladesh. Explore smart watches, audio products, mobile accessories and everyday tech with nationwide delivery.",
  keywords: [
    "Gadget Store Bangladesh",
    "online gadget shop Bangladesh",
    "smart watch",
    "wireless earbuds",
    "headphones",
    "mobile accessories",
  ],
  openGraph: {
    title: "Gadget Store | Premium Gadgets in Bangladesh",
    description: "Discover useful gadgets, smart accessories and everyday tech essentials at Gadget Store Bangladesh.",
    siteName: "Gadget Store",
    locale: "en_BD",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Gadget Store | Premium Gadgets in Bangladesh",
    description: "Shop premium gadgets and everyday tech essentials across Bangladesh.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
