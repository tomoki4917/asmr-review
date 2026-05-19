"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SITE_NEXT_DRAWER_LINKS } from "@/lib/site-next-draft-links";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="M20 20l-4.35-4.35" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** 次サイト草案：ロゴ｜タイトル｜検索・ホーム・メニュー */
export function DevSiteNextHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <header className="relative border-b border-slate-600/45 bg-slate-900/40">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-3 sm:max-w-xl sm:px-4">
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-500/60 bg-slate-800/60 text-[10px] font-bold text-slate-400 transition hover:border-sky-500/40 hover:text-sky-200"
          aria-label="トップ（ロゴ仮置き）"
        >
          ロゴ
        </Link>
        <p className="min-w-0 flex-1 text-center text-sm font-bold tracking-tight text-slate-50 sm:text-base">
          催眠音声解析室
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/#reviews-heading"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-200"
            aria-label="検索・一覧へ"
          >
            <SearchIcon className="h-5 w-5" />
          </Link>
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-200"
            aria-label="トップへ"
          >
            <HomeIcon className="h-5 w-5" />
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800/80 hover:text-sky-200"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label="メニューを開く"
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id={menuId}
          className="absolute right-2 top-full z-20 mt-1 min-w-[13.5rem] rounded-xl border border-slate-600/50 bg-slate-900/95 py-2 shadow-xl shadow-slate-950/50 ring-1 ring-white/5 backdrop-blur-md sm:right-4"
          aria-label="サイトメニュー"
        >
          <ul>
            {SITE_NEXT_DRAWER_LINKS.map(({ title, href }) => (
              <li key={href + title}>
                <Link
                  href={href}
                  className="block px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800/80 hover:text-sky-200"
                  onClick={() => setOpen(false)}
                >
                  {title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
