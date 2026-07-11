import Link from "next/link";

/** 購入・アフィリエイト導線の直上に置く一行開示 */
export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-slate-500 sm:text-[11px] ${className}`}>
      当サイトの購入リンクはアフィリエイトを含みます。詳細は
      <Link
        href="/disclaimer/"
        className="text-sky-400/90 underline decoration-sky-500/40 underline-offset-2 transition hover:text-sky-300"
      >
        免責事項
      </Link>
      をご確認ください。
    </p>
  );
}
