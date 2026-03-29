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
        className="min-h-12 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/25 transition active:scale-[0.99] sm:w-auto dark:bg-indigo-500 dark:shadow-indigo-950/40"
      >
        気分から作品を診断
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={close}
        >
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={`${dialogId}-title`}
              className="text-xl font-bold text-stone-900 dark:text-stone-50"
            >
              今の気分は？
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              過去のレビューから、Gemini がひとつ選びます（サンプルデータでも動作確認できます）。
            </p>

            <fieldset className="mt-6 space-y-2">
              <legend className="sr-only">気分を選択</legend>
              {MOODS.map((m) => (
                <label
                  key={m.id}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:border-stone-600 dark:has-[:checked]:border-indigo-400 dark:has-[:checked]:bg-indigo-950/35"
                >
                  <input
                    type="radio"
                    name="mood"
                    value={m.id}
                    checked={moodId === m.id}
                    onChange={() => setMoodId(m.id)}
                    className="h-5 w-5 accent-indigo-600"
                  />
                  <span className="text-base text-stone-800 dark:text-stone-100">
                    {m.label}
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={submit}
                className="min-h-12 flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-900/20 disabled:opacity-60 dark:bg-indigo-500 sm:flex-none"
              >
                {loading ? "診断中…" : "結果を見る"}
              </button>
              <button
                type="button"
                onClick={close}
                className="min-h-12 rounded-xl border border-stone-300 px-4 py-3 font-medium text-stone-800 dark:border-stone-600 dark:text-stone-200"
              >
                閉じる
              </button>
            </div>

            {result && (
              <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800/50">
                {result.ok ? (
                  <div>
                    <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                      おすすめ
                    </p>
                    <p className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-50">
                      {result.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                      {result.reason}
                    </p>
                    <Link
                      href={`/reviews/${result.slug}`}
                      onClick={close}
                      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      レビューを読む
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
