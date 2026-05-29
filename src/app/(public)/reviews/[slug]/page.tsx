import type { Metadata } from "next";
import BananaSlug from "github-slugger";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateButton, AffiliateButtonGroup } from "@/components/AffiliateButton";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewJsonLd } from "@/components/ReviewJsonLd";
import { ArticleNextNav } from "@/components/ArticleNextNav";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { StarRating } from "@/components/StarRating";
import { ReviewNewBadge } from "@/components/ReviewNewBadge";
import { ShinsakuBadge } from "@/components/ShinsakuBadge";
import { DlsitePricePanel } from "@/components/DlsitePricePanel";
import {
  REVIEW_DETAIL_MODE_BUTTON_LABEL,
  ReviewModeSwitcher,
} from "@/components/ReviewModeSwitcher";
import { resolveSocialPreviewImage, siteUrl } from "@/lib/og-metadata";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import {
  articlePublishedTimeIso,
  effectiveDisplayPublishedIsoDate,
  formatPublishedAtForList,
  formatSaleDateJapanese,
} from "@/lib/format-published-at";
import {
  getAllAgesReviews,
  getAllReviews,
  getAllSlugs,
  getReviewBySlug,
  isAllAgesReview,
  isReviewVisibleOnSite,
} from "@/lib/reviews";
import { extractDryWetCounts } from "@/lib/extractDryWetCounts";
import {
  splitBeforeAtRecommendedAudience,
  splitBodyAtFinalRating,
  splitRatingAtWorkIntroLabel,
  splitRestAfterWorkImpression,
  splitBodyForArticleMode,
} from "@/lib/split-review-body";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
  resolveDlsiteSaleDisplay,
} from "@/lib/dlsite-product-catalog";
import { resolveDlsiteAffiliateHref } from "@/lib/resolve-dlsite-affiliate-href";
import type { AffiliateLink, Review } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

