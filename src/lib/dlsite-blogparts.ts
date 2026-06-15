/** DLsite ブログパーツ（ランキング）の `query.period` 値 */
export type DlsiteRankingPeriod = "day" | "week" | "month" | "year" | "total";

export type DlsiteBlogpartsSite = "home" | "maniax";

export const DLSITE_RANKING_PERIOD_OPTIONS: ReadonlyArray<{
  value: DlsiteRankingPeriod;
  label: string;
}> = [
  { value: "day", label: "24時間ランキング" },
  { value: "week", label: "7日間ランキング" },
  { value: "month", label: "1ヶ月間ランキング" },
  { value: "year", label: "当年ランキング" },
  { value: "total", label: "累計ランキング" },
] as const;

export const DEFAULT_DLSITE_RANKING_PERIOD: DlsiteRankingPeriod = "week";

export const DLSITE_SALES_RANKING_SECTION_TITLE =
  "全年齢向けDLサイト内販売数ランキング";

export const DLSITE_SALES_RANKING_SECTION_TITLE_MANIAX =
  "成人向けDLサイト内販売数ランキング";

export function dlsiteSalesRankingSectionTitle(
  site: DlsiteBlogpartsSite
): string {
  return site === "maniax"
    ? DLSITE_SALES_RANKING_SECTION_TITLE_MANIAX
    : DLSITE_SALES_RANKING_SECTION_TITLE;
}

/** サイドバー用（例: DLサイト内での販売本数7日間ランキングです） */
export function dlsiteSalesRankingDescription(period: DlsiteRankingPeriod): string {
  const label =
    DLSITE_RANKING_PERIOD_OPTIONS.find((o) => o.value === period)?.label ??
    "ランキング";
  const term = label.replace(/ランキング$/, "").trim() || label;
  return `DLサイト内での販売本数${term}ランキングです`;
}

export const DEFAULT_DLSITE_BLOGPARTS_AID =
  process.env.NEXT_PUBLIC_DLSITE_AFFILIATE_AID?.trim() || "reviewLab";

/** DLsite 発行の 7日間ランキング（全年齢 home） */
export const DLSITE_WEEK_RANKING_BLOGPARTS_INLINE_HOME = `blogparts={"base":"https://www.dlsite.com/","type":"ranking","site":"home","query":{"period":"week"},"title":"ランキング","display":"vertical","detail":"1","column":"h","image":"small","count":"5","wrapper":"1","autorotate":true,"aid":"reviewLab"}`;

/** DLsite 発行の 7日間ランキング（18禁同人 maniax） */
export const DLSITE_WEEK_RANKING_BLOGPARTS_INLINE_MANIAX = `blogparts={"base":"https://www.dlsite.com/","type":"ranking","site":"maniax","query":{"period":"week"},"title":"ランキング","display":"vertical","detail":"1","column":"h","image":"small","count":"3","wrapper":"1","autorotate":true,"aid":"reviewLab"}`;

/** @deprecated `DLSITE_WEEK_RANKING_BLOGPARTS_INLINE_HOME` を使用 */
export const DLSITE_WEEK_RANKING_BLOGPARTS_INLINE =
  DLSITE_WEEK_RANKING_BLOGPARTS_INLINE_HOME;

export type DlsiteRankingBlogpartsConfig = {
  base: string;
  type: "ranking";
  site: DlsiteBlogpartsSite;
  query: { period: DlsiteRankingPeriod };
  title: string;
  display: "vertical";
  detail: string;
  column: "h";
  image: "small";
  count: string;
  wrapper: string;
  autorotate: boolean;
  aid: string;
};

export function buildDlsiteRankingBlogpartsConfig(options: {
  period: DlsiteRankingPeriod;
  site?: DlsiteBlogpartsSite;
  aid?: string;
  count?: number;
}): DlsiteRankingBlogpartsConfig {
  return {
    base: "https://www.dlsite.com/",
    type: "ranking",
    site: options.site ?? "home",
    query: { period: options.period },
    title: "ランキング",
    display: "vertical",
    detail: "1",
    column: "h",
    image: "small",
    count: String(options.count ?? 5),
    wrapper: "1",
    autorotate: true,
    aid: options.aid ?? DEFAULT_DLSITE_BLOGPARTS_AID,
  };
}

/** DLsite 公式タグと同じ `blogparts={...}` 1行（JSON.stringify 不使用） */
export function serializeDlsiteRankingBlogpartsInline(
  config: DlsiteRankingBlogpartsConfig
): string {
  if (
    config.site === "home" &&
    config.query.period === "week" &&
    config.aid === "reviewLab" &&
    config.title === "ランキング" &&
    config.count === "5"
  ) {
    return DLSITE_WEEK_RANKING_BLOGPARTS_INLINE_HOME;
  }

  if (
    config.site === "maniax" &&
    config.query.period === "week" &&
    config.aid === "reviewLab" &&
    config.title === "ランキング" &&
    config.count === "3"
  ) {
    return DLSITE_WEEK_RANKING_BLOGPARTS_INLINE_MANIAX;
  }

  return (
    `blogparts={"base":"${config.base}","type":"${config.type}","site":"${config.site}",` +
    `"query":{"period":"${config.query.period}"},"title":"${config.title}",` +
    `"display":"${config.display}","detail":"${config.detail}","column":"${config.column}",` +
    `"image":"${config.image}","count":"${config.count}","wrapper":"${config.wrapper}",` +
    `"autorotate":${config.autorotate},"aid":"${config.aid}"}`
  );
}
