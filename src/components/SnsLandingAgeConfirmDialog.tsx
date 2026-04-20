"use client";

import { useCallback, useEffect, useId } from "react";

const DEFAULT_DESCRIPTION =
  "先のページでは、サイト内の他のコンテンツと同様に、成人向けの表現や話題を含む場合があります。";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** モーダル本文。未指定時は記事遷移向けの文言 */
  description?: string;
};

export function SnsLandingAgeConfirmDialog({
  open,
  onClose,
  onConfirm,
  description = DEFAULT_DESCRIPTION,
}: Props) {
  const titleId = useId();

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-w-md rounded-2xl border border-slate-600/50 bg-slate-900 p-5 shadow-xl shadow-slate-950/40 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id={titleId}
          className="text-center text-base font-semibold text-slate-100 sm:text-lg"
        >
          18歳以上ですか？
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-slate-400 sm:text-sm">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-600/70 bg-slate-800/80 px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-700/80 sm:w-auto sm:min-w-[7rem]"
          >
            いいえ
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              handleClose();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-sky-500/50 bg-sky-600/90 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 sm:w-auto sm:min-w-[7rem]"
          >
            はい、18歳以上です
          </button>
        </div>
      </div>
    </div>
  );
}
