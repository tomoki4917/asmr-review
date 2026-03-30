const INSIGHTS = [
  {
    title: "副交感神経と「落ち着き」",
    body: "穏やかな声や一定のリズムは、身体の副交感神経優位を助けやすく、心拍や呼吸がゆるむ感覚と結びつきやすいと言われます。個人差は大きいですが、「安心して委ねられる」体験の土台になります。",
  },
  {
    title: "注意の配分と没入",
    body: "囁きや耳元の定位は注意を狭く引きつけ、雑念が減る状態（いわゆる没入）を招きやすいです。作品ごとの作り手の意図と、自分の好みが噛み合うと「はまる」感覚が強まります。",
  },
  {
    title: "期待と placebo 様の効き方",
    body: "「これで眠れる」「気持ちよくなる」という期待そのものが、体験の質を底上げすることがあります。レビューや紹介文は、その期待を適切に整える手がかりにもなります。",
  },
  {
    title: "心理的距離と安全",
    body: "フィクションとしての距離感があると、現実の人間関係よりリスクを感じにくく、リラックスしやすい場合があります。自分の境界線と相性を見ながら作品を選ぶのがおすすめです。",
  },
] as const;

export function PsychologyInsightsSection() {
  return (
    <section
      id="psychology-insights"
      aria-labelledby="psychology-insights-heading"
      className="mx-auto mt-16 max-w-5xl scroll-mt-28"
    >
      <div className="rounded-3xl border border-slate-600/45 bg-slate-800/45 p-6 shadow-lg shadow-slate-950/20 backdrop-blur-md sm:p-10">
        <h2
          id="psychology-insights-heading"
          className="text-center text-xl font-bold tracking-tight text-sky-200 sm:text-2xl"
        >
          心理学的に読み解く
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
          医学的効果を保証するものではありません。音声体験を楽しむための、一般的な心理メカニズムのメモです。
        </p>
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {INSIGHTS.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-slate-600/40 bg-slate-800/50 p-5 sm:p-6"
            >
              <h3 className="text-base font-semibold text-sky-200/95">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
