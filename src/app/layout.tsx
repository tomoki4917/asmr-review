import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Noto_Sans_JP } from "next/font/google";
import { AgeGate } from "@/components/AgeGate";
import { SITE_NAME } from "@/lib/site-brand";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "催眠音声のレビューと紹介、心理学的な読み解き。個人ブログ。",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  verification: {
    google: "JxpKAGOi1ZmNsbCYwYjZm4n9E-ql5qtDrIXsyMJXeBY",
  },
};

const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`dark ${notoSansJp.variable}`}>
      <body className="font-sans">
        {children}
        <AgeGate />
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