function extractH2Headings(markdown: string): Array<{ label: string; id: string }> {
  const slugger = new BananaSlug();
  const rows: Array<{ label: string; id: string }> = [];
  const normalized = markdown.replace(/\r\n/g, "\n");
  const matches = normalized.matchAll(/^##\s+(.+)$/gm);
  for (const m of matches) {
    const label = (m[1] ?? "").trim();
    if (!label) continue;
    rows.push({ label, id: slugger.slug(label) });
  }
  return rows;
}

function formatGoLiveForReader(goLiveAt: string): string {
  const s = goLiveAt.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const iso = dateOnly.test(s) ? `${s}T00:00:00.000Z` : s;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return s;
  return new Date(t).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 文頭サマリー横。フロントマターのラベルをそのまま表示する */
function affiliateLinksHeader(links: AffiliateLink[]): AffiliateLink[] {
  return links;
}

/** 「総合評価」横ボタン用。先頭リンクのラベルを体験版導線に統一 */
function affiliateLinksBesideRating(links: AffiliateLink[]): AffiliateLink[] {
  return links.map((l, i) =>
    i === 0 ? { ...l, label: "体験版はこちら" } : l
  );
}

function normalizeZenkakuDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

function extractCircleName(markdown?: string): string | null {
  if (!markdown) return null;
  const normalized = markdown.replace(/\r\n/g, "\n");
  const m = normalized.match(/^- \*\*サークル：\*\*\s*(.+)$/m);
  if (!m?.[1]) return null;
  return m[1].replace(/\s*（.*?）\s*$/u, "").trim() || null;
}

/** フロントマター `circleName` があれば優先。なければ本文 `### 基本情報` のサークル行から抽出 */
function effectiveCircleName(review: Review): string | null {
  const fromFm = review.circleName?.trim();
  if (fromFm) {
    const cleaned = fromFm.replace(/\s*（.*?）\s*$/u, "").trim();
    return cleaned || null;
  }
  return extractCircleName(review.body);
}

function extractInductionRatioVector(markdown?: string): number[] {
  if (!markdown) return [];
  const normalized = markdown.replace(/\r\n/g, "\n");
  const block = normalized.match(/###\s*誘導構成比([\s\S]*?)(?:\n###\s|\n##\s|$)/);
  if (!block?.[1]) return [];

  const values: number[] = [];
  const lines = block[1].split("\n");
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (line.includes("---")) continue;
    const cells = line.split("|").map((v) => v.trim());
    // [0] が空、[1] 項目名、[2] 数値、[3] 説明、[4] が空 になる想定
    const valueRaw = cells[2];
    if (!valueRaw) continue;
    const n = Number(valueRaw);
    if (Number.isFinite(n)) values.push(n);
  }
  return values;
}

function inductionDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  const len = Math.min(a.length, b.length);
  if (len === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return sum / len;
}

function pickRelatedReviews(current: Review): Review[] {
  if (!current.body || current.contentKind !== "review") return [];
  const pool = isAllAgesReview(current) ? getAllAgesReviews() : getAllReviews();
  const all = pool.filter((r) => r.contentKind === "review" && r.slug !== current.slug);

  const currentCircle = effectiveCircleName(current);
  const currentVector = extractInductionRatioVector(current.body);

  return all
    .map((candidate) => {
      const circle = effectiveCircleName(candidate);
      const vector = extractInductionRatioVector(candidate.body);
      const sameCircle = currentCircle && circle ? circle === currentCircle : false;
      return {
        candidate,
        sameCircle,
        distance: inductionDistance(currentVector, vector),
      };
    })
    .sort((a, b) => {
      if (a.sameCircle !== b.sameCircle) return a.sameCircle ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return (
        Date.parse(b.candidate.publishedAt) - Date.parse(a.candidate.publishedAt)
      );
    })
    .slice(0, 4)
    .map((v) => v.candidate);
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) return { title: "見つかりません" };

  const title = reviewTitleSingleLine(review.title);
  const now = new Date();
  if (!isReviewVisibleOnSite(review, now)) {
    return {
      title: `${title}（公開予定）`,
      description: "このページは予約公開前です。",
      robots: { index: false, follow: false },
    };
  }

  const publishedTimeIso = articlePublishedTimeIso(review);
  const description =
    stripMarkdownForMeta(review.summary) || title;
  const url = `${siteUrl()}/reviews/${slug}/`;
  const { url: imageUrl, alt: imageAlt } = resolveSocialPreviewImage(review);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: publishedTimeIso,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) notFound();

  const now = new Date();
  if (!isReviewVisibleOnSite(review, now)) {
    const titleOne = reviewTitleSingleLine(review.title);
    const when = review.goLiveAt?.trim()
      ? formatGoLiveForReader(review.goLiveAt)
      : "予定時刻が設定されていません";
    return (
      <article className="mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> トップへ
        </Link>
        <header className="mt-8 rounded-3xl border border-amber-700/35 bg-slate-800/60 px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
            予約公開
          </p>
          <h1 className="mt-2 text-xl font-bold leading-snug text-slate-50 sm:text-2xl">
            {titleOne}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            このレビューはまだ公開開始前です。本文は公開日時以降に表示されます。
          </p>
          <p className="mt-3 text-sm tabular-nums text-slate-300">
            公開予定（目安）：{when}
          </p>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            本番（静的エクスポート）では<strong>ビルドを実行した瞬間</strong>が公開判定に使われます。予約時刻のあとに本番ビルドが走るまで本文は出ません（サーバーが時刻で切り替える方式ではありません）。日次は GitHub
            Actions が概ね JST 21:05・22:00 に Vercel へ再デプロイをかける想定です。出ないときは Actions の成否と、リポジトリの{" "}
            <code className="rounded bg-slate-900/80 px-1">VERCEL_DEPLOY_HOOK_URL</code>{" "}
            設定を確認してください。
          </p>
        </header>
      </article>
    );
  }

  const displayPublishedIso = effectiveDisplayPublishedIsoDate(
    review.publishedAt,
    review.goLiveAt
  );
  const displayPublishedLabel =
    formatPublishedAtForList(displayPublishedIso);

  const canonicalUrl = `${siteUrl()}/reviews/${review.slug}/`;
  const best = review.ratingBest ?? 10;

  const isArticle = review.contentKind === "article";
  const isDoujinReview =
    review.authorName === "同人音声レビュー室" ||
    review.authorName === "同人音声解析室" ||
    review.tags?.includes("同人音声") === true ||
    review.tags?.includes("全年齢同人") === true;
  const quickSpecTypeLabel = isDoujinReview ? "シチュエーション" : "誘導タイプ";
  const titleHasBreak = review.title.includes("\n");
  const nextReview = review.nextSlug
    ? getReviewBySlug(review.nextSlug)
    : undefined;

  const dlsiteProduct =
    !isArticle && review.dlsiteProductId != null
      ? getDlsiteProductById(review.dlsiteProductId)
      : undefined;
  const dlsiteSaleDisplay = dlsiteProduct
    ? resolveDlsiteSaleDisplay(dlsiteProduct)
    : undefined;

  const nowBadges = new Date();
  const showNewBadge = isReviewNewPublication(review, nowBadges);
  const showShinsakuBadge =
    !isArticle && isDlsiteProductShinsaku(dlsiteProduct, nowBadges);
  const showHeaderBadges = showNewBadge || showShinsakuBadge;
  const relatedReviews = pickRelatedReviews(review);

  const coverEl = (
    <ReviewCover
      coverImage={review.coverImage}
      alt={reviewTitleSingleLine(review.title)}
      slug={review.slug}
      priority
      variant="hero"
      className="rounded-none"
    />
  );

  const finalRatingSplit = review.body
    ? splitBodyAtFinalRating(review.body)
    : null;
  const articleModeSplit = review.body
    ? splitBodyForArticleMode(review.body)
    : null;
  const analysisDataMarkdown = articleModeSplit?.analysisDataMarkdown;
  const detailRestMarkdown =
    articleModeSplit?.detailRestMarkdown ?? finalRatingSplit?.rest ?? "";
  const restWorkSplit =
    detailRestMarkdown.trim().length > 0
      ? splitRestAfterWorkImpression(detailRestMarkdown)
      : null;
  const ratingParts = finalRatingSplit?.rating
    ? splitRatingAtWorkIntroLabel(finalRatingSplit.rating)
    : { core: "", workIntro: "" };
  const recommendedAudienceSplit =
    !isArticle && finalRatingSplit?.before
      ? splitBeforeAtRecommendedAudience(finalRatingSplit.before)
      : null;
  const showAffiliateBesideRating =
    Boolean(finalRatingSplit) && review.affiliateLinks.length > 0;
  const bodyH2Headings = review.body
    ? extractH2Headings(review.body).filter(
        (h) => h.label !== "作品名" && h.label !== "どんな人におすすめか"
      )
    : [];
  const finalRatingHeadingId =
    bodyH2Headings.find((h) => h.label === "総合評価")?.id ?? "final-rating-heading";
  const quickGuideBySlug: Record<
    string,
    {
      scoreLabel: string;
      oneLine: string;
      inductionType: string;
      voiceActor: string;
      majorFetish: string;
      kinkType: string;
      recommendedLevel?: string;
      recording: string;
      recommendedFor: string[];
      notRecommendedFor: string[];
      workImpressionParagraphs?: string[];
    }
  > = {
    "jinsei-senpai-koi-dorei-mind-control": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "先輩後輩ドラマで関係を固め、質問反復とトリガーで恋ドレイ化へ連れていく長尺マインドコントロール",
      inductionType: "洗脳系 / 服従・支配系 / 反復刷り込み系",
      voiceActor: "野上菜月",
      majorFetish: "主従関係 / 言葉責め / 耳舐め / 乳首責め / 前立腺責め",
      kinkType: "M推奨",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約163分",
      recommendedFor: [
        "先輩恋愛・恋ドレイシチュが好きな方",
        "質問反復・応答ループ誘導が好きな方",
        "乳首・前立腺・多層トリガーが好きな方",
      ],
      notRecommendedFor: [
        "短時間で即ピークだけを目指したい方",
        "主従化・所有モチーフに抵抗がある方",
      ],
    },
    "ryomimi-bug-kinshi-anji": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "「行っちゃダメ」の禁止暗示を両耳反復で快感トリガーに反転し、連続ピークから解除まで運ぶ約96分の実験型催眠",
      inductionType: "洗脳系 / 禁止暗示系 / 反復刷り込み系",
      voiceActor: "乙倉ゅい / 恋鈴桃歌",
      majorFetish: "禁止暗示 / 言葉責め / 脳イキ / 寸止め / 両耳責め",
      kinkType: "M推奨",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約96分40秒（バイノーラル・4パート）",
      recommendedFor: [
        "長尺で一気に落ちたい方",
        "禁止暗示・両耳反復誘導が好きな方",
        "否定語を快感トリガーに反転する帯が好きな方",
      ],
      notRecommendedFor: [
        "癒やし中心で聴きたい方",
        "高反復語に疲れやすい方",
      ],
    },
    "kyoku-mugen-zekkyou-count-chikuni": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "メトロノームを用いた催眠誘導で意識を集中させ、禁止暗示と短文トリガーを適用し、約56分の逆カウント終了時に乳首ドライを連発するカウント依存型。",
      inductionType: "反復刷り込み系 / カウント誘導系 / 双子定位系",
      voiceActor: "乙倉ゅい",
      majorFetish: "乳首責め / カウント責め / 双子定位 / ドライ絶頂 / 後催眠",
      kinkType: "M推奨",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約56分27秒（R-18本編・パッケージ表記／バイノーラル）",
      recommendedFor: [
        "乳首への暗示を軸に、深いトランスで脳イキを体験したい方",
        "カウントとトリガーで、乳首起点の絶頂を強く引き出したい方",
        "日常でも乳首の余韻がふと戻る感覚を味わいたい方",
      ],
      notRecommendedFor: [
        "興奮後の完全なリラックスを求める方",
        "ウェットな甘えや会話による快感を重視する方",
      ],
      workImpressionParagraphs: [
        "本作を聴き終えて、まず感じたのはその誘導の緻密さです。多層的なアプローチで意識が深く沈み込み、抗う間もなくトランス状態へと誘われる感覚は非常に印象的でした。特に、乳首への「カリカリ」というキラー暗示が強烈で、乳首の感覚を主軸に脳イキ型の絶頂へと強制的に導かれる体験は、まさに衝撃的と呼べるでしょう。カウントダウンによる焦らしと期待の演出も巧みで、快感が段階的に高まっていくのがよく分かります。",
        "この作品は、深い催眠状態での脳イキ体験を求める方に特におすすめしたい一本です。意識の変容を深く楽しみたい方や、乳首起点で強力な暗示による自律的な快感を味わいたい方には、間違いなく響くはずです。解除後も日常に乳首の余韻が残る後催眠暗示も特徴的で、作品世界への没入感を長く味わいたい方にも最適な作品だと私は思います。",
      ],
    },
    "kyokuon-hikyo-kaimin-esthe-salon": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "秘境の快眠エステで施術→耳かき添い寝→二人共通→蘭／杏指名分岐。極音監修の密着と耳舐めが軸で、安眠寄りの聴き方も残せる二人体制長編",
      inductionType: "エステ / 安眠 / 添い寝",
      voiceActor: "一之瀬りと / 陽向葵ゅか",
      majorFetish: "エステ / 耳かき / 添い寝 / 密着 / 耳舐め",
      kinkType: "ノーマル〜M向け",
      recording: "共通約1時間34分〜1時間44分＋指名1本／全5トラック約2時間8分",
      recommendedFor: [
        "キス・耳舐め・密着スキンシップを主役にしたい方",
        "添い寝・安眠寄りの聴き方もしたい方",
        "二人体制・指名分岐で蘭／杏の違いを楽しみたい方",
      ],
      notRecommendedFor: [
        "最後まで一気通貫で刺激だけ追い続けたい方",
        "単独キャラ一本道のみを好む方",
      ],
    },
    "futago-saimin-kanojo": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "双子がバイノーラルで挟み、寝たふり・無反応の禁止暗示のあと耳責めで感度を上げ、3カウント解禁と10→0で約65分、反応許可の快感へ回収する構成",
      inductionType: "リラックス系 / 禁止暗示系 / 反復カウント系",
      voiceActor: "音撫屋 かの仔",
      majorFetish: "双子責め / 耳舐め / バイノーラル / 寝たふり / 感度上昇",
      kinkType: "ノーマル〜M向け（我慢・禁止）",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間5分（本編5パート・バイノーラル）",
      recommendedFor: [
        "双子彼女に挟まれながら寝たふり我慢したい方",
        "左右同時の耳責めバイノーラルが好きな方",
        "禁止暗示とカウント回収の設計が好きな方",
      ],
      notRecommendedFor: [
        "物語の起伏や掛け合いを重視する方",
        "全身・複数部位の刺激を求める方",
      ],
    },
    "futarigake-saimin-melty-orgasm": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "安心導入ととろとろ本編のドライ波に、乳首・亀頭・耳の各パートでゼロ回収が続くふたりがけ甘系長尺",
      inductionType: "反復刷り込み系 / カウント誘導系 / 深化誘導系",
      voiceActor: "みもりあいの",
      majorFetish: "双子責め / キス責め / 乳首責め / 亀頭責め / 耳責め",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間40分（本編01〜09・バイノーラル）",
      recommendedFor: [
        "安心感の中で深く落ちたい方",
        "全身のとろける快感を求める方",
        "ドライオーガズムを体験したい方",
      ],
      notRecommendedFor: [
        "即効性の強い肉体刺激だけ欲しい方",
        "短時間で手軽に快感を味わいたい方",
      ],
      workImpressionParagraphs: [
        "フルトラの双子白（ふたりがけ）シリーズの一作で、みもりあいのさんの甘い声が「おかえりなさい」から聴き手を迎えてくれます。聴き終わった印象としては、安心と脱力を長く保ちながら、とろとろの快感を全身に溜めてドライオーガズムへ運ぶ、甘く幸せな一本だと感じました。",
        "本作は、リラックスと快感を同時に注ぐふたりがけ構成が特徴です。「ふにゃ」「とろとろ」の反復とカウントの合図で深度と高揚が重なり、催眠の感覚はわかるけどドライしたことない方におすすめな1本となっております。",
        "約1時間40分と長尺かつ全編ドライのみで、じっくり通しで聴いて絶頂を味わいたい人向けです。",
      ],
    },
    "unknown-hypno-daijobu-koe-ni-yudanete": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "環境・呼吸・往復深化を長尺で積み、幸福と快感の波を心象入力として重ねて覚醒まで処理する約110分の深催眠構成",
      inductionType: "リラックス系 / 深化反復系 / 同一化誘導系",
      voiceActor: "天知遥",
      majorFetish: "耳元囁き / 呼吸同期 / 心象快感 / ドライ絶頂 / 深催眠",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約1時間49分49秒（01〜06／バイノーラル本編）",
      recommendedFor: [
        "浅覚醒を挟む往復深化で深く沈みたい方",
        "「私はあなたの無意識」という同一化語りが刺さる方",
        "安眠分岐とR18本線を使い分けて聴きたい方",
      ],
      notRecommendedFor: [
        "短時間で即刺激を求める方",
        "強イベント連打を重視する方",
      ],
    },
    "kuchikou-saimin-count-trip-nouiki": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "約40分・吸気同期カウントと口唇イメージで脳イキを狙うカウント特化の口腔催眠",
      inductionType: "逆カウント系 / カウント誘導系 / 反復刷り込み系",
      voiceActor: "魔暗ヤミ",
      majorFetish: "カウント責め / 口唇責め / キスイメージ / 脳イキ / 催眠誘導",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約40分",
      recommendedFor: [
        "吸気同期カウントで深度が落ちやすい方",
        "口腔催眠・口唇・キスイメージが好きな方",
        "数字トリガーで脳イキを狙いたい方",
      ],
      notRecommendedFor: [
        "解除が短く余韻まで整えたい方",
        "ハードな肉体描写・淫語が主役の方",
      ],
      workImpressionParagraphs: [
        "「魔暗ヤミ」氏代表のサークル「暗闇Works」の処女作です。聴き終わった印象としては、非常に丁寧な誘導で、特に口腔催眠とカウントダウンを組み合わせた脳イキに特化した作品だと感じました。誘導手順が明確でわかりやすいため、催眠音声初心者の方にもおすすめできます。",
        "本作は、呼吸テンポと逆カウントを軸に、一度覚醒を挟んで再深化させるという、誘導に振り切った構成が特徴です。数字を追うことで自然と集中が高まり、口元の幻触とゼロの合図が脳内の高揚へと直結する仕組みは、まさに頭の中だけでイキたい方にぴったりでしょう。派手さよりも、安定した快感を求める方に強く響く一本だと思います。",
        "解除は明確ですが、少し単調なので余韻を楽しみたい方には少し物足りなく感じるかもしれません。丁寧な誘導なので快楽の再現性は高いと思います。",
        "処女作でありながら技術の高さがうかがえる1本です。",
      ],
    },
    "genkami-preview": {
      scoreLabel: "0.0 / 10（原紙プレビュー）",
      oneLine: "（未執筆 — 原紙の表示確認用）",
      inductionType: "（記入）",
      voiceActor: "（記入）",
      majorFetish: "（記入）",
      kinkType: "（記入）",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "（記入）",
      recommendedFor: [
        "（おすすめ1 — Gemini で記入）",
        "（おすすめ2 — Gemini で記入）",
        "（おすすめ3 — Gemini で記入）",
      ],
      notRecommendedFor: [
        "（合わない1 — Gemini で記入）",
        "（合わない2 — Gemini で記入）",
      ],
    },
    "asmr-saimin-aman-toro-lip": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "双子形式×耳舐めを駆使した時間対効果抜群の短尺高密度ASMR催眠",
      inductionType: "リラックス系 / 快感増幅系 / 反復刷り込み系",
      voiceActor: "みもりあいの／和水創太",
      majorFetish: "耳舐め / 囁き / 好意暗示 / 脳イキ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約32分09秒（本編30:39＋解除1:30／バイノーラル）",
      recommendedFor: [
        "短時間で催眠の快楽を味わいたい方",
        "感覚連動暗示や耳舐めが癖の方",
        "幸福系・脳イキの作品を求めている方",
      ],
      notRecommendedFor: [
        "物語調の作品を求めている方",
        "下半身中心のドライ絶頂を求めている方",
      ],
      workImpressionParagraphs: [
        "本作は総合計時間32分という短尺でありながら双子形式×耳舐めが特徴で技術が高密度で詰め込まれた作品という印象。",
        "耳を使った感覚連動暗示を駆使した誘導が特徴でタイトルに載せるだけあって耳舐めの技術は一級品です。丁寧に耳から開発されていき最終的には脳イキを目指す設計です。",
        "32分と催眠音声にしては短尺でありながらここまでの満足度を提供できる技術にはあっぱれとしかいいようがありません。",
        "男女両用なのも優しい点ですよね。「明日予定があるから夜更かしできないなぁ　でも催眠したい、、、」というシチュエーションの時に最適です。また集中が続かない催眠初心者の方、耳を開発したい方にもうってつけ、私が自信をもっておすすめできる1本です。",
      ],
    },
    "warui-inma-kanashiki-koufuku-nadenade-hagu": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "恋人導入で受容を作り、淫魔の幸福快感をナデナデとハグで重ね、背徳と甘さを同時に回収する幸福系脳イキ",
      inductionType: "ペーシング系 / 分画法系 / 反復刷り込み系",
      voiceActor: "みもりあいの／和水創太（女性向け）",
      majorFetish: "ナデナデ / ハグ / 幸福暗示 / 背徳シチュ / 憑依淫魔",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "本編約50分〜1時間50分（前半恋人導入〜後半幸福責め・分岐終端）",
      recommendedFor: [
        "幸福感で落ちたい方",
        "背徳と甘さのねじれが好きな方",
        "憑依淫魔の甘やかし調教シチュが好きな方",
      ],
      notRecommendedFor: [
        "物語の起伏や掛け合いを主役にしたい方",
        "強い肉体音や罵りで刺激したい方",
      ],
      workImpressionParagraphs: [
        "本作は、恋人の声と体で甘く包まれながら、背徳の幸福感に心を溶かされていく催眠音声だと感じました。ナデナデとハグの描写が触覚暗示として機能し、全身に幸福感が広がる独特の快感を体験できます。個人的には、射精を伴わない「幸せイキ」というコンセプトが明確で、精神的な充足感を求める方に向いていると思います。",
        "特に、淫魔が恋人の体を乗っ取り、イチャイチャから背徳のナデナデへ関係が書き換わる流れは印象的です。幸福語の反復と撫でのアンカリングで、抵抗より先に甘い没入へ寄せる手順が続きます。強いカウントや肉体刺激を主役にしないため、穏やかな誘導を好む方には合いやすい一本です。",
        "導入の恋人パートから終盤の分岐まで一本道でつながっており、救済ルートで心理負荷を調整できる点も安心材料です。聴き終わったあとの満足感が高く、幸福系脳イキの参照として再聴きしたくなる作品だと私は思います。",
      ],
    },
    "tenshi-akuma-souhan-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "天使と悪魔の二声を同時入力して判断軸を揺らし、連続ドライから終端セルフまで矛盾を快感へ転換する長尺構成",
      inductionType: "競合入力系 / 反復カウント系 / 二重誘導系",
      voiceActor: "野上菜月／花笠れい",
      majorFetish: "天使×悪魔 / 相反命令 / 連続ドライ / 終端セルフ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間42分54秒（01〜04／バイノーラル）",
      recommendedFor: [
        "二声掛け合いで没入したい方",
        "矛盾入力を快感に変換する設計が好きな方",
        "連続ドライ回収を段階的に体感したい方",
      ],
      notRecommendedFor: [
        "短時間で完結させたい方",
        "単線で分かりやすい誘導を好む方",
      ],
    },
    "time-rotor": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "約59分09秒。古典脱力のあと公園・繁華街・満員電車へ羞恥の強さを上げ、遅延許可と強度100%でドライ一回に収束させるリモコンローター屋外催眠（非バイノーラル）",
      inductionType: "リラックス系 / イメージ誘導系 / 段階深化系",
      voiceActor: "かの仔",
      majorFetish: "リモコンローター / 屋外羞恥 / 満員電車 / 遅延許可 / エロトランス",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）以上の方",
      recording: "約59分09秒（6パート・非バイノーラル）",
      recommendedFor: [
        "古典的な脱力誘導から入りたい方",
        "バレそうな緊張で快感を吊りたい方",
        "ローター操作と羞恥シチュが好きな方",
      ],
      notRecommendedFor: [
        "バイノーラル定位を主目的にしたい方",
        "短尺だけで刺激だけ欲しい方",
      ],
    },
    "sukisuki-surikomi-chudoku-onanie-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "呼吸同期と深化誘導で受容を固定し、「好き」「名前」「快感」の連結反復で条件付けを成立させて終盤ウェット回収へ収束する長尺構成",
      inductionType: "条件付け系 / 反復刷り込み系 / 深化誘導系",
      voiceActor: "御子柴泉",
      majorFetish: "刷り込み暗示 / 名前呼称 / オナニー指示 / 終端ウェット",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間19分03秒（Tr.1〜Tr.5／バイノーラル）",
      recommendedFor: [
        "言葉の条件付けを体感したい方",
        "長尺で段階的に上げたい方",
        "声への依存感を育てたい方",
      ],
      notRecommendedFor: [
        "短時間で回収したい方",
        "依存語彙の強さが苦手な方",
      ],
    },
    "nouiki-nohand-nouiki": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "導入・体づくり・空想回収・解除を一連化し、ノーハンド脳イキを再現工程として成立させる実践訓練型の催眠構成",
      inductionType: "訓練型 / 反復刷り込み系 / イメージ誘導系",
      voiceActor: "秋野かえで",
      majorFetish: "ノーハンド / 脳イキ / PC筋トレ / 空想セックス",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約55分（本編・4パート通し）",
      recommendedFor: [
        "ノーハンド・脳イキ実践型が好きな方",
        "イメージ誘導・空想セックスが好きな方",
        "PC筋・下腹部トレーニングが好きな方",
      ],
      notRecommendedFor: [
        "即刺激だけを求める方",
        "注意喚起の多い進行が苦手な方",
      ],
    },
    "kurayami-kodzukuri-noumitsu-shokubutsu-mesuiki": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "夢世界導入で受容を固定し、蜜・受粉の比喩トリガーを連続更新して連続メスイキへ積層回収する誘導主導構成",
      inductionType: "イメージ誘導系 / 反復刷り込み系 / 連続回収系",
      voiceActor: "魔暗ヤミ",
      majorFetish: "連続メスイキ / 受粉比喩 / 逆カウント / 夢催眠 / 愛語反復",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約51分",
      recommendedFor: [
        "夢世界・植物種孕シチュが好きな方",
        "呼吸・逆カウント誘導が好きな方",
        "蜜・受粉比喩・連続メスイキが好きな方",
      ],
      notRecommendedFor: [
        "短時間で回収したい方",
        "身体変容イメージが苦手な方",
      ],
    },
    "saimin-shinri-test-dame-iwakareru": {
      scoreLabel: "3.0 / 10",
      oneLine:
        "「ダメ」反復はあるが深化がなく実演中心。催眠としての完成度は低く、総合★3水準の駄作寄り",
      inductionType: "禁止反転系 / カリギュラ効果系 / 反復刷り込み系",
      voiceActor: "柚木つばめ",
      majorFetish: "禁止暗示 / 手コキ / フェラ / 中出し / お仕置き特典",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "本編約1時間49分（注意事項〜解除・5パート＋購入特典1）",
      recommendedFor: [
        "催眠の完成度は捨て、禁止反転フェチだけ聴きたい方",
        "実演・射精描写が主役でもよい方",
        "心理テストシチュが好きで安い完成度でもよい方",
      ],
      notRecommendedFor: [
        "催眠音声として満足したい方",
        "深いトランスや聴き終わりの再統合を重視する方",
        "同価格帯の催眠音声と比較して買う方",
      ],
      workImpressionParagraphs: [
        "率直に言うと、催眠音声としての出来は悪いと感じました。心理テストの体裁と「ダメ」反復はあるものの、誘導が短くすぐ手コキ・フェラ・中出しの実演へ流れ、没入も着地もほぼ期待できません。",
        "総合★3・満足度2.0の水準は妥当だと思います。禁止反転フェチを割り切って聴く以外ではおすすめしません。完成度や聴き終わりの満足を求めるなら、買わない方がよい作品です。",
        "サイト内の他作と比べても下限寄りで、駄作寄りの一本です。エロ実演だけを消費する用途なら使えますが、催眠として気持ちよさや再統合を重視する方には向きません。",
      ],
    },
    "futarigake-saimin-love-happy-orgasm": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "双子の左右定位と褒め反復で安心と快感を同時更新し、幸福感を保ったまま同調ピークへ積層回収する長尺構成",
      inductionType: "リラックス系 / 同調深化系 / 反復刷り込み系",
      voiceActor: "みもりあいの",
      majorFetish: "双子掛け合い / 褒め暗示 / 耳刺激 / 幸福ドライ / 愛語反復",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約1時間40分43秒",
      recommendedFor: [
        "双子ラブハピ幸福系シチュが好きな方",
        "往復深化・褒め誘導が好きな方",
        "耳刺激・愛語反復が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方",
        "強い支配語を求める方",
      ],
    },
    "hypno-forest-yousei-sumumori": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "草原ジャーニーと分画法で幻想世界へ沈み、妖精の香りと言葉の振動で敏感化するツインキャスト催眠",
      inductionType: "リラックス系 / ジャーニー誘導系 / 分画法・カウント系",
      voiceActor: "紅月ことね・椎那天",
      majorFetish: "ツインキャスト / 妖精・香り / 言葉の振動 / 飼い犬比喩 / イメージ絶頂",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約35分12秒",
      recommendedFor: [
        "ファンタジー森シチュが好きな方",
        "ジャーニー誘導・分画法が好きな方",
        "妖精・お兄ちゃん呼びが好きな方",
      ],
      notRecommendedFor: [
        "誘導を飛ばして快感帯だけを即食いしたい方",
        "単一声の一対一誘導だけを求める方",
      ],
    },
    "hypno-cloud": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "手を引くジャーニーで視界を奪い、雲の濃度とカウント増幅で性感を段階的に積むバイノーラル催眠",
      inductionType: "リラックス系 / ジャーニー誘導系 / カウント誘導系",
      voiceActor: "紗藤ましろ",
      majorFetish: "囁きバイノーラル / 霧・雲メタファ / ジャーニー追随 / 段階増幅カウント",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約46分16秒",
      recommendedFor: [
        "手を引く霧の旅シチュが好きな方",
        "ジャーニー誘導・段階カウントが好きな方",
        "囁きバイノーラル・雲メタファが好きな方",
      ],
      notRecommendedFor: [
        "導入・誘導を省いてエロ帯だけを即食いしたい方",
        "イヤホン視聴が難しい環境の方",
      ],
    },
    "hypno-multi-rape": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "複数声の同時入力で判断処理を飽和させ、二段カウントと数字トリガー反復で背徳寄りドライ回収を連鎖させる構成",
      inductionType: "コンフュージョン系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "沢野ぽぷら",
      majorFetish: "複数声囁き / 数字トリガー / 支配語彙 / 背徳ドライ / 覚醒解除",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約49分50秒",
      recommendedFor: [
        "背徳・敗北催眠シチュが好きな方",
        "コンフュージョン・二段カウント誘導が好きな方",
        "複数声囁き・数字トリガーが好きな方",
      ],
      notRecommendedFor: [
        "短尺で済ませたい方",
        "回避不能感が苦手な方",
      ],
    },
    "ijigen-trip-saimin": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "異次元フェスのクラブビートに意識を溶かし、本編後半の連続ドライへ落とすM向けトリップ催眠（リラックス運動・事前誘導は任意）",
      inductionType:
        "教育導入系 / 身体的誘導系 / 分割弛緩系 / 音楽同期系 / 集合的トランス系",
      voiceActor: "沢野ぽぷら・野上菜月",
      majorFetish:
        "クラブミュージック / フェス没入 / 分割弛緩 / 連続ドライ / M向け羞恥・公開",
      kinkType: "M向け",
      recommendedLevel:
        "上級トランス（脳イキは可能・ドライ絶頂は未達）以上の方",
      recording: "約2時間19分（販売ページ総再生時間）",
      recommendedFor: [
        "音楽フェス没入シチュが好きな方",
        "分割弛緩・音楽同期の誘導が好きな方",
        "音のトランス感で深い没入（変性意識）を求める音モノ好きの方",
      ],
      notRecommendedFor: [
        "甘々な癒し系・優しい誘導だけ欲しい方",
        "短時間で一度だけ済ませたい方",
      ],
    },
    "mayoigo-saimin-hypno-multi-rape": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "単独導入から多声展開へ段階移行し、予言カウントと耳舐め反復で先読み反応を連続回収するヒプノマルチ構成",
      inductionType: "反復刷り込み系 / カウント誘導系 / 多声展開系",
      voiceActor: "沢野ぽぷら",
      majorFetish: "多声囁き / 耳舐め / 連続絶頂 / 予言カウント / ドライオーガズム",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約64分",
      recommendedFor: [
        "迷い子・ヒプノマルチシチュが好きな方",
        "予言カウント・段階反復誘導が好きな方",
        "多声囁き・耳舐め反復が好きな方",
      ],
      notRecommendedFor: [
        "穏やかな単声催眠を求める方",
        "差分運用なしで短時間完結を重視する方",
      ],
    },
    "usotsuki-kouhai-suki-suki-seishin-shihai": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "演劇部後輩の演技好きで脱力と恋心を固定し、嘘告白の脳イキ連鎖と寸止め自動手コキのあとカウント射精まで追い込む長尺M精神支配催眠",
      inductionType: "好き条件づけ系 / 逆カウント系 / 自己暗示ループ系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "好き攻撃 / 嘘告白 / 寸止め / 自動手コキ / M煽り",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間3分（注意＋レクリ＋ドラマ＋本編＋解除）",
      recommendedFor: [
        "演劇部・嘘つき後輩シチュが好きな方",
        "好きループ・嘘告白反転が好きな方",
        "寸止め・自動手コキ追込が好きな方",
      ],
      notRecommendedFor: [
        "本気の純愛告白だけを求める方",
        "嘘弄り・寸止め屈辱に抵抗がある方",
      ],
    },
    "nisemono-genjitsu-anji": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "管理AIの逆進行解除で仮想と現実をリンクし、解放トリガーと触手多峰のあと家畜化反転まで追い込む長尺破滅願望M精神支配催眠",
      inductionType: "逆進行解除系 / 現実リンク系 / 解放トリガー反転系",
      voiceActor: "逢坂成美",
      majorFetish: "逆催眠 / 触手 / 解放トリガー / 連続絶頂 / 家畜化 / M煽り",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間2分（注意＋レクリ＋プロローグ＋本編＋解除）",
      recommendedFor: [
        "逆進行解除・現実リンク誘導が好きな方",
        "解放トリガー・触手多峰が好きな方",
        "破滅願望・家畜化反転シチュが好きな方",
      ],
      notRecommendedFor: [
        "救済・ハッピーエンドだけを求める方",
        "触手・搾取・背徳屈辱に抵抗がある方",
      ],
    },
    "unreal-hypno": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "膝枕とロケ音で日常同期を保ったまま非現実へ段階遷移し、音そのものを快感トリガーへ変換して耳刺激ドライへ回収する構成",
      inductionType: "リラックス系 / イメージ誘導系 / 音響同調系",
      voiceActor: "天知遥",
      majorFetish: "環境音催眠 / 膝枕導入 / 逆カウント / 耳刺激 / ドライ回収",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約1時間25分22秒（本編5＋フリートーク1）",
      recommendedFor: [
        "膝枕デート・非現実ロケシチュが好きな方",
        "環境音・イメージ誘導が好きな方",
        "音主導・耳刺激ドライが好きな方",
      ],
      notRecommendedFor: [
        "短尺で済ませたい方",
        "実演エロを中心に据えたい方",
      ],
    },
    "slime-musume-guchu-nouiki": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "捕食モチーフで受容を固定し、耳奥ASMRと逆カウント反復を統合して失神系脳イキを連続更新する超長尺構成",
      inductionType: "イメージ誘導系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "琴音有波（紅月ことね）",
      majorFetish: "スライム捕食 / 耳奥ASMR / 逆カウント / 失神脳イキ / 解除分離",
      kinkType: "M向け",
      recommendedLevel: "上級トランス（長尺・高密度・連続脳イキ回収が可能）以上の方",
      recording: "約2時間15分55秒（本編3＋解除1）",
      recommendedFor: [
        "捕食・スライム娘シチュが好きな方",
        "イメージ誘導・逆カウント反復誘導が好きな方",
        "耳奥ASMR・連続脳イキが好きな方",
      ],
      notRecommendedFor: [
        "短時間で済ませたい方",
        "捕食比喩が苦手な方",
      ],
    },
    "nohand-shasei-mahou-shoujo-mesuiki": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "即売会羞恥の状況固定と女装魔法少女化を並走させ、前立腺焦らしとカウント反復でノーハンド射精へ収束させる構成",
      inductionType: "イメージ誘導系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "涼花みなせ",
      majorFetish: "男の娘 / 女装魔法少女 / 前立腺責め / ノーハンド射精 / 公開羞恥",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約63分（本編・4パート通し）",
      recommendedFor: [
        "即売会・公開羞恥シチュが好きな方",
        "カウント・前立腺焦らし誘導が好きな方",
        "女装魔法少女・男の娘化が好きな方",
      ],
      notRecommendedFor: [
        "女装男の娘が苦手な方",
        "長いアフターを求める方",
      ],
    },
    "re-limit-marionette": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "主従固定と糸弛緩の身体上書きを土台に、「まだいけるよね」反復と多段カウントでドライ回収を連鎖させる構成",
      inductionType: "リラックス系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "涼花みなせ",
      majorFetish: "主従関係 / マリオネット化 / 寸止め / 多絶頂 / ドライ連鎖",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約72分（本編1ファイル通し）",
      recommendedFor: [
        "人形支配・マリオネットシチュが好きな方",
        "カウント・トリガー反復誘導が好きな方",
        "寸止め・多段ドライが好きな方",
      ],
      notRecommendedFor: [
        "同型反復が苦手な方",
        "短時間刺激だけ欲しい方",
      ],
    },
    "ts-mahou-shoujo-haiboku-shinai": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "捕縛と唾液汚染で受容を固定し、部位別カウント反復で敗北TSの身体自覚と快感を同時更新してドライ回収へ繋ぐ構成",
      inductionType: "イメージ誘導系 / 反復刷り込み系 / 関係固定系",
      voiceActor: "餅梨あむ",
      majorFetish: "敗北TS / 女体化 / 唾液汚染 / 関係固定 / ドライ絶頂",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約1時間30分28秒（5パート通し）",
      recommendedFor: [
        "魔法少女・先輩後輩シチュが好きな方",
        "カウント・部位反復誘導が好きな方",
        "敗北TS・身体改変描写が好きな方",
      ],
      notRecommendedFor: [
        "TSや身体改変が苦手な方",
        "反復の少ない短尺を求める方",
      ],
    },
    "dakimakura-kanojo-pretty-holic-yurukawa-kouhai": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "抱き枕から恋人まで一本道。小悪魔後輩のあまあま純愛イチャラブが、キス・耳舐めの密着のまま本編約2時間8分続く密着・添い寝ボイス",
      inductionType: "生徒会 / 抱き枕 / 後輩",
      voiceActor: "陽向葵ゅか",
      majorFetish: "抱き枕 / 生徒会 / 後輩 / 恋人",
      kinkType: "ノーマル〜M向け",
      recording: "本編約2時間8分（6パート）／【安眠用】約35分（総再生約2時間43分）",
      recommendedFor: [
        "あまあま・純愛の甘さを長尺で味わいたい方",
        "小悪魔後輩のからかいから恋人への関係の変化が好きな方",
        "キス・耳舐め・密着スキンシップを主役にしたい方",
      ],
      notRecommendedFor: [
        "オホ声や過激な喘ぎで一発の高揚だけを求める方",
        "最後まで一気通貫で刺激だけ追い続けたい方",
      ],
    },
    "dry-org-amadashi-prostate-nipple": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "甘出し反復で締めと抜きを学習させ、乳首・前立腺刺激とカウント暗示を同期して枯渇後ドライへ収束させる訓練型構成",
      inductionType: "リラックス系 / 反復刷り込み系 / 実践訓練系",
      voiceActor: "天音羽乃",
      majorFetish: "甘出し / 前立腺責め / 乳首責め / カウント暗示 / ドライ開発",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間28分46秒",
      recommendedFor: [
        "幼馴染訓練・開発シチュが好きな方",
        "甘出し・カウント誘導が好きな方",
        "前立腺・乳首同期が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方",
        "長尺の連続オナ指示が苦手な方",
      ],
    },
    "nouiki-trip-denpa-live": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "移動導入から可愛い反復・指合図・歌唱リズムを統合し、ライブ高揚を脳イキ回収へ一本線で接続する長尺構成",
      inductionType: "音響同調系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "野上菜月 / 陽向葵ゅか / そらまめ。 / 乙倉ゅい / 恋鈴桃歌 ほか",
      majorFetish: "ライブ催眠 / 可愛い反復 / 指トリガー / 脳イキ / 歌唱連結",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約2時間22分（本編・6パート通し）",
      recommendedFor: [
        "ライブ催眠シチュが好きな方",
        "指合図・反復カウント誘導が好きな方",
        "可愛い反復・歌唱連結が好きな方",
      ],
      notRecommendedFor: [
        "短尺で済ませたい方",
        "静かな囁きだけ欲しい方",
      ],
    },
    "nouiki-youko-noumimi": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "妖狐の情景導入と尻尾ASMRで深度を深め、脳イキから耳イキへ快感経路を切り替えて二段回収する約72分の通し構成",
      inductionType: "イメージ誘導系 / 音響同調系 / 反復刷り込み系",
      voiceActor: "そらまめ。 / 和水創太（女性向け）",
      majorFetish: "妖狐シチュ / 尻尾ASMR / 脳イキ / 耳イキ / 経路切替",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "本編約72分（プロローグ〜起床・6パート）",
      recommendedFor: [
        "脳と耳の二段回収を追いたい方",
        "尻尾ASMRと情景誘導が好きな方",
        "妖狐シチュと約束の回収が好きな方",
      ],
      notRecommendedFor: [
        "脳内侵入イメージが苦手な方",
        "純粋なドライオーガズムだけを求める方",
      ],
      workImpressionParagraphs: [
        "この作品は、まさにタイトル通りの「脳イキ」と「耳イキ」を深く味わえる催眠音声だと感じました。妖狐が語りかける物語形式で優しく導入され、緻密な言語暗示と多段深化によって、意識が深く溶解していく感覚が印象的です。頭の奥からとろけるような快感と、耳から押し寄せる極上の快感が感じられるでしょう。",
        "特に「脳イキ」や「耳イキ」に特化した体験を求めている方には、個人的に一度聴いてみてほしい作品です。狐の尻尾というユニークな設定が、頭部への快感集中を巧みに促し、焦らしとアンカリングで快感の予期を最大限に高めてくれます。特定の暗示とカウントダウンが、意識が快感に飲み込まれるほどの絶頂へと導く流れは秀逸です。",
        "導入で提示された「稲荷寿司の約束」という要素が、クライマックスから後味にかけて完璧な一本道のロジックで回収されるため、聴き終わった後の満足感は非常に高いです。中尺作品でありながら中盤に空転する部分が一切なく、すべてのパートがラストの約束回収へ向けて緻密に構成され、深い満足感と次への期待を抱かせる高水準の作品だと私は思います。",
      ],
    },
    "brain-washer": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "前室で運用条件を固定し、儀式語の反復と耳舐めを長尺で積層して深度を押し込み、専用解除まで一体化して完走させる洗脳儀式型",
      inductionType: "洗脳系 / 儀式反復系 / 耳刺激系",
      voiceActor: "逢坂成美",
      majorFetish: "洗脳ロールプレイ / 儀式語反復 / 耳舐め / 崇拝暗示 / 支配語彙",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約67分（販売総再生表記／01〜03-a・結合版は約1時間6分）",
      recommendedFor: [
        "儀式・同一語彙の反復で深まりたい方",
        "応答プロトコルで参加型に落ちたい方",
        "耳舐めと支配語を同期させたい方",
      ],
      notRecommendedFor: [
        "短尺で即ピークだけ欲しい方",
        "洗脳・崇拝など強い語感が苦手な方",
      ],
    },
    "futari-saimin-namahousou": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "約95分。二人の催眠生放送ドラマからバイノーラル二声へ入り、媚薬と人形の本編をスイ／メロで分岐しつつドライ二回へ収束させる長尺構成",
      inductionType: "ラジオ・生放送系 / 二声掛け合い系 / 分岐運用系 / 古典誘導系",
      voiceActor: "そらまめ。／沢野ぽぷら",
      majorFetish: "生放送 / 二声バイノーラル / 媚薬・人形 / 分岐本編 / エロトランス",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約95分（分岐含む公式表記・バイノーラル）",
      recommendedFor: [
        "掛け合いの生放送体裁で入りたい方",
        "二声定位を主戦場にしたい方",
        "分岐で手続きの強弱を選びたい方",
      ],
      notRecommendedFor: [
        "即深部のみを求める方",
        "二声同時入力の負荷が苦手な方",
      ],
    },
    "futarigake-saimin-coming-orgasm": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "双子の同期呼吸とリップ密集で能動を手放し、GoではなくComeとしてドライの波を迎える受動体験へ寄せる高密度バイノーラル",
      inductionType: "リラックス系 / バイノーラル快感系 / 受動受容系",
      voiceActor: "みもりあいの",
      majorFetish: "双子掛け合い / リップASMR / Come受容 / 淫紋・先端帯 / ドライ連鎖",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間8分32秒",
      recommendedFor: [
        "双子カミング受容シチュが好きな方",
        "双子同期・Come誘導が好きな方",
        "リップ密集・淫紋先端帯が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方",
        "淫紋・先端責めの刺激が苦手な方",
      ],
    },
    "futarigake-saimin-dry-iki-support": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "ふたりがけ同調で我慢・蓄積・解放を手順化し、ダイヤル・カウント・PC筋・前立腺を反復してドライ到達を支援する長尺サポート型",
      inductionType: "訓練支援型 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "みもりあいの",
      majorFetish: "ふたりがけ / 我慢蓄積 / 前立腺・PC筋 / ダイヤル暗示 / ドライ多段",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約3時間35分",
      recommendedFor: [
        "ふたりがけドライサポートシチュが好きな方",
        "我慢蓄積・カウント誘導が好きな方",
        "前立腺・PC筋開発が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方",
        "同型反復が苦手な方",
      ],
    },
    "inuka-anji-amatime-oshioki-wakarase": {
      scoreLabel: "6.0 / 10",
      oneLine:
        "甘やかしで受容した直後に犬化語尾と支配・寸止めへ切り替え、温度差と脳イキ反復を強くぶつける起伏型",
      inductionType: "ペットプレイ系 / 温度差切替系 / 寸止め反復系",
      voiceActor: "紫雲",
      majorFetish: "犬化暗示 / 甘辛切替 / 寸止め / 支配語 / 脳イキ",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約31分",
      recommendedFor: [
        "飼い主わからせ・犬化シチュが好きな方",
        "甘辛切替・寸止め誘導が好きな方",
        "犬化語尾・支配語彙が好きな方",
      ],
      notRecommendedFor: [
        "支配語・叱責が苦手な方",
        "深い誘導を長く味わいたい方",
      ],
    },
    "jigoku-hypno-multi-rape": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "多声で判断処理を飽和させ、誘導三段からエロ四連へ接続し、カウントと命令の反復圧でドライ回収を連鎖させる拘束型長尺",
      inductionType: "コンフュージョン系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "沢野ぽぷら",
      majorFetish: "多声拘束 / カウント圧迫 / 支配語彙 / ドライ四連 / 覚醒解除",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間47分",
      recommendedFor: [
        "拘束・敗北催眠シチュが好きな方",
        "コンフュージョン・三段カウント誘導が好きな方",
        "多声囁き・カウント圧迫が好きな方",
      ],
      notRecommendedFor: [
        "同型反復が苦手な方",
        "穏やかな情緒を求める方",
      ],
    },
    "oton-akachan-hipu-muryoku": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "保育所設定で大人の判断を外し、挨拶・語尾・命令反復で赤ちゃん化を通しで定着させ、服従報酬からウェット回収へ繋ぐ退行型",
      inductionType: "退行系 / 命令反復系 / 無力化系",
      voiceActor: "あやめ（先生役）",
      majorFetish: "育児退行 / 赤ちゃん化 / しつけ・授乳語彙 / 服従報酬 / ドライ・ウェット",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約70分（本編・3パート通し）",
      recommendedFor: [
        "保育所・上下関係シチュが好きな方",
        "命令反復・挨拶合図誘導が好きな方",
        "育児退行・授乳語彙が好きな方",
      ],
      notRecommendedFor: [
        "上下固定・無力化が苦手な方",
        "反復単調さを避けたい方",
      ],
    },
    "osananajimi-m-sei-mazo-saimin-play": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "呼び方トリガーと半覚醒分画法で深く落とし、パウダー責めから脳イキ・前立腺まで幼馴染M性感館で追い込む通し約2時間12分の催眠+Mプレイ",
      inductionType: "リラックス系 / 半覚醒分画法系 / 反復刷り込み系",
      voiceActor: "夢咲朱花",
      majorFetish:
        "幼馴染 / M性感 / パウダー責め / 脳イキ / 前立腺 / 半覚醒",
      kinkType: "ドM",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間12分（4パート通し）",
      recommendedFor: [
        "幼馴染M性感館シチュが好きな方",
        "半覚醒分画法・呼び方トリガー誘導が好きな方",
        "パウダー責め・脳イキ・前立腺責めが好きな方",
      ],
      notRecommendedFor: [
        "純愛だけ・穏やかな甘々が好きな方",
        "支配・羞恥プレイに抵抗がある方",
      ],
    },
    "miraiyochi-zeccho-countdown": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "未来予知の宣言と絶頂カウントを合図化し、先読み反応を快感増幅へ転換して連続ピークへ運ぶ二本立て催眠",
      inductionType: "予言トリガー系 / カウント誘導系 / 関係固定系",
      voiceActor: "陽向葵ゅか / みたかりん",
      majorFetish: "未来予知暗示 / 絶頂カウント / 教祖・崇拝 / キス責め / 脳イキ",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "kuroko.版 約104分 / サイミー版 約94分（二本立て）",
      recommendedFor: [
        "教祖・崇拝シチュが好きな方",
        "カウント・予言トリガー誘導が好きな方",
        "先読み反応を快感にしたい方",
      ],
      notRecommendedFor: [
        "穏やかな癒やしだけを求める方",
        "主従・崇拝の関係語が苦手な方",
      ],
    },
    "aku-no-soshiki-hero-akudachi-sennou-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "約2時間15分。背徳系の悪堕ち洗脳で、カウントと強い命令、言葉責めと身体感覚を長尺で組み合わせて深く運ぶ一本。",
      inductionType: "洗脳系 / 悪堕ち系 / 無力化系 / カウント誘導系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "悪堕ち / 洗脳 / 触手 / 薬液 / エナジー吸引 / 言葉責め",
      kinkType: "M向け",
      recommendedLevel: "中級（脳イキは可能だがドライ未達）以上の方",
      recording:
        "約2時間15分（波形ベースの通し尺／バイノーラル・触手SEあり本編）",
      recommendedFor: [
        "常識や倫理観を壊されるような、背徳的な快感を求めている人",
        "「3、2、1...」のカウントと、強い命令による確実な誘導を好む人",
        "言葉責めと身体的な感覚を組み合わせ、徐々に深い快楽へ導かれたい人",
      ],
      notRecommendedFor: [
        "長時間の強い刺激に疲れやすい人",
        "「触手・薬・悪役・強制的な無力化」という設定が苦手な人",
      ],
    },
    "zeccho-furi-karakai-kouhai-mazo-mesuiki-nohand": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "約1時間36分49秒。フリからマゾ確定へ落差を作り、『ダメ』系禁制と感度操作を経て初級編でノーハンド志向まで言語で収束させる学園バイノーラル催眠（ルート選択あり）",
      inductionType: "洗脳系 / 禁制反復系 / 感度操作系 / カウント誘導系",
      voiceActor: "架月らみゅ",
      majorFetish: "後輩からかい / マゾバレ / メスイキ / ノーハンド / 言葉責め / 学園",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・脱力まで可能）以上の方",
      recording: "約1時間36分49秒（初級編ルート6パート・バイノーラル）",
      recommendedFor: [
        "学園・後輩からかいシチュが好きな方",
        "禁止暗示・カウント反復誘導が好きな方",
        "言語トリガー・ノーハンド志向が好きな方",
      ],
      notRecommendedFor: [
        "短い命令や禁止の繰り返しに疲れやすい方",
        "屈辱設定やノーハンド絶頂に抵抗がある方",
      ],
    },
    "shinitagari-junai-maid-yogarekake": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "死にたがりのあなたを楓が止め続ける——きっかけは高校の廊下から。添い寝と認知シャッフル睡眠法まで続く全年齢純愛長編",
      inductionType: "メイド / 添い寝 / 純愛",
      voiceActor: "浅木ゆめみ",
      majorFetish: "メイド / 添い寝 / 純愛 / 安眠",
      kinkType: "ノーマル",
      recording: "本編8パート（プロローグ〜エピローグ）",
      recommendedFor: [
        "心の重さや孤独を抱えている方",
        "メイド／ご主人様シチュが好きな方",
        "眠れない夜に密着添い寝と甘い囁きを欲する方",
      ],
      notRecommendedFor: [
        "最後までテンポ高めの刺激だけを追い続けたい方",
        "バイノーラル定位や左右移動の音像演出を主目的にする方",
      ],
    },
    "michikusa-natsuna4-onsen-pokipoki-seitai": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "足湯で安心を先に置き、貸切温泉で大人向け洗いっこへ載せ替え、ポキポキと歯磨き・耳かきで睡眠導入へ収束する道草屋三本立て長編",
      inductionType: "温泉 / 足湯 / ポキポキ",
      voiceActor: "丹羽うさぎ / ルナ ほか",
      majorFetish: "温泉 / 足湯 / ポキポキ / 耳かき",
      kinkType: "ノーマル〜M向け",
      recording: "足湯＋貸切温泉＋ポキポキ／歯磨き・耳かき",
      recommendedFor: [
        "疲れた夜に旅館・足湯でほっこり癒されたい方",
        "道草屋の空気感とお客同士だからこその距離感が好きな方",
        "足湯・ポキポキ・三本立ての効果音勾配を通しで楽しみたい方",
      ],
      notRecommendedFor: [
        "純睡眠ASMRのみを求める方",
        "抻き・過激展開だけを主目的にする方、または短尺・単独キャラのみを好む方",
      ],
    },
    "mesugaki-succubus-onee-nntr-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "メスガキサキュバスに寝取られ、抵抗から快感への意識の往復に翻弄されながら、深い催眠と抗えない快楽へと誘われる寝取り催眠です。",
      inductionType: "恋の魔法系 / 半覚醒往復系 / 我慢カウント系",
      voiceActor: "夢咲朱花",
      majorFetish: "寝取り / メスガキ / サキュバス / 脳イキ / 射精",
      kinkType: "M向け〜寝取り",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約109分（オープニング〜解除 / 6パート）",
      recommendedFor: [
        "背徳感を快感に変えたい方",
        "執拗な反復暗示で深く落ちたい方",
        "脳イキと射精を強制回収されたい方",
      ],
      notRecommendedFor: [
        "意識の揺さぶりが苦手な方",
        "妹キャラの煽りや背徳感が苦手な方",
      ],
      workImpressionParagraphs: [
        "この作品は、メスガキサキュバスによる背徳的なシチュエーションが非常に魅力的で、聴き終わった後には深い没入感と独特の快感が残りました。「抵抗すればするほど気持ちよくなる」というコンセプトが秀逸で、倫理的な葛藤さえも快感へと昇華させる体験は、他ではなかなか味わえないでしょう。特に、刺激的なシチュエーションで深く堕ちたい方におすすめしたい一本です。",
        "誘導は聴覚集中から始まり、執拗な反復暗示と二重拘束、高密度なコンフュージョン誘導によって、リスナーは自然と深いトランス状態へと誘われます。緻密な快感設計により、トリガーワードや身体感覚の書き換え、乳首刺激とカウントダウンが組み合わされ、頭部への快感集中、いわゆる「脳イキ」や射精が強制的に回収される点も、本作の大きな強みだと感じました。",
      ],
      
      
      
    },
    "mimikaki-saimin": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "サロン規約で主導権を固定し、長尺の耳かき幸福感を核に終盤サービスと覚醒まで連結するバイノーラル催眠",
      inductionType: "リラクゼーション系 / 耳刺激集中系 / カウント誘導系",
      voiceActor: "伊ヶ崎綾香",
      majorFetish: "耳かき / サロン主導 / 膝枕 / 受動没入 / バイノーラル",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約79分",
      recommendedFor: [
        "サロン委ね・役割没入シチュが好きな方",
        "呼吸・カウント誘導が好きな方",
        "耳かき・サロン定位が好きな方",
      ],
      notRecommendedFor: [
        "耳かき描写や耳への接触が苦手な方",
        "短尺で即効性だけを求める方",
      ],
    },
    "higengo-saimin-giseigo-pavlov-another": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "首輪パートで条件付けと声のイメージを固め、擬声語パブロフで台詞をほぼ排したオノマトペ入力へ移す実験的バイノーラル催眠",
      inductionType: "条件付け系 / リラックス系 / 擬似複線定位・効果音系（擬声語パート）",
      voiceActor: "秋野かえで",
      majorFetish: "オノマトペ / 耳舐め（首輪パート） / 条件付け / ペット・ワンちゃん",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約61分8秒",
      recommendedFor: [
        "擬声語パブロフ・ペット化シチュが好きな方",
        "条件付け・オノマトペ誘導が好きな方",
        "耳舐め・声のイメージが好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方",
        "台詞で状況説明が無いと不安な方",
      ],
    },
    "saimin-jutsushi-itazura-hypno-show-stage": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "約78分48秒の通し本編として、ステージ仕込みから公開催眠ショー・心象誘導・長めエロ帯・カウント覚醒まで処理するリアルヒプノ系バイノーラル",
      inductionType: "公示ショー系 / イエスセット系 / 心象誘導系 / 段階深化系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "催眠ショー / MC視点 / バイノーラル / ステージ / エロトランス",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約78分48秒（バイノーラル・7パート）",
      recommendedFor: [
        "催眠ショー・ステージシチュが好きな方",
        "公示・イエスセット誘導が好きな方",
        "心象デモからエロ帯へ繋ぐ構成が好きな方",
      ],
      notRecommendedFor: [
        "公開・ショー体裁が苦手な方",
        "連続描写の負荷が高いと感じる方",
      ],
    },
    "low-tension-inma-uikkari-miyo-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "低テンションサキュバスとキャンプ肝試しで魅了事故→未了状態、言葉のドライ絶頂とサキュバス解放後の射精まで、通し約1時間53分の恋愛疑似体験催眠",
      inductionType: "物語導入系 / 未了状態系 / 反復カウント系",
      voiceActor: "そらまめ。",
      majorFetish: "サキュバス / ドライ絶頂 / 好き宣言 / 尻尾責め / M煽り",
      kinkType: "M向け〜恋愛疑似体験",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間53分（レクリ＋ドラマ＋本編＋解除）",
      recommendedFor: [
        "サキュバス同級生・恋愛疑似体験シチュが好きな方",
        "ドライ絶頂・好き宣言カウントが好きな方",
        "M向け煽りとサキュバス解放後の追込が好きな方",
      ],
      notRecommendedFor: [
        "ストーリーを飛ばして即エロだけ欲しい方",
        "サキュバス煽り・連続絶頂に抵抗がある方",
      ],
    },
    "saimin-yousei-surround-mugen-iki-mahou": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "三人妖精のサラウンド定位と宣言・ゼロ待機で脳を空にし、重ね掛け快楽魔法と裏筋指魔法まで追い込む通し約1時間49分の長尺催眠",
      inductionType: "サラウンド定位系 / 宣言トリガー系 / 反復カウント系",
      voiceActor: "音撫屋 かの仔",
      majorFetish: "妖精 / ゼロカウント / 前立腺 / 脳イキ / 裏筋責め",
      kinkType: "M向け〜変態煽り",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間49分（レクリ＋本編＋解除・バイノーラル）",
      recommendedFor: [
        "妖精・魔法陣召喚シチュが好きな方",
        "サラウンド定位と声追い誘導が好きな方",
        "ゼロカウントと重ね掛けドライが好きな方",
      ],
      notRecommendedFor: [
        "穏やかな甘々だけ・短い尺で済ませたい方",
        "M煽り・無限絶頂に抵抗がある方",
      ],
    },
    "saimin-school-hypnosis-training": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "9名声優が台本を読む専門学校型入門作品。かからない人向けに体験実感へ全振りした教育構成",
      inductionType:
        "教育導入系 / 分割弛緩系 / イメージ誘導系 / 反復カウント系",
      voiceActor:
        "かの仔、みもりあいの、陽向葵ゅか、あきら、一条ひらめ、ユメノシオリ、山田じぇみ子、月村望、御上みみ（9名・同一台本）",
      majorFetish:
        "初心者向け / 9声優比較 / 分割弛緩 / イメージ誘導 / 教育",
      kinkType: "ノーマル",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約1時間58分27秒（1声優分）",
      recommendedFor: [
        "どうしてもかからない壁にぶつかっている方",
        "催眠はインチキでは？と感じている方",
        "9名声優の聴き比べで好きな声優さんを探したい方",
      ],
      notRecommendedFor: [
        "すでに問題なく催眠にかかれる方",
        "快楽・性的絶頂を主目的にする方",
      ],
    },
    "shoshinsha-mugen-rakka-ecstasy": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "共通導入のあと立ちリラックスと分割弛緩、無限落下イメージと加速カウントでドライ絶頂を反復する同梱・無限落下エクスタシールート（通し約1時間50分）",
      inductionType:
        "教育導入系 / 身体的誘導系 / 分割弛緩系 / 落下イメージ系 / カウント誘導系",
      voiceActor: "恋鈴桃歌",
      majorFetish:
        "初心者向け / 分割弛緩 / 落下体感 / 立ちリラックス / カウント絶頂",
      kinkType: "ノーマル",
      recommendedLevel: "初心者（浅いトランス＋立ち運動・脱力受容が可能）以上の方",
      recording: "約1時間50分56秒（共通導入＋無限落下エクスタシー）",
      recommendedFor: [
        "催眠音声初心者で用語と体感の例が欲しい方",
        "身体的誘導・分割弛緩で深く落ちたい方",
        "落下・加速の体感でトランスを深めたい方",
        "カウント絶頂を練習として試したい方",
      ],
      notRecommendedFor: [
        "短時間で強い命令・洗脳だけを一気に欲しい方（分割弛緩と落下カウントの反復が続く）",
        "落下・加速の体感を頭で追うのが苦手な方（長いカウント連鎖が作品の中心）",
      ],
    },
    "shoshinsha-nouiki-ho-whiteout": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "共通導入でトランスの身近さを示したうえ、双子定位と真っ白ジャーニー、「行く練習」で脳内のドライ絶頂を反復しやすい同梱・脳イキホワイトアウトルート（通し約1時間27分）",
      inductionType: "教育導入系 / イメージ誘導系 / 双子定位系 / カウント誘導系",
      voiceActor: "乙倉ゅい",
      majorFetish: "初心者向け / 脳イキ / 白空間ジャーニー / 双子形式 / 行く練習",
      kinkType: "ノーマル",
      recommendedLevel: "初心者（浅いトランス＋イメージ受容が可能）以上の方",
      recording: "約1時間27分32秒（共通導入＋脳イキホワイトアウト）",
      recommendedFor: [
        "催眠音声初心者で用語と体感の例が欲しい方",
        "イメージ誘導で深く落ちたい方",
        "双子形式の左右定位で注意を運ばれたい方",
        "脳イキを行く練習として試したい方",
      ],
      notRecommendedFor: [
        "視覚イメージを頭で組み立てるのが苦手な方（左右定位の双子形式にも負担を感じやすい）",
      ],
    },
    "edm-trip-orgasm-saimin": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "音分離と魂の階段で深層スタジオへ落とし、EDMビート連動のドライ波から夢精連鎖まで追い込むクラブ系長尺",
      inductionType: "音分離集中系 / 階段カウント系 / コンフュージョン系",
      voiceActor: "野上菜月",
      majorFetish: "EDM / ドライオーガズム / 夢精連鎖 / ライブ配信 / 双子DJ",
      kinkType: "M向け〜従順化",
      recommendedLevel:
        "上級トランス（脳イキは可能・ドライ絶頂は未達）以上の方",
      recording: "注意＋リラックス運動＋本編＋解除",
      recommendedFor: [
        "魂の分離と深いトランスを求める方",
        "EDMと声による連続絶頂を体験したい方",
        "ライブ配信設定で羞恥快感を味わいたい方",
      ],
      notRecommendedFor: [
        "物理的な刺激やウェットな描写を重視する方",
        "複雑な設定やコンフュージョンが苦手な方",
      ],
      workImpressionParagraphs: [
        "EDMのビートに乗って、音を追うというより音が流れ込んでくるような体験でした。水滴や焚火の音分離から魂の分離、階段と光の玉への降下まで、意識が深く落ちていく誘導手順がわかりやすいです。音モノが好きで、ドライの波から夢精連鎖まで追い込みたい方には、私はかなりおすすめできる一本だと感じました。",
        "EDMのビートに合わせて全身が振動し、ドライオーガズムの波が次々と重なっていく快感は非常に特徴的です。ライブ配信という設定が、羞恥心と相まって快感をさらに押し上げる点も印象的でした。頭の内側の脳イキと、ドライオーガズムが交互に訪れ、夢と現実が混じり合う連鎖まで続きます。",
        "長尺の作品ですが、中盤にだれることなく、最後まで集中して聴き終えることができました。解除も10カウントと手拍子が丁寧に用意されており、高負荷の体験の後も安心して現実に戻れる配慮が感じられます。クラブ系のサウンドや双子DJの声が好きな方であれば、この作品は非常に高い満足感を得られる一本だと私は感じました。",
      ],
    },
    "dandan-gehin-ni-naru-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "こと玉融合と「下品になるほど気持ちいい」で語彙が段階的に下品化し、手を止めたドライ絶頂を複数回、最後はカウント射精まで運ぶ長尺言語責め催眠（通し約2時間14分）",
      inductionType: "論理説得系 / 言霊体感化系 / 段階カウント系",
      voiceActor: "逢坂成美",
      majorFetish:
        "言葉責め / 下品語段階化 / カウント絶頂 / ドライ→ウェット / M向け",
      kinkType: "ドM",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間14分（4パート通し）",
      recommendedFor: [
        "実験室・研究者シチュが好きな方",
        "言霊・段階カウントの条件付けが好きな方",
        "長尺でドライから射精まで追い込まれたい方",
      ],
      notRecommendedFor: [
        "下品語・マゾ言責めが苦手な方",
        "言葉責めの追込だけを主役にしたい方",
      ],
    },
    "numa-futari-akujo-free-hypnosis-rj01129822": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "双子の悪女が左右から囁きと吐息で環境を組み替え、キスと耳元責めを経由して段階式のドライへ運ぶ無料の長尺バイノーラル催眠",
      inductionType: "双子定位系 / カウント誘導系 / 密着囁き系 / マゾラベリング系",
      voiceActor: "陽向葵ゅか / そらまめ。",
      majorFetish: "双子責め / キス / 吐息 / 耳舐め / マゾ言責め / 段階ドライ",
      kinkType: "ドM",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約56分（本編・4パート通し）",
      recommendedFor: [
        "双子悪女・マゾシチュが好きな方",
        "カウント・段階ドライ誘導が好きな方",
        "キス・吐息・耳舐めが好きな方",
      ],
      notRecommendedFor: [
        "導入の説明尺が長く、早く密着帯だけを聴きたい方",
        "マゾラベリングや強い支配語が苦手な方",
      ],
    },
  };
  const quickGuideSpec = quickGuideBySlug[review.slug];
  const enableTwoModeReview = Boolean(quickGuideSpec);
  const quickSaleDateLabel = review.saleDate
    ? formatSaleDateJapanese(review.saleDate)
    : "未記入";
  const quickCircleNameLabel = effectiveCircleName(review) ?? "未記入";
  const quickDryWetCounts = extractDryWetCounts(review.body);
  const quickDiscountLabel = dlsiteSaleDisplay?.on_sale
    ? `今なら${dlsiteSaleDisplay.discount_rate}%OFF`
    : "価格はページでご確認ください";
  const quickAffiliateHref = resolveDlsiteAffiliateHref(review) ?? "#";
  const trialAffiliateHref = review.affiliateLinks.find((link) =>
    /体験版|サンプル/.test(String(link.label ?? ""))
  )?.href;
  const quickSampleHref =
    trialAffiliateHref && trialAffiliateHref !== quickAffiliateHref
      ? trialAffiliateHref
      : undefined;

  return (
    <>
      {!isArticle && (
        <ReviewJsonLd
          review={review}
          canonicalUrl={canonicalUrl}
          dlsiteProduct={dlsiteProduct}
        />
      )}
      <article
        className={`mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11 ${isArticle ? "article-reading" : "review-reading"}`}
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> {isArticle ? "トップへ" : "レビュー一覧"}
        </Link>

        <header className="mt-5 sm:mt-6">
          <div
            className={`overflow-hidden rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-lg shadow-slate-950/25 backdrop-blur-sm ${isArticle ? "article-hero-card" : ""}`}
          >
            {review.coverAffiliateHref ? (
              <a
                href={review.coverAffiliateHref}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="block rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50"
                aria-label={`${review.itemName}の作品ページを開く`}
              >
                {coverEl}
              </a>
            ) : (
              coverEl
            )}
            <div
              className={`border-t border-slate-600/40 bg-slate-900/50 py-6 sm:px-8 sm:py-8 ${
                isArticle
                  ? "px-5 max-sm:px-5 max-sm:pb-7 max-sm:pt-6"
                  : "px-4"
              }`}
            >
              <div
                className={`flex flex-wrap items-start gap-2 sm:gap-3 ${showHeaderBadges ? "items-center" : ""}`}
              >
                {showHeaderBadges ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {showNewBadge ? (
                      <ReviewNewBadge className="mt-0.5 sm:mt-1" />
                    ) : null}
                    {showShinsakuBadge ? (
                      <ShinsakuBadge variant="inline" className="mt-0.5 sm:mt-1" />
                    ) : null}
                  </div>
                ) : null}
                <h1
                  className={`min-w-0 flex-1 text-2xl font-bold leading-tight tracking-tight text-slate-50 sm:text-3xl ${isArticle || titleHasBreak ? "whitespace-pre-line text-pretty" : "text-balance"} ${isArticle ? "max-sm:text-[1.7rem] max-sm:leading-snug" : ""}`}
                >
                  {review.title}
                </h1>
              </div>
              <div
                className={`mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${!isArticle ? "sm:justify-between" : ""}`}
              >
                {!isArticle && (
                  <StarRating value={review.ratingValue} best={best} size="md" />
                )}
                <p
                  className={`text-sm text-slate-500 ${isArticle ? "sm:ml-auto" : ""}`}
                >
                  <time dateTime={displayPublishedIso}>
                    {displayPublishedLabel}
                  </time>
                  <span className="mx-2 text-slate-600">·</span>
                  <span>{review.authorName}</span>
                </p>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {review.tags.map((tag) => (
                  <li
                    key={tag}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold ${isArticle ? "article-tag-pill" : "border-sky-800/35 bg-sky-950/30 text-sky-200/90"}`}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <div
                className={
                  review.affiliateLinks.length > 0
                    ? "mt-5 grid grid-cols-1 gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-start min-[720px]:gap-6"
                    : "mt-5"
                }
              >
                <div className="min-w-0">
                  <SummaryMarkdown markdown={review.summary} />
                </div>
                {review.affiliateLinks.length > 0 ? (
                  <div className="flex w-full min-w-0 flex-col gap-3 min-[720px]:w-[min(18rem,100%)] min-[720px]:justify-self-end min-[720px]:pt-0.5">
                    {review.affiliateLinks.length === 1 ? (
                      <AffiliateButton
                        link={affiliateLinksHeader(review.affiliateLinks)[0]}
                        className="min-h-11 w-full px-5 py-2.5 text-sm"
                      />
                    ) : (
                      <AffiliateButtonGroup
                        links={affiliateLinksHeader(review.affiliateLinks)}
                        className="w-full"
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {dlsiteProduct ? (
                <div className="mt-5 border-t border-slate-700/30 pt-5">
                  <DlsitePricePanel
                    product={dlsiteProduct}
                    affiliateHref={resolveDlsiteAffiliateHref(review)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {enableTwoModeReview ? (
          <ReviewModeSwitcher
            quickTitle="1分で判断！クイック解析"
            detailTitle={REVIEW_DETAIL_MODE_BUTTON_LABEL}
            quickAffiliateHref={quickAffiliateHref}
            quickDiscountLabel={quickDiscountLabel}
            quickIsOnSale={Boolean(dlsiteSaleDisplay?.on_sale)}
            quickSampleHref={quickSampleHref}
            quickScoreLabel={quickGuideSpec?.scoreLabel ?? `${review.ratingValue}.0 / ${best}`}
            quickDryWetCounts={quickDryWetCounts}
            quickSaleDate={quickSaleDateLabel}
            quickCircleName={quickCircleNameLabel}
            quickOneLine={
              quickGuideSpec?.oneLine ??
              "作品固有の体験を要点だけで把握できるクイック解析です。"
            }
            quickTypeLabel={quickSpecTypeLabel}
            quickInductionType={quickGuideSpec?.inductionType ?? "分析中"}
            quickVoiceActor={quickGuideSpec?.voiceActor ?? ""}
            quickMajorFetish={quickGuideSpec?.majorFetish ?? "分析中"}
            quickKinkType={quickGuideSpec?.kinkType ?? "ノーマル"}
            quickShowRecommendedLevel={!isDoujinReview}
            quickRecommendedLevel={
              quickGuideSpec?.recommendedLevel ?? "初中級（中程度トランス＋暗示受容）"
            }
            quickRecording={quickGuideSpec?.recording ?? "収録時間を確認中"}
            quickRecommendedFor={
              quickGuideSpec?.recommendedFor ?? ["作品ごとの相性要件を整理中です。"]
            }
            quickNotRecommendedFor={
              quickGuideSpec?.notRecommendedFor ?? ["合わない可能性のある条件を整理中です。"]
            }
            quickWorkImpressionParagraphs={quickGuideSpec?.workImpressionParagraphs}
            quickWorkImpressionAvatar={
              quickGuideSpec?.workImpressionParagraphs?.length
                ? review.workImpressionAvatar
                : undefined
            }
            analysisDataMarkdown={analysisDataMarkdown}
          >
            <>
              {!isArticle ? (
                <section className="mt-6 rounded-2xl border border-slate-600/45 bg-slate-800/45 px-5 py-5 shadow-sm shadow-slate-950/20 sm:mt-7 sm:px-6 sm:py-6">
                  {bodyH2Headings.length > 0 ? (
                    <div>
                      <h2 className="mb-3 inline-flex scroll-mt-24 items-center gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-lg font-bold tracking-tight text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.18)] sm:text-xl">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.85)]"
                        />
                        {REVIEW_DETAIL_MODE_BUTTON_LABEL}
                      </h2>
                      <nav aria-label="本文見出し">
                      <p className="rounded-lg border border-slate-600/70 bg-slate-900/65 px-3 py-2.5 text-base font-bold tracking-wide text-slate-100">
                        <span className="mr-2 align-middle text-sm font-extrabold uppercase tracking-[0.22em] text-sky-300">
                          OUTLINE
                        </span>
                        <span className="text-slate-200">読みたい項目からご覧いただけます。</span>
                      </p>
                      <ul className="mt-3 space-y-2">
                        {bodyH2Headings.map((h) => (
                          <li key={h.id}>
                            <a
                              href={`#${h.id}`}
                              className="group inline-flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-[0.95rem] font-medium text-slate-200 transition hover:bg-slate-900/40 hover:text-sky-200"
                            >
                              <span
                                aria-hidden
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400 transition group-hover:bg-sky-300"
                              />
                              {h.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                      </nav>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section
                className={`mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9 ${isArticle ? "article-body-shell px-5 py-8 max-sm:py-8" : "px-4 py-7"}`}
              >
                {!review.body ? (
                  <p className="text-slate-500">本文がまだありません。</p>
                ) : finalRatingSplit ? (
                  <>
                    {recommendedAudienceSplit ? (
                      <>
                        {recommendedAudienceSplit.prefix.trim() ? (
                          <ReviewMarkdown
                            markdown={recommendedAudienceSplit.prefix}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        ) : null}
                        <div
                          className={`review-recommended-panel flow-root rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-sky-950/25 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-sky-500/10 sm:px-6 sm:py-6 ${
                            recommendedAudienceSplit.prefix.trim()
                              ? "mt-8 sm:mt-9"
                              : ""
                          }`}
                          aria-labelledby="recommended-audience"
                        >
                          <ReviewMarkdown
                            markdown={recommendedAudienceSplit.audience}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                            recommendedAudienceHeading
                          />
                        </div>
                      </>
                    ) : finalRatingSplit.before.trim() ? (
                      <ReviewMarkdown
                        markdown={finalRatingSplit.before}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                    ) : null}
                    <div className="mt-10 border-t border-slate-700/50 pt-8">
                      <div className="grid grid-cols-1 gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-start min-[720px]:gap-8">
                        <div className="min-w-0">
                          <h2
                            id={finalRatingHeadingId}
                            className="review-h2--analysis-block mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50"
                          >
                            総合評価
                          </h2>
                          <ReviewMarkdown
                            markdown={ratingParts.core}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                        {review.affiliateLinks.length > 0 ? (
                          <div className="w-full min-w-0 min-[720px]:w-[min(20rem,100%)] min-[720px]:justify-self-end min-[720px]:pt-1">
                            <AffiliateButtonGroup
                              links={affiliateLinksBesideRating(review.affiliateLinks)}
                              className="w-full"
                            />
                          </div>
                        ) : null}
                      </div>
                      {ratingParts.workIntro.trim() ? (
                        <div className="mt-6 min-w-0 sm:mt-8">
                          <ReviewMarkdown
                            markdown={ratingParts.workIntro}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                      ) : null}
                    </div>
                    {detailRestMarkdown.trim() ? (
                      <div className="mt-10 min-w-0 border-t border-slate-700/50 pt-8">
                        {restWorkSplit && review.affiliateLinks.length > 0 ? (
                          <>
                            <ReviewMarkdown
                              markdown={restWorkSplit.before}
                              articleReading={isArticle}
                              starReviewReadingComfort={!isArticle}
                              workImpressionAvatar={review.workImpressionAvatar}
                            />
                            <div className="mt-8 flex justify-center sm:justify-start">
                              <AffiliateButton
                                link={{
                                  ...review.affiliateLinks[0],
                                  label: "購入はこちら",
                                }}
                                className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                              />
                            </div>
                            {restWorkSplit.after.trim() ? (
                              <div className="mt-10 min-w-0">
                                <ReviewMarkdown
                                  markdown={restWorkSplit.after}
                                  articleReading={isArticle}
                                  starReviewReadingComfort={!isArticle}
                                  workImpressionAvatar={review.workImpressionAvatar}
                                />
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <ReviewMarkdown
                              markdown={detailRestMarkdown}
                              articleReading={isArticle}
                              starReviewReadingComfort={!isArticle}
                              workImpressionAvatar={review.workImpressionAvatar}
                            />
                            {review.affiliateLinks.length > 0 ? (
                              <div className="mt-8 flex justify-center sm:justify-start">
                                <AffiliateButton
                                  link={{
                                    ...review.affiliateLinks[0],
                                    label: "購入はこちら",
                                  }}
                                  className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                                />
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <ReviewMarkdown
                    markdown={review.body}
                    articleReading={isArticle}
                    starReviewReadingComfort={!isArticle}
                    workImpressionAvatar={review.workImpressionAvatar}
                  />
                )}
              </section>
            </>
          </ReviewModeSwitcher>
        ) : (
          <>
            {bodyH2Headings.length > 0 ? (
              <section className="mt-6 rounded-2xl border border-slate-600/45 bg-slate-800/45 px-5 py-5 shadow-sm shadow-slate-950/20 sm:mt-7 sm:px-6 sm:py-6">
                <nav className="" aria-label="本文見出し">
                  <p className="rounded-lg border border-slate-600/70 bg-slate-900/65 px-3 py-2.5 text-base font-bold tracking-wide text-slate-100">
                    <span className="mr-2 align-middle text-sm font-extrabold uppercase tracking-[0.22em] text-sky-300">
                      OUTLINE
                    </span>
                    <span className="text-slate-200">読みたい項目からご覧いただけます。</span>
                  </p>
                  <ul className="mt-3 space-y-2">
                    {bodyH2Headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="group inline-flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-[0.95rem] font-medium text-slate-200 transition hover:bg-slate-900/40 hover:text-sky-200"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400 transition group-hover:bg-sky-300"
                          />
                          {h.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </section>
            ) : null}

            <section
              className={`mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9 ${isArticle ? "article-body-shell px-5 py-8 max-sm:py-8" : "px-4 py-7"}`}
            >
          {!review.body ? (
            <p className="text-slate-500">本文がまだありません。</p>
          ) : finalRatingSplit ? (
            <>
              {recommendedAudienceSplit ? (
                <>
                  {recommendedAudienceSplit.prefix.trim() ? (
                    <ReviewMarkdown
                      markdown={recommendedAudienceSplit.prefix}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  ) : null}
                  <div
                    className={`review-recommended-panel flow-root rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-sky-950/25 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-sky-500/10 sm:px-6 sm:py-6 ${
                      recommendedAudienceSplit.prefix.trim()
                        ? "mt-8 sm:mt-9"
                        : ""
                    }`}
                    aria-labelledby="recommended-audience"
                  >
                    <ReviewMarkdown
                      markdown={recommendedAudienceSplit.audience}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                      recommendedAudienceHeading
                    />
                  </div>
                </>
              ) : finalRatingSplit.before.trim() ? (
                <ReviewMarkdown
                  markdown={finalRatingSplit.before}
                  articleReading={isArticle}
                  starReviewReadingComfort={!isArticle}
                  workImpressionAvatar={review.workImpressionAvatar}
                />
              ) : null}
              <div className="mt-10 border-t border-slate-700/50 pt-8">
                <div className="grid grid-cols-1 gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-start min-[720px]:gap-8">
                  <div className="min-w-0">
                    <h2
                      id={finalRatingHeadingId}
                      className="review-h2--analysis-block mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50"
                    >
                      総合評価
                    </h2>
                    <ReviewMarkdown
                      markdown={ratingParts.core}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  </div>
                  {review.affiliateLinks.length > 0 ? (
                    <div className="w-full min-w-0 min-[720px]:w-[min(20rem,100%)] min-[720px]:justify-self-end min-[720px]:pt-1">
                      <AffiliateButtonGroup
                        links={affiliateLinksBesideRating(review.affiliateLinks)}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                </div>
                {ratingParts.workIntro.trim() ? (
                  <div className="mt-6 min-w-0 sm:mt-8">
                    <ReviewMarkdown
                      markdown={ratingParts.workIntro}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  </div>
                ) : null}
              </div>
              {detailRestMarkdown.trim() ? (
                <div className="mt-10 min-w-0 border-t border-slate-700/50 pt-8">
                  {restWorkSplit && review.affiliateLinks.length > 0 ? (
                    <>
                      <ReviewMarkdown
                        markdown={restWorkSplit.before}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                      <div className="mt-8 flex justify-center sm:justify-start">
                        <AffiliateButton
                          link={{
                            ...review.affiliateLinks[0],
                            label: "購入はこちら",
                          }}
                          className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                        />
                      </div>
                      {restWorkSplit.after.trim() ? (
                        <div className="mt-10 min-w-0">
                          <ReviewMarkdown
                            markdown={restWorkSplit.after}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <ReviewMarkdown
                        markdown={detailRestMarkdown}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                      {review.affiliateLinks.length > 0 ? (
                        <div className="mt-8 flex justify-center sm:justify-start">
                          <AffiliateButton
                            link={{
                              ...review.affiliateLinks[0],
                              label: "購入はこちら",
                            }}
                            className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <ReviewMarkdown
              markdown={review.body}
              articleReading={isArticle}
              starReviewReadingComfort={!isArticle}
              workImpressionAvatar={review.workImpressionAvatar}
            />
          )}
        </section>
          </>
        )}

        {relatedReviews.length > 0 ? (
          <section className="mt-10 border-t border-violet-400/40 pt-6 sm:mt-12 sm:pt-7">
            <h2 className="text-xl font-bold tracking-tight text-slate-100">関連作品</h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {relatedReviews.map((item) => {
                const itemCircle = effectiveCircleName(item);
                const titleOne = reviewTitleSingleLine(item.title);
                return (
                  <li key={item.slug}>
                    <Link
                      href={`/reviews/${item.slug}/`}
                      className="group block overflow-hidden rounded-xl border border-slate-600/45 bg-slate-800/50 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-lg hover:shadow-slate-950/30"
                    >
                      <ReviewCover
                        coverImage={item.coverImage}
                        alt={titleOne}
                        slug={item.slug}
                        className="rounded-none"
                      />
                      <div className="px-3 py-2.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100 group-hover:text-sky-200">
                          {titleOne}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {itemCircle ?? "サークル情報なし"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {nextReview ? <ArticleNextNav next={nextReview} /> : null}

        {review.affiliateLinks.length > 0 &&
          !showAffiliateBesideRating &&
          review.summary.trim() === "" && (
            <section className="mt-8 rounded-3xl border border-slate-600/40 bg-slate-800/40 px-5 py-7 sm:mt-9 sm:px-8 sm:py-8">
              <h2 className="text-lg font-bold text-slate-50">
                作品のページへ
              </h2>
              <AffiliateButtonGroup links={review.affiliateLinks} className="mt-5" />
            </section>
          )}
      </article>
    </>
  );
}
