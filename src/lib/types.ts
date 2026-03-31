export type AffiliateVendor = "dlsite" | "amazon";

export type AffiliateLink = {
  vendor: AffiliateVendor;
  href: string;
  /** 表示ラベル（未指定時はベンダー既定） */
  label?: string;
  /** 将来: API連携でセール等のバッジ用 */
  badgeText?: string;
};

/** `article` は星なしの解説記事。省略時は `review`（従来どおり） */
export type ReviewContentKind = "review" | "article";

export type Review = {
  slug: string;
  /** `article` のとき一覧は「記事」欄、星・JSON-LD レビューは出さない */
  contentKind: ReviewContentKind;
  title: string;
  /** メタ・OGP 用。Markdown 可（画像は `![](url)`、URL は http(s) または / で始まるパス） */
  summary: string;
  /** Markdown フロントマターで自由に定義（一覧のタグフィルタは全記事から自動集約） */
  tags: string[];
  body: string;
  /** 一覧・記事ヘッダー用。`public` なら先頭 `/`（例 `/content/cover.jpg`）。外部 URL も可 */
  coverImage?: string;
  /** レビューのみ意味あり。記事は 0 */
  ratingValue: number;
  ratingBest?: number;
  itemName: string;
  itemDescription?: string;
  authorName: string;
  publishedAt: string;
  affiliateLinks: AffiliateLink[];
};
