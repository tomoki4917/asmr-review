"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  POSTED_REVIEWS_CHANGED_EVENT,
  appendPostedReviewToStorage,
  deletePostedReviewFromStorage,
  effectivePostKind,
  postedKindLabel,
  readPostedReviewsFromStorage,
  replacePostedReviewInStorage,
  type PostedReview,
  type PostedReviewKind,
} from "@/lib/posted-review";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() ?? "";

type ContentMode = "review" | "article";

/** 詳細ページの紹介文用。Markdown（先頭の画像など）を壊さないよう改行は保持し、長さだけ抑える */
function buildSummary(body: string, title: string): string {
  const raw = body.trim().replace(/\r\n/g, "\n");
  if (!raw) return title;
  const max = 800;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

function resolvePostKindOnSave(
  contentMode: ContentMode,
  editingOriginalKind: PostedReviewKind | null
): PostedReviewKind {
  if (contentMode === "review") return "review";
  if (!editingOriginalKind) return "article";
  if (editingOriginalKind === "mechanism") return "mechanism";
  if (editingOriginalKind === "author_article") return "author_article";
  return "article";
}

function defaultTagsForKind(k: PostedReviewKind): string[] {
  switch (k) {
    case "review":
      return ["レビュー"];
    case "article":
      return ["記事"];
    case "author_article":
      return ["筆者投稿"];
    case "mechanism":
      return ["メカニズム"];
    default:
      return ["記事"];
  }
}

function StarRatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-600/60 bg-slate-800/55 p-4 shadow-inner shadow-slate-950/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold tracking-wide text-slate-200">
          {label}
        </span>
        <div
          className="flex flex-wrap items-center gap-0.5"
          role="group"
          aria-label={`${label}の評価`}
        >
          {(
            [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            ] as const
          ).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={[
                "min-h-9 min-w-8 rounded-lg text-base leading-none transition sm:min-h-10 sm:min-w-9 sm:text-lg",
                n <= value
                  ? "text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.28)]"
                  : "text-slate-500 hover:text-slate-400",
              ].join(" ")}
              aria-label={`${label} ${n}点`}
              aria-pressed={n === value}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-right text-xs font-medium tabular-nums text-slate-400">
        選択中: <span className="text-sky-200">{value}</span> / 10
      </p>
    </div>
  );
}

