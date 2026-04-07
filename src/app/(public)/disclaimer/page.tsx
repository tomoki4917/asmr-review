import type { Metadata } from "next";
import Link from "next/link";
import { DisclaimerContent } from "@/components/DisclaimerContent";

export const metadata: Metadata = {
  title: "免責事項",
  description:
    "同人音声レビュー分析拠点のレビュー内容、効果保証、外部リンク、アフィリエイトに関する免責です。",
};

export default function DisclaimerPage() {
  return (
    <main className="mx-auto w-full max-w-3xl py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
      >
        <span aria-hidden>←</span> トップへ
      </Link>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
        免責事項
      </h1>
      <div className="mt-10">
        <DisclaimerContent />
      </div>
    </main>
  );
}
