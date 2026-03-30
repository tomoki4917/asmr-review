"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";

const MOODS = [
  { id: "relax", label: "ゆっくり癒やしたい" },
  { id: "sleep", label: "すぐ寝落ちしたい" },
  { id: "focus_asmr", label: "ASMRの刺激を楽しみたい" },
  { id: "immersion", label: "シチュに没入したい" },
  { id: "gentle_voice", label: "優しい声中心がいい" },
] as const;

type RecommendResponse =
  | {
      ok: true;
      slug: string;
      title: string;
      reason: string;
    }
  | { ok: false; error: string };

export function MoodDiagnosticModal() {
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [moodId, setMoodId] = useState<string>(MOODS[0].id);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setResult(null);
    setLoading(false);
  }, []);

  async function submit() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodId }),
      });
      const data = (await res.json()) as RecommendResponse;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "通信に失敗しました。" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 w-full rounded-2xl bg-sky-600 px-4 py-3 text-base font-semibold text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-500 active:scale-[0.99] sm:w-auto"
      >
        気分から作品を診断
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={close}
        >
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-600/50 bg-slate-900 p-6 shadow-xl shadow-slate-950/50 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={`${dialogId}-title`}
              className="text-xl font-bold text-slate-50"
            >
              今の気分は？
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              過去のレビューから、Gemini がひとつ選びます（サンプルデータでも動作確認できます）。
            </p>

            <fieldset className="mt-6 space-y-2">
              <legend className="sr-only">気分を選択</legend>
              {MOODS.map((m) => (
                <label
                  key={m.id}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-3 has-[:checked]:border-sky-500/50 has-[:checked]:bg-sky-950/25"
                >
                  <input
                    type="radio"
                    name="mood"
                    value={m.id}
                    checked={moodId === m.id}
                    onChange={() => setMoodId(m.id)}
                    className="h-5 w-5 accent-sky-500"
                  />
                  <span className="text-base text-slate-200">{m.label}</span>
                </label>
              ))}
            </fieldset>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={submit}
                className="min-h-12 flex-1 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-md shadow-sky-950/25 disabled:opacity-60 sm:flex-none hover:bg-sky-500"
              >
                {loading ? "診断中…" : "結果を見る"}
              </button>
              <button
                type="button"
                onClick={close}
                className="min-h-12 rounded-xl border border-slate-600 bg-slate-800/70 px-4 py-3 font-medium text-slate-200 hover:bg-slate-700"
              >
                閉じる
              </button>
            </div>

            {result && (
              <div className="mt-6 rounded-2xl border border-slate-600/50 bg-slate-800/50 p-4">
                {result.ok ? (
                  <div>
                    <p className="text-sm font-medium text-sky-400/90">おすすめ</p>
                    <p className="mt-1 text-lg font-semibold text-slate-50">
                      {result.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {result.reason}
                    </p>
                    <Link
                      href={`/reviews/${result.slug}`}
                      onClick={close}
                      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500"
                    >
                      レビューを読む
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-red-400">{result.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
