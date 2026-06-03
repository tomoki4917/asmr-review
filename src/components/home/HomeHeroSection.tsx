import { HomeDevShortcutPanel } from "@/components/home/HomeDevShortcutPanel";
import { HomeHeroIntro } from "@/components/home/HomeHeroIntro";
import { SITE_NAME_R18 } from "@/lib/site-brand";

type HomeHeroSectionProps = {
  /** 省略時は SITE_NAME_R18（ムキネコ解析室） */
  siteName?: string;
};

/**
 * トップ・全年齢トップで共通のサイト冒頭（キャッチ〜説明2行＋開発時ショートカット）。
 */
export function HomeHeroSection({ siteName = SITE_NAME_R18 }: HomeHeroSectionProps) {
  const devHero = process.env.NODE_ENV === "development";

  if (devHero) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-600/50 bg-gradient-to-b from-slate-900/50 to-slate-950/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-8">
        <header className="mx-auto max-w-3xl text-center">
          <HomeHeroIntro siteName={siteName} />
        </header>
        <HomeDevShortcutPanel />
      </div>
    );
  }

  return (
    <header className="mx-auto max-w-3xl text-center">
      <HomeHeroIntro siteName={siteName} />
    </header>
  );
}
