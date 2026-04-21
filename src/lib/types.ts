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
  /** 任意。指定時は記事ヘッダーの表紙画像をこの URL へリンク（アフィリエイト用） */
  coverAffiliateHref?: string;
  /** レビューのみ意味あり。記事は 0 */
  ratingValue: number;
  ratingBest?: number;
  itemName: string;
  itemDescription?: string;
  authorName: string;
  publishedAt: string;
  /**
   * 任意。本番で一覧・詳細に出す開始時刻。
   * - `YYYY-MM-DD` … その日の UTC 0:00 以降。
   * - ISO 8601 日時 … その瞬間以降（日本時間で指定するなら `2026-04-18T13:59:00+09:00` のように `+09:00` を付与）。
   * 未指定なら常に表示。未到来は一覧・詳細から除外。ローカルで予約前も見たいときは `REVIEW_IGNORE_GO_LIVE=true`。
   */
  goLiveAt?: string;
  affiliateLinks: AffiliateLink[];
  /** 詳細ページ末尾の「次の記事」用（フロントマター `nextSlug`） */
  nextSlug?: string;
  /**
   * 任意。「## 作品感想」見出しの右に、LINE のトプ画のような丸アイコンを並べる。
   * `coverImage` と同じく `/` 始まりの public パスまたは http(s) URL。
   */
  workImpressionAvatar?: string;
  /**
   * 任意（DLsite 作品では推奨）。`data/products.json` の `id`（例 RJ01517030）と一致させる。
   * 一覧カードの税込・セール表示と詳細の価格パネルで使う。新規レビューでは `products.json` に **`id` + 作品 `url`** を追加し、**`npm run update-prices`** でサイトから価格を取り込む（執筆ガイド・`data/README.md`）。
   * 一覧の価格表示を止める: `NEXT_PUBLIC_SHOW_DL_PRODUCT_PRICES=false`。
   */
  dlsiteProductId?: string;
  /**
   * `true` のときのみ `/welcome/tiktok`・`/welcome/youtube` 等の外部 SNS 向け流入ページに掲載する。
   * 18 禁に該当しない一般向け記事にだけ付与する。
   */
  safeForExternalLanding?: boolean;
};
