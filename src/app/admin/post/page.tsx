"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  appendPostedReviewToStorage,
  effectivePostKind,
  postedKindLabel,
  type PostedReview,
  type PostedReviewKind,
} from "@/lib/posted-review";

export default function AdminPostPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [postKind, setPostKind] = useState<PostedReviewKind>("review");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [ratingValue, setRatingValue] = useState(4);
  const [postError, setPostError] = useState<string | null>(null);
  const [postBusy, setPostBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<PostedReview | null>(null);

  const refreshSession = useCallback(async () => {
    const res = await fetch("/api/admin/session", { credentials: "include" });
    const data = (await res.json()) as { ok?: boolean };
    const ok = Boolean(data.ok);
    setLoggedIn(ok);
    return ok;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshSession();
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setAuthError(data.error ?? "認証に失敗しました。");
        setLoggedIn(false);
        return;
      }
      setPassword("");
      setLoggedIn(true);
    } catch {
      setAuthError("通信に失敗しました。");
      setLoggedIn(false);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setPostError(null);
    setLastSaved(null);

    const ok = loggedIn ? true : await refreshSession();
    if (!ok) {
      setPostError("先にパスワードでログインしてください。");
      return;
    }

    setPostBusy(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          postKind,
          title,
          summary,
          body,
          tags,
          ratingValue: postKind === "review" ? ratingValue : 0,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        review?: PostedReview;
      };

      if (res.status === 401) {
        setLoggedIn(false);
        setPostError("セッションが切れました。もう一度ログインしてください。");
        return;
      }

      if (!res.ok || !data.ok || !data.review) {
        setPostError(data.error ?? "投稿に失敗しました。");
        return;
      }

      appendPostedReviewToStorage(data.review);
      setLastSaved(data.review);
      setTitle("");
      setSummary("");
      setBody("");
      setTags("");
      setRatingValue(4);
    } catch {
      setPostError("通信に失敗しました。");
    } finally {
      setPostBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
        管理人専用
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        投稿（管理人）
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        パスワードはサーバーでのみ確認されます。保存先はこのブラウザの
        localStorage です（端末・ブラウザごとに別データになります）。
      </p>

      {/* パスワード：常に表示 */}
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900/60 sm:p-6">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
          ステップ1：パスワードでログイン
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          あなたが設定した管理人パスワードを入力し、「ログイン」を押してください。
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleLogin}>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            パスワード
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
              required
            />
          </label>
          {checkingSession && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              前回のログイン状態を確認しています…
            </p>
          )}
          {authError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authBusy}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {authBusy ? "確認中…" : "ログイン"}
          </button>
        </form>

        {loggedIn && (
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ログインできました。下のフォームから投稿できます。
          </p>
        )}
      </section>

      {/* レビュー：ログイン後のみ */}
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900/60 sm:p-6">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
          ステップ2：内容を入力して投稿
        </h2>

        {!loggedIn ? (
          <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            まず上の「ステップ1」でログインすると、この欄に入力フォームが表示されます。
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handlePost}>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              投稿の種類
              <select
                value={postKind}
                onChange={(ev) =>
                  setPostKind(ev.target.value as PostedReviewKind)
                }
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
              >
                <option value="review">レビュー（催眠音声の評価・星あり）</option>
                <option value="author_article">筆者投稿記事</option>
                <option value="mechanism">催眠音声のメカニズム</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              タイトル
              <input
                type="text"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
                required
                maxLength={200}
              />
            </label>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              概要
              <textarea
                value={summary}
                onChange={(ev) => setSummary(ev.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
                maxLength={2000}
              />
            </label>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              本文（Markdown 可）
              <textarea
                value={body}
                onChange={(ev) => setBody(ev.target.value)}
                rows={12}
                className="mt-1.5 w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-2.5 font-mono text-sm text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              タグ（カンマ区切り）
              <input
                type="text"
                value={tags}
                onChange={(ev) => setTags(ev.target.value)}
                placeholder="例: 耳かき, ロールプレイ"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>
            {postKind === "review" && (
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                評価（1〜5）
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={ratingValue}
                  onChange={(ev) => setRatingValue(Number(ev.target.value))}
                  className="mt-1.5 w-32 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
                />
              </label>
            )}
            {postError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {postError}
              </p>
            )}
            {lastSaved && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                「{postedKindLabel(effectivePostKind(lastSaved))}」として保存しました。{" "}
                <Link
                  href="/"
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  一覧
                </Link>
                または{" "}
                <Link
                  href={`/reviews/local/${lastSaved.id}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  この記事
                </Link>
                を開いて確認できます。
              </p>
            )}
            <button
              type="submit"
              disabled={postBusy}
              className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
            >
              {postBusy ? "送信中…" : "投稿する"}
            </button>
          </form>
        )}
      </section>

      <p className="mt-10 text-center text-sm text-stone-500 dark:text-stone-400">
        <Link
          href="/"
          className="font-medium text-indigo-700 hover:underline dark:text-indigo-400"
        >
          ← 一覧へ戻る
        </Link>
      </p>
    </main>
  );
}
