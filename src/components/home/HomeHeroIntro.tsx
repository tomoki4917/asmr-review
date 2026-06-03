import { SITE_NAME_R18 } from "@/lib/site-brand";

type HomeHeroIntroProps = {
  /** 省略時は SITE_NAME_R18（ムキネコ解析室） */
  siteName?: string;
};

/**
 * トップおよび「次サイト」草案で共通利用する、サイト冒頭（キャッチ〜説明2行）。
 */
export function HomeHeroIntro({ siteName = SITE_NAME_R18 }: HomeHeroIntroProps) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
        hypnosis · ASMR · psychology
      </p>
      <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
        {siteName}
      </h1>
      <div className="mx-auto mt-6 flex max-w-4xl items-center justify-center gap-3 sm:gap-4">
        <span
          aria-hidden
          className="h-px w-10 bg-gradient-to-r from-transparent via-sky-300/70 to-transparent sm:w-16"
        />
        <p className="whitespace-nowrap text-lg font-semibold leading-relaxed tracking-[0.03em] text-slate-100 sm:text-2xl">
          <span className="bg-gradient-to-r from-sky-100 via-cyan-200 to-teal-200 bg-clip-text text-transparent [text-shadow:0_0_18px_rgba(56,189,248,0.18)]">
            あなたに、最高の没入と、心穏やかな時間を。
          </span>
        </p>
        <span
          aria-hidden
          className="h-px w-10 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent sm:w-16"
        />
      </div>
      <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
        業界初 音声作品を多角的なツールを用い徹底解析
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
        解析結果と主観を照合しユーザーが求める最適な作品を紹介します。
      </p>
    </>
  );
}
