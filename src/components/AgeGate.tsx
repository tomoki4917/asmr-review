"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "asmr_review_age_verified_until_v3";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function getVerifiedUntil(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AgeGate() {
  const [isReady, setIsReady] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const now = useMemo(() => Date.now(), []);

  useEffect(() => {
    const verifiedUntil = getVerifiedUntil();
    if (verifiedUntil && verifiedUntil > now) {
      setIsVerified(true);
    }
    setIsReady(true);
  }, [now]);

  const handleConfirm = () => {
    const verifiedUntil = Date.now() + NINETY_DAYS_MS;
    window.localStorage.setItem(STORAGE_KEY, String(verifiedUntil));
    setIsVerified(true);
  };

  const handleDeny = () => {
    window.location.href = "https://www.google.com/";
  };

  if (!isReady || isVerified) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <h2 className="text-3xl font-semibold text-slate-100">年齢確認</h2>
        <p className="mt-6 text-2xl leading-relaxed text-slate-300">
          このサイトには成人向け（R18）の情報が含まれます。
        </p>
        <p className="mt-4 text-2xl font-semibold leading-relaxed text-slate-200">
          あなたは18歳以上ですか？
        </p>
        <p className="mt-6 text-base leading-8 text-slate-400">
          「はい」を選ぶと、本サイトのR18関連情報を含む全コンテンツにアクセスできます。
        </p>
        <p className="mt-1 text-base leading-8 text-slate-400">
          選択は90日間、お使いのブラウザに記憶されます。
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-xl bg-sky-500 px-6 py-4 text-xl font-semibold text-white transition hover:bg-sky-400"
          >
            はい、18歳以上です
          </button>
          <button
            type="button"
            onClick={handleDeny}
            className="w-full rounded-xl border border-slate-600 px-6 py-4 text-xl font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            いいえ、18歳未満です
          </button>
        </div>
      </div>
    </div>
  );
}