export default function AdminPostForm() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);

  const [savedList, setSavedList] = useState<PostedReview[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalKind, setEditingOriginalKind] =
    useState<PostedReviewKind | null>(null);

  const [contentMode, setContentMode] = useState<ContentMode>("review");
  const [title, setTitle] = useState("");
  const [dlsiteUrl, setDlsiteUrl] = useState("");
  const [ratingValue, setRatingValue] = useState(5);
  const [body, setBody] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const reloadSavedList = useCallback(() => {
    setSavedList(readPostedReviewsFromStorage());
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    reloadSavedList();
    function onChange() {
      reloadSavedList();
    }
    window.addEventListener(POSTED_REVIEWS_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(POSTED_REVIEWS_CHANGED_EVENT, onChange);
  }, [unlocked, reloadSavedList]);

  function resetFormForNew() {
    setEditingId(null);
    setEditingOriginalKind(null);
    setContentMode("review");
    setTitle("");
    setDlsiteUrl("");
    setThumbnailUrl("");
    setBody("");
    setRatingValue(5);
    setSubmitError(null);
  }

  function loadPostForEdit(p: PostedReview) {
    const k = effectivePostKind(p);
    setEditingId(p.id);
    setEditingOriginalKind(k);
    setContentMode(k === "review" ? "review" : "article");
    setTitle(p.title);
    setBody(p.body);
    setDlsiteUrl(p.dlsiteUrl ?? "");
    setThumbnailUrl(p.thumbnailUrl ?? "");
    setRatingValue(
      k === "review"
        ? Math.min(
            10,
            Math.max(
              1,
              Math.round(
                ((p.ratingValue || 5) / (p.ratingBest ?? 5)) * 10
              )
            )
          )
        : 5
    );
    setSubmitError(null);
    setSaveNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete(p: PostedReview) {
    if (
      !window.confirm(
        `「${p.title.slice(0, 60)}${p.title.length > 60 ? "…" : ""}」を削除しますか？この操作は取り消せません。`
      )
    ) {
      return;
    }
    deletePostedReviewFromStorage(p.id);
    if (editingId === p.id) {
      resetFormForNew();
    }
    reloadSavedList();
    setSaveNotice("削除しました。");
    setTimeout(() => setSaveNotice(null), 3000);
  }

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setGateError(null);
    if (!ADMIN_PASSWORD) {
      setGateError(
        "NEXT_PUBLIC_ADMIN_PASSWORD が未設定です。.env に設定してからビルドし直してください。"
      );
      return;
    }
    if (gatePassword === ADMIN_PASSWORD) {
      setUnlocked(true);
      setGatePassword("");
      return;
    }
    setGateError("パスワードが違います。");
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setSaveNotice(null);

      if (!title.trim()) {
        setSubmitError(
          contentMode === "review"
            ? "タイトル（作品名）を入力してください。"
            : "タイトルを入力してください。"
        );
        return;
      }
      if (!body.trim()) {
        setSubmitError("本文を入力してください。");
        return;
      }

      const postKind = resolvePostKindOnSave(contentMode, editingOriginalKind);
      const summary = buildSummary(body, title.trim());
      const existing =
        editingId != null
          ? readPostedReviewsFromStorage().find((r) => r.id === editingId)
          : undefined;

      const tagsToUse =
        existing &&
        effectivePostKind(existing) === postKind &&
        existing.tags.length > 0
          ? existing.tags
          : defaultTagsForKind(postKind);

      const newId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `post-${Date.now()}`;

      const row: PostedReview = {
        id: editingId ?? newId,
        postKind,
        title: title.trim(),
        summary,
        body: body.trim(),
        tags: tagsToUse,
        ratingValue: postKind === "review" ? ratingValue : 0,
        publishedAt: existing?.publishedAt ?? new Date().toISOString(),
      };

      if (postKind === "review") {
        row.ratingBest = 10;
      }

      if (dlsiteUrl.trim()) row.dlsiteUrl = dlsiteUrl.trim();
      else delete row.dlsiteUrl;
      if (thumbnailUrl.trim()) row.thumbnailUrl = thumbnailUrl.trim();
      else delete row.thumbnailUrl;

      // eslint-disable-next-line no-console -- 確認用
      console.log(
        editingId ? "[ASMR post updated]" : "[ASMR post created]",
        row
      );

      if (editingId) {
        const ok = replacePostedReviewInStorage({ ...row, id: editingId });
        if (!ok) {
          setSubmitError("更新に失敗しました。一覧を更新して再度お試しください。");
          reloadSavedList();
          return;
        }
        setSaveNotice("更新しました。");
        resetFormForNew();
      } else {
        appendPostedReviewToStorage(row);
        setSaveNotice("新規保存しました。下の一覧に反映されています。");
        resetFormForNew();
      }

      reloadSavedList();
      setTimeout(() => setSaveNotice(null), 4000);
    },
    [
      body,
      contentMode,
      dlsiteUrl,
      editingId,
      editingOriginalKind,
      ratingValue,
      reloadSavedList,
      thumbnailUrl,
      title,
    ]
  );

  const sortedSaved = [...savedList].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-900 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.1),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2 bg-[radial-gradient(circle_at_bottom,rgba(30,41,59,0.85),transparent)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center text-sm font-medium text-sky-300 underline-offset-4 hover:text-sky-200 hover:underline"
        >
          ← トップへ戻る
        </Link>

        <header className="mt-8 border-b border-slate-700/50 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-400/90">
            owner
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            投稿フォーム
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
            この URL は{" "}
            <code className="rounded border border-slate-600/55 bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-sky-200/90">
              /admin
            </code>{" "}
            です。内容はこのブラウザの localStorage に保存され、トップの一覧に表示されます。保存済みの投稿を編集・削除できます。
          </p>
        </header>

        {!unlocked ? (
          <section className="mt-10 rounded-2xl border border-slate-600/60 bg-slate-800/65 p-6 shadow-xl shadow-slate-950/30 backdrop-blur-sm sm:p-8">
            <h2 className="text-lg font-semibold text-slate-100">
              アクセス制限
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              続行するにはパスワードを入力してください。
            </p>
            {!ADMIN_PASSWORD && (
              <p className="mt-3 text-sm text-amber-300/90" role="status">
                公開リポジトリ用にパスワードはコードに含めていません。デプロイ時は{" "}
                <code className="rounded border border-amber-600/40 bg-slate-900/80 px-1 font-mono text-xs">
                  NEXT_PUBLIC_ADMIN_PASSWORD
                </code>{" "}
                を設定してください。
              </p>
            )}
            <form className="mt-6 space-y-4" onSubmit={handleUnlock}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">
                  パスワード
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={gatePassword}
                  onChange={(ev) => setGatePassword(ev.target.value)}
                  className="w-full rounded-xl border border-slate-600/70 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="••••"
                />
              </label>
              {gateError && (
                <p className="text-sm text-red-400" role="alert">
                  {gateError}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition hover:from-sky-400 hover:to-cyan-500 sm:w-auto"
              >
                開く
              </button>
            </form>
          </section>
        ) : (
          <div className="mt-10 space-y-10">
            {saveNotice && (
              <div
                className="rounded-xl border border-emerald-700/50 bg-emerald-950/50 px-4 py-3 text-center text-sm font-medium text-emerald-200"
                role="status"
              >
                {saveNotice}
              </div>
            )}

            <>
            <section className="rounded-2xl border border-slate-600/60 bg-slate-800/50 p-5 shadow-lg sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-sky-100">
                    保存済みの投稿（このブラウザ）
                  </h2>
                  <p className="text-sm text-slate-500">
                    {sortedSaved.length} 件
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetFormForNew}
                  className="min-h-10 rounded-lg border border-slate-600/70 px-3 text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  新規作成に切り替え
                </button>
              </div>

              {sortedSaved.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  まだありません。下のフォームから追加してください。
                </p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {sortedSaved.map((p) => {
                    const k = effectivePostKind(p);
                    const isEditing = editingId === p.id;
                    return (
                      <li
                        key={p.id}
                        className={[
                          "rounded-xl border px-4 py-3",
                          isEditing
                            ? "border-sky-500/50 bg-sky-950/25"
                            : "border-slate-600 bg-slate-900/45",
                        ].join(" ")}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase tracking-wider text-sky-400/90">
                              {postedKindLabel(k)}
                            </p>
                            <p className="mt-1 font-medium text-slate-100 line-clamp-2">
                              {p.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(p.publishedAt).toLocaleString("ja-JP")}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => loadPostForEdit(p)}
                              className="min-h-10 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-500"
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              className="min-h-10 rounded-lg border border-red-900/60 bg-red-950/30 px-3 text-sm font-medium text-red-300 hover:bg-red-950/50"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {editingId && (
              <p className="rounded-lg border border-sky-700/40 bg-sky-950/30 px-4 py-2 text-sm text-sky-100">
                編集中です。「レビュー」に切り替えると星評価を変更できます。元が筆者投稿・メカニズムの場合、ラジオは「記事」側に見えますが、保存時は元の区分を保ちます（「レビュー」に変えた場合はレビューに変わります）。
              </p>
            )}

            <form
              className="space-y-10 rounded-2xl border border-slate-600/45 bg-slate-800/50 p-6 shadow-xl shadow-slate-950/30 backdrop-blur-md sm:p-8"
              onSubmit={handleSubmit}
            >
              <section className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight text-sky-100">
                  種類
                </h2>
                <p className="text-sm text-slate-400">
                  レビュー（星あり）か記事（星なし）かを選びます。
                </p>
                <fieldset className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-600/70 bg-slate-900/80 px-4 py-3 has-[:checked]:border-sky-500/55 has-[:checked]:bg-sky-950/30">
                    <input
                      type="radio"
                      name="contentMode"
                      checked={contentMode === "review"}
                      onChange={() => setContentMode("review")}
                      className="h-5 w-5 accent-sky-500"
                    />
                    <span className="text-sm font-medium text-slate-100">
                      レビュー（星あり・一覧の星フィルタ対象）
                    </span>
                  </label>
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-slate-600/70 bg-slate-900/80 px-4 py-3 has-[:checked]:border-sky-500/55 has-[:checked]:bg-sky-950/30">
                    <input
                      type="radio"
                      name="contentMode"
                      checked={contentMode === "article"}
                      onChange={() => setContentMode("article")}
                      className="h-5 w-5 accent-sky-500"
                    />
                    <span className="text-sm font-medium text-slate-100">
                      記事（星なし）※筆者投稿・メカニズムの編集時もこちら表示
                    </span>
                  </label>
                </fieldset>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight text-sky-100">
                  基本情報
                </h2>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">
                    {contentMode === "review" ? "タイトル（作品名）" : "タイトル"}
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(ev) => setTitle(ev.target.value)}
                    className="w-full rounded-xl border border-slate-600/70 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder={
                      contentMode === "review"
                        ? "作品名を入力"
                        : "記事のタイトル"
                    }
                    maxLength={300}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">
                    DLsite リンク（任意）
                  </span>
                  <input
                    type="url"
                    value={dlsiteUrl}
                    onChange={(ev) => setDlsiteUrl(ev.target.value)}
                    className="w-full rounded-xl border border-slate-600/70 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="https://www.dlsite.com/..."
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">
                    サムネイル画像 URL（任意）
                  </span>
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(ev) => setThumbnailUrl(ev.target.value)}
                    className="w-full rounded-xl border border-slate-600/70 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder="https://..."
                  />
                </label>
              </section>

              {contentMode === "review" && (
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold tracking-tight text-sky-100">
                    総合評価（1〜10）
                  </h2>
                  <StarRatingRow
                    label="総合評価"
                    value={ratingValue}
                    onChange={setRatingValue}
                  />
                </section>
              )}

              <section className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight text-sky-100">
                  本文（Markdown 可）
                </h2>
                <p className="text-sm text-slate-400">
                  詳細ページの「紹介文」欄には、保存時に本文の冒頭（最大約220文字）が自動で入ります。表紙下に画像を出したい場合は本文の先頭に{" "}
                  <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-sky-200/90">
                    ![説明](https://画像URL)
                  </code>{" "}
                  を置いてください（紹介文に含まれた部分までが表示対象になります）。
                </p>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-200">
                    本文
                  </span>
                  <textarea
                    value={body}
                    onChange={(ev) => setBody(ev.target.value)}
                    rows={16}
                    className="w-full resize-y rounded-xl border border-slate-600/70 bg-slate-900 px-4 py-3 font-mono text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    placeholder={`![表紙](https://...)\n\n## 所感\n\n**太字** やリストも使えます。`}
                  />
                </label>
              </section>

              {submitError && (
                <p className="text-sm text-red-400" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-700/50 pt-6 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (editingId) {
                      resetFormForNew();
                    } else {
                      router.push("/");
                    }
                  }}
                  className="min-h-12 rounded-xl border border-slate-600/70 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                >
                  {editingId ? "編集をやめる" : "トップへ戻る"}
                </button>
                <button
                  type="submit"
                  className="min-h-12 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 transition hover:from-sky-400 hover:to-cyan-500"
                >
                  {editingId ? "更新する" : "新規に保存"}
                </button>
              </div>
            </form>
            </>
          </div>
        )}
      </div>
    </main>
  );
}
