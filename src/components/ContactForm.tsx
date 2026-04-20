"use client";

import { useState } from "react";

/**
 * FormSubmit（https://formsubmit.co）の AJAX エンドポイントへ送信します。
 * 送信先は NEXT_PUBLIC_CONTACT_TO_EMAIL のみ（未設定時はフォームを出しません）。
 */
export function ContactForm() {
  const to = process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim() ?? "";
  const ajaxUrl = to
    ? `https://formsubmit.co/ajax/${encodeURIComponent(to)}`
    : "";

  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">(
    "idle"
  );
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const [submitErrorDetail, setSubmitErrorDetail] = useState<string | null>(
    null
  );

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

    if (!to || !ajaxUrl) {
      setValidationHint(
        "送信先が未設定です。NEXT_PUBLIC_CONTACT_TO_EMAIL を .env に設定してください。"
      );
      return;
    }

    setStatus("sending");
    setSubmitErrorDetail(null);
    const payload: Record<string, string> = {
      name,
      email,
      _replyto: email,
      _subject: subject,
      message,
      _captcha: "false",
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

      const ct = res.headers.get("content-type") ?? "";
      let apiSaysOk = res.ok;
      let apiMessage: string | null = null;

      if (ct.includes("application/json")) {
        try {
          const data = (await res.json()) as Record<string, unknown>;
          const success = data.success;
          if (success === "false" || success === false) {
            apiSaysOk = false;
          }
          if (typeof data.message === "string" && data.message.trim()) {
            apiMessage = data.message.trim();
          }
        } catch {
          apiSaysOk = false;
        }
      }

      if (apiSaysOk) {
        setStatus("ok");
        form.reset();
      } else {
        setStatus("err");
        setSubmitErrorDetail(apiMessage);
      }
    } catch {
      setStatus("err");
      setSubmitErrorDetail(null);
    }
  }

  if (!to) {
    return (
      <div
        className="rounded-2xl border border-amber-600/40 bg-amber-950/20 px-5 py-6 text-sm text-amber-100/95"
        role="status"
      >
        <p className="font-medium">お問い合わせフォームは未設定です</p>
        <p className="mt-2 text-amber-200/80">
          デプロイ時に{" "}
          <code className="rounded border border-amber-600/50 bg-slate-900/60 px-1.5 py-0.5 font-mono text-xs">
            NEXT_PUBLIC_CONTACT_TO_EMAIL
          </code>{" "}
          に送信先メールを設定してください（リポジトリにメールアドレスを直書きしません）。
        </p>
      </div>
    );
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
        <div className="text-center text-sm text-rose-400" role="alert">
          <p>送信に失敗しました。時間をおいて再度お試しください。</p>
          {submitErrorDetail ? (
            <p className="mt-2 text-xs leading-relaxed text-rose-300/90">
              {submitErrorDetail}
            </p>
          ) : null}
        </div>
      )}
    </form>
  );
}

/** お問い合わせページ下部の注記（送信先は env のみ参照） */
export function ContactFormEnvNote() {
  const email = process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim() ?? "";
  if (!email) {
    return (
      <p className="mt-8 text-center text-xs text-slate-600">
        送信先メールは環境変数{" "}
        <code className="text-slate-500">NEXT_PUBLIC_CONTACT_TO_EMAIL</code>{" "}
        で設定します。
      </p>
    );
  }
  return (
    <p className="mt-8 text-center text-xs text-slate-600">
      送信は FormSubmit 経由で{" "}
      <span className="text-slate-500">{email}</span>{" "}
      に届きます。初回利用時は同アドレスに届く有効化メールの案内に従ってください。
    </p>
  );
}
