"use client";

import { useState } from "react";

/** 既定の送信先（FormSubmit）。環境変数で上書き可。 */
const DEFAULT_CONTACT_EMAIL = "vca.reviewlabo@gmail.com";

/**
 * FormSubmit（https://formsubmit.co）の AJAX エンドポイントへ送信します。
 * 初回のみ、送信先メールに有効化リンクが届く場合があります。
 */
export function ContactForm() {
  const to =
    process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
  const ajaxUrl = `https://formsubmit.co/ajax/${encodeURIComponent(to)}`;

  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">(
    "idle"
  );
  const [validationHint, setValidationHint] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationHint(null);
    const form = e.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const fd = new FormData(form);
    const honey = String(fd.get("_honey") ?? "");
    if (honey.trim() !== "") {
      return;
    }

    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const subject = String(fd.get("subject") ?? "").trim();
    const message = String(fd.get("message") ?? "").trim();

    if (!name || !email || !subject || !message) {
      setValidationHint(
        "お名前・メール・件名・内容はすべて入力してください（空白のみは送信できません）。"
      );
      return;
    }

    setStatus("sending");
    const payload = {
      name,
      email,
      _subject: subject,
      message,
    };
    try {
      const res = await fetch(ajaxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("ok");
        form.reset();
      } else {
        setStatus("err");
      }
    } catch {
      setStatus("err");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5">
      <div>
        <label
          htmlFor="contact-name"
          className="block text-sm font-medium text-slate-300"
        >
          お名前 <span className="text-rose-400">*</span>
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1.5 w-full rounded-xl border border-slate-600/60 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
          placeholder="山田 太郎"
        />
      </div>
      <div>
        <label
          htmlFor="contact-email"
          className="block text-sm font-medium text-slate-300"
        >
          メールアドレス <span className="text-rose-400">*</span>
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded-xl border border-slate-600/60 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="contact-subject"
          className="block text-sm font-medium text-slate-300"
        >
          件名 <span className="text-rose-400">*</span>
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          className="mt-1.5 w-full rounded-xl border border-slate-600/60 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
          placeholder="サイトについて"
        />
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="block text-sm font-medium text-slate-300"
        >
          内容 <span className="text-rose-400">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          className="mt-1.5 w-full resize-y rounded-xl border border-slate-600/60 bg-slate-900/80 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
          placeholder="お問い合わせ内容をご記入ください"
        />
      </div>
      <input
        type="text"
        name="_honey"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      {validationHint && (
        <p className="text-sm text-amber-300/95" role="alert">
          {validationHint}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-500 disabled:opacity-60"
      >
        {status === "sending" ? "送信中…" : "送信する"}
      </button>
      {status === "ok" && (
        <p
          className="text-center text-sm font-medium text-emerald-400"
          role="status"
        >
          送信しました。返信まで少々お待ちください。
        </p>
      )}
      {status === "err" && (
        <p className="text-center text-sm text-rose-400" role="alert">
          送信に失敗しました。時間をおいて再度お試しください。
        </p>
      )}
    </form>
  );
}
