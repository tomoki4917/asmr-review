import Link from "next/link";

type Props = {
  title: string;
  intro: string;
  /** カテゴリ見出し横のアイコン（絵文字など） */
  emoji?: string;
  breadcrumb?: {
    href: string;
    label: string;
  };
};

/** カテゴリハブ用ヘッダー（パンくず → アイコン＋見出し → 説明） */
export function CategoryHubHeader({
  title,
  intro,
  emoji,
  breadcrumb,
}: Props) {
  return (
    <header className="border-b border-slate-600/45 pb-8 sm:pb-10">
      {breadcrumb ? (
        <nav aria-label="パンくず" className="text-xs text-slate-500">
          <Link
            href={breadcrumb.href}
            className="transition hover:text-sky-300"
          >
            {breadcrumb.label}
          </Link>
          <span className="mx-1.5 text-slate-600" aria-hidden>
            &gt;
          </span>
          <span className="text-slate-400">{title}</span>
        </nav>
      ) : null}

      <div
        className={`flex items-center gap-3 sm:gap-4 ${breadcrumb ? "mt-5" : "mt-0"}`}
      >
        {emoji ? (
          <span
            className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-xl border border-slate-600/45 bg-slate-800/55 text-[1.75rem] leading-none shadow-sm shadow-slate-950/30 sm:h-14 sm:w-14 sm:text-[1.95rem]"
            aria-hidden
          >
            {emoji}
          </span>
        ) : null}
        <h1 className="text-pretty text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.75rem]">
          {title}
        </h1>
      </div>

      <p className="mt-4 max-w-3xl whitespace-pre-line text-pretty text-sm leading-relaxed text-slate-300 sm:text-[0.9375rem] sm:leading-[1.75]">
        {intro}
      </p>
    </header>
  );
}
