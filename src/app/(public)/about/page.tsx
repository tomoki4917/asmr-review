import type { Metadata } from "next";
import Link from "next/link";
import { AboutContent } from "@/components/AboutContent";
import { SITE_NAME } from "@/lib/site-brand";

export const metadata: Metadata = {
  title: "サイトについて",
  description: `${SITE_NAME}の運営方針・レビューの考え方・アフィリエイトについて。`,
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
      >
        <span aria-hidden>←</span> トップへ
      </Link>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
        サイトについて
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
        {SITE_NAME}の運営方針と、レビュー・採点の考え方をまとめています。
      </p>
      <div className="mt-10">
        <AboutContent />
      </div>
    </main>
  );
}
