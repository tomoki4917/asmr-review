import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyPolicyContent } from "@/components/PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "催眠音声解析室の個人情報・Cookie・広告・アナリティクスに関する取り扱いです。",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
      >
        <span aria-hidden>←</span> トップへ
      </Link>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
        プライバシーポリシー
      </h1>
      <div className="mt-10">
        <PrivacyPolicyContent />
      </div>
    </main>
  );
}
