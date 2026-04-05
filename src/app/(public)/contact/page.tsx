import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "ASMRレビューラボへのお問い合わせフォームです。名前・メール・件名・内容をご記入ください。",
};

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-2xl py-10 sm:py-14">
      <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
        お問い合わせ
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        サイトに関するご質問・ご連絡は、下記フォームよりお送りください。返信には数日かかる場合があります。
      </p>
      <div className="mt-10 rounded-3xl border border-slate-600/45 bg-slate-800/45 p-6 shadow-lg shadow-slate-950/20 backdrop-blur-sm sm:p-8">
        <ContactForm />
      </div>
      <p className="mt-8 text-center text-xs text-slate-600">
        送信は FormSubmit 経由で{" "}
        <span className="text-slate-500">vca.reviewlabo@gmail.com</span>{" "}
        に届きます。初回利用時は同アドレスに届く有効化メールの案内に従ってください。
      </p>
    </main>
  );
}
