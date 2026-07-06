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
import { ReviewHeaderBadges } from "@/components/ReviewHeaderBadges";
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
import { getDlsiteRankingBadgesForProduct } from "@/lib/dlsite-ranking-catalog";
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
    const when = !review.publishedAt?.trim()
      ? "投稿日未定"
      : review.goLiveAt?.trim()
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
  const isHypnosisReview =
    review.authorName === "催眠音声解析室" ||
    review.tags?.includes("催眠音声") === true;
  const isDoujinReview =
    !isHypnosisReview &&
    (review.authorName === "同人音声レビュー室" ||
      review.authorName === "同人音声解析室" ||
      review.tags?.includes("同人音声") === true ||
      review.tags?.includes("全年齢同人") === true);
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
  const dlsiteRankingBadges =
    !isArticle
      ? getDlsiteRankingBadgesForProduct(review.dlsiteProductId)
      : [];
  const showHeaderBadges =
    showNewBadge ||
    showShinsakuBadge ||
    dlsiteRankingBadges.length > 0;
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
      recording: "約2時間43分",
      recommendedFor: [
        "先輩恋愛・恋ドレイシチュが好きな方",
        "質問反復・応答ループ誘導が好きな方",
        "乳首・前立腺・多層トリガーが好きな方",
      ],
      notRecommendedFor: [
        "即ピークだけを求める方",
        "主従化・所有モチーフに抵抗がある方",
      ],
      workImpressionParagraphs: [
        "先輩が後輩を恋ドレイ化させるマインドコントロール作品です。ドラマパートでは「お姉さんの膝枕貸してあげるから」と優しく誘いながら、耳元で「エッチなささやき声、直接その耳に吹き込んであげようか？」と囁き、関係性を築く導入が印象的でした。丁寧な会話でリスナーを誘導し、徐々に支配へと傾けていく流れが特徴的です。",
        "「思考が真っ白になって私の言いなりになる深い催眠状態」という言葉の通り、意識がとろけるような感覚が心地よく残ります。「乳首を中心に感電したみたいにビクビクしちゃうよ」という言葉が快感と結びつき、脳イキが連続で訪れる体験が強く記憶に残りました。幸福感に満たされながらも、抗えない支配感に身を委ねる背徳的な快感が鮮烈です。",
        "じっくりと関係性を築き、時間をかけて精神を支配していくため、すぐに刺激的な展開を求める方には少し物足りなく感じるかもしれません。しかし、言葉による精神的な支配や、甘い声での脳イキ誘導を求める方には深く刺さる作品だと感じました。",
      ],
    },
    "jotai-ijo-ushimusume-ts-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "呪いで勇者が牛娘へと変容し、ニナールの支配とカウント誘導のなかでママとして生殖本能に目覚めていく物語催眠",
      inductionType: "カウント誘導系 / 支配暗示系 / イメージ誘導系",
      voiceActor: "魔暗ヤミ",
      majorFetish: "TS / 牛娘化 / 脳イキ / 堕落 / 妊娠出産",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約132分43秒（6パート）",
      recommendedFor: [
        "TS・牛娘化の身体変容を深く味わいたい方",
        "支配的な言葉責めと悪堕ち展開が好きな方",
        "カウント絶頂と頭内快感の段階回収が好きな方",
      ],
      notRecommendedFor: [
        "TS・妊娠出産テーマが苦手な方",
        "純粋な深トランスだけを最優先する方",
      ],
      workImpressionParagraphs: [
        "催眠術師Vtuberの魔暗ヤミさんが声優を務める本作では、呪いの母乳から始まる身体変容が筋弛緩とミルクの海で深く委ねられたあと、部位ごとのカウントで全身が牛娘へ変わっていく流れが印象的でした。頭の中の光が爆発するゼロ絶頂を経て、子作り・授乳・出産まで生殖本能に直結する快感が段階的に重なり、支配的な言葉責めのなかで自己像が書き換えられていく手触りがあります。",
        "解除後も「勇者様」という言葉で快感が蘇る後催眠暗示が残り、甘い余韻とともに日常へ戻る感覚が独特でした。TS・牛娘化と悪堕ちを深く味わいたい方に向く一方、妊娠出産テーマや強い支配描写が苦手な方には合わないかもしれません。",
      ],
    },
    "ts-nyotaika-saimin-ntr-shojo-dry-orgasm": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "催眠で女子高生・四葉へ女体化し、キスまでの恋人の前で友人2人に処女を奪われる。媚薬と輪姦で堕ちていくTS×NTRのロールプレイ主体作品",
      inductionType: "カウント誘導系 / 退行暗示系 / イメージ誘導系",
      voiceActor: "そらまめ。、こやまはる、伊倉える、星野天、柊ひめか",
      majorFetish: "TS女体化 / NTR・寝取られ / 輪姦 / 媚薬メス堕ち / 屈辱",
      kinkType: "ドM向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約92分（通常版・全7トラック／ショート版 約75分）",
      recommendedFor: [
        "TS女体化とNTRの背徳感を味わいたい方",
        "媚薬と輪姦で堕ちていくメス堕ちロールプレイが好きな方",
        "彼氏の前で犯される屈辱と連続絶頂が好きな方",
      ],
      notRecommendedFor: [
        "純粋深化型の王道催眠だけを一本の主役にしたい方",
        "販売表記どおりのドライオーガズムだけを期待する方",
      ],
      workImpressionParagraphs: [
        "みなさんお疲れ様です。管理人です(__) 導入の「異世界」フレーミングから入って、02.催眠パートの深呼吸と100カウントで魂がぷかぷか浮く感じ、これがちゃんと気持ちいいんですよね。ここだけ聴いても眠りに落ちそうなくらい丁寧で、そのあと四葉として生きていく物語への没入が一気に深まります。",
        "純愛パートでキスまでの恋人がいるのに、凌辱パートで媚薬と羞恥を畳みかけられる落差がえぐい。彼氏の前で堕ちていく背徳感が、快感の燃料としてちゃんと機能していて、NTR好きならかなり刺さる一本だと思います。カウント絶頂のたびに喘ぎと水音が濃くなっていくのも、飽きさせないポイントでした。",
        "処女喪失から輪姦まで、CVが増えて掛け合いが賑やかになるのが好きです。中出し描写が多いので、タイトルのドライ表記とはズレを感じるかもしれませんが、女性器中心の連続絶頂としてはかなり完成度が高いです。フェチに合う方なら買う価値十分あると感じました。",
        "解除パートの多段カウントで現実に戻る流れも丁寧で、聴き終わったあとにポカンとするより、満たされた余韻で終われます。TS女体化×NTR×連続絶頂が好きなら、かなりおすすめできる作品です。",
      ],
    },
    "ryomimi-bug-kinshi-anji": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "「行っちゃダメ」の禁止暗示を両耳反復で快感トリガーに反転し、連続ピークから解除まで運ぶ約96分の実験型催眠",
      inductionType: "禁止暗示系 / コンフュージョン系 / 反復刷り込み系",
      voiceActor: "乙倉ゅい / 恋鈴桃歌",
      majorFetish: "禁止暗示 / 言葉責め / 脳イキ / 寸止め / 両耳責め",
      kinkType: "M推奨",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約96分40秒（バイノーラル・4パート）",
      recommendedFor: [
        "禁止暗示・両耳反復誘導が好きな方",
        "否定語を快感トリガーに反転する帯が好きな方",
        "カウント寸止めから射精まで一気に欲しい方",
      ],
      notRecommendedFor: [
        "穏やかな入眠誘導だけを求める方",
        "高反復語に疲れやすい方",
      ],
      workImpressionParagraphs: [
        "明確な指示よりも、コンフュージョンや逆説的な誘導で思考を崩されたい方に強く響く作品です。「脳がバグってしまう不思議な体験をしたい」という言葉から始まり、両耳からの逆説や禁止暗示が多用されていました。左右から交互に流れる「声に集中しないでください」「無視しようとすればするほど催眠に落ちていきます」といった言葉は、聴き手の意識を意図的に混乱させていく手触りがあります。",
        "聴いていると、思考が停止するような感覚に陥り、どちらが肯定なのか判別できない状態へと引き込まれました。「イメージしちゃダメですよ」と禁止されながらも、身体が勝手に脱力していく矛盾した快感が印象的です。思考と身体が乖離していく敗北感が、心地よい深みへと誘う体験でした。",
        "この作品は、素直な催眠誘導を好む方や、理屈よりも感覚的な没入を求める方には、序盤の仕組み説明がやや長く感じられるかもしれません。思考を積極的に揺さぶられる感覚が苦手な場合、意図しない混乱がストレスになる可能性もあると思いました。",
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
    "kowakuma-asmr-haishin-mimi-kando-mazo-trance": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "心地のいい催眠によるオナサポ。小悪魔配信者の限定配信から耳舐め・寸止め射精管理まで、浅い没入のままラポールが続く約1時間8分のKU100バイノーラル",
      inductionType: "支配暗示系 / 行動制御系 / 感覚転換系",
      voiceActor: "伊ヶ崎綾香",
      majorFetish: "小悪魔 / マゾ / 耳舐め / 射精管理 / 寸止め / ASMR配信",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約1時間8分2秒（注意・限定配信・解除）",
      recommendedFor: [
        "支配される快感に身を委ねたい方",
        "耳・身体の感覚増幅で引き込まれたい方",
        "言葉による行動制御で興奮したい方",
      ],
      notRecommendedFor: [
        "穏やかな催眠誘導だけを好む方",
        "明確な物語没入を重視する方",
      ],
      workImpressionParagraphs: [
        "耳舐めの快感がいちばん先に残り、聴き終えてもその余韻が長く続きました。深く意識を落とす催眠というより、語り手に寄り添われながら快感を追いかけていく、心地よい催眠寄りのオナサポだと感じます。限定配信という距離感も、背徳より「二人きりの特別枠」として心に響き、親密な距離感が保たれていました。",
        "催眠の深さは浅めですが、だからこそ語り手とのラポールが途切れにくく、注意パートから本編まで終始浅瀬を漂うような感覚が続きます。意識が一気に深く沈み込むというより、語り手の声に乗って身体が自然に反応していく緩やかな流れの方がはっきりしていました。",
        "耳の敏感化カウント以降は舌先の刺激がさらに濃厚になり、聴こえる音がそのまま肌の触覚へ転がり続ける時間が長く感じられます。寸止めや射精管理はマゾ寄りですが、耳舐めだけ抜き出して聴いても満足できる厚みがあり、乳首や禁止暗示へ広がる起伏も飽きさせません。",
        "全体として長すぎず、同じ系統の刺激が続いてもだらだらしにくいです。多段深化で意識を何度も落としたい人には物足りないかもしれませんが、語り手に心地よく寄り添われながら快感を追いたい人にはかなり合う一本だと感じました。",
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
      workImpressionParagraphs: [
        "双子の彼女たちが左右の耳元で「耳が弱いの？」と囁きかけてくる導入から、一気に作品世界へ引き込まれます。「いいこと知っちゃったな。こーら、逃げないの？」といった挑発的な言葉が、聴き始めからリスナーの意識を強く掴んで離しませんでした。双子に密着され、甘くも意地悪な好意を向けられているような感覚が特徴です。",
        "「耳をハムハムってされるなんて何言ってるの？」と、反応を誘いつつ「動いちゃダメなんだよ」と禁止される流れで、催眠状態が深まります。右耳と左耳、どちらがより気持ちいいのかを意識させることで、刺激への集中が高まりました。この反応禁止と意識の誘導が、リスナーを徐々に深い場所へ誘っていく進め方だと感じます。",
        "耳責めは次第に激しさを増し、「我慢すればするほど、ますます気持ちよくなっていくよね」と、快感を煽る言葉が耳に響きます。「トドロの頭の中に、耳を舐めるいやらしい音が反響して、気持ちいいね」という台詞のように、耳への刺激が脳内で飽和し、どこを舐められているか分からなくなる感覚は強烈でした。ただし、耳への刺激が特定の部位に集中するため、人によっては単調に感じるかもしれません。",
        "双子による密着感と、甘く挑発的な耳責めを好む方に深く刺さる作品です。反応を禁じられながらも快感が解放されていく起伏や、耳への強い刺激から脳イキ、そしてドライオーガズムへと連動する快感を求める方におすすめします。双子の声質が織りなす、背徳感と多角的な刺激を楽しみたい人に特に向いているでしょう。",
      ],
    },
    "futago-succubus-incubus-ryousei-zekkyou-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "音聞き分けレクリと全身脱力から30→0コンフュージョン、S/M自己暗示と魂の同化で人外の肉体を共有し、カウント絶頂で脳イキと多峰を回収する長尺分岐構成",
      inductionType: "コンフュージョン系 / 自己暗示系 / 逆カウント系",
      voiceActor: "柚木つばめ／大山チロル",
      majorFetish:
        "サキュバス×インキュバス / 魂の同化 / S・M分岐 / カウント絶頂 / 脳イキ",
      kinkType: "ノーマル〜M向け（役割没入・背徳快楽）",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording:
        "1ルート約1時間30分（04〜08・M/S・サキュバス/インキュバス・責め×受け分岐・バイノーラル）",
      recommendedFor: [
        "多段階の深化と深いトランスを求める方",
        "人外同化のS/Mロールプレイが好きな方",
        "脳イキと多様な絶頂回収を追いたい方",
      ],
      notRecommendedFor: [
        "複雑な設定やロールプレイが苦手な方",
        "穏やかな誘導だけを好む方",
      ],
      workImpressionParagraphs: [
        "双子のサキュバスとインキュバスが魂を分け合い、人外の肉体で快楽を追う設定が目を引く作品です。約16分の音聞き分けレクリから入り、つま先から顔まで脱力が広がっていく導入は、じっくり意識を内側へ寄せる手触りでした。",
        "30から0への逆カウントに「意識がなくなっていく」「何も考えられない」が厚く重なり、批判的な思考が飽和していく感覚が強いです。魂が凝縮されていくようなコンフュージョンは、他作ではあまり味わえない没入の質だと感じました。",
        "「私はMです／Sだ」の自己暗示で役割に染まり、人外の感覚がシンクロしていく流れが面白いです。「もっと感じたい」が快感を増幅し、乳首・クリ・アナル・挿入とカウント絶頂が連続する一方、分岐が多いぶん特定フェチだけを深掘りしたい方には物足りなく感じるかもしれません。",
        "長尺でありながら深化の線が途切れにくく、解除の「おまじない」まで丁寧に着地する一本です。脳イキを求める方には、おすすめの作品だと感じます。",
      ],
    },
    "fukagyaku-iki-kuse-kokuin-tentacle": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "奴隷の巨大モン娘ダリアがイキ癖刻印で連続絶頂へ導き、触手・催淫ガスから前立腺・乳首の多峰、搾精でウェット着地するドM向け触手催眠",
      inductionType: "支配暗示系 / カウント誘導系 / 反復刷り込み系",
      voiceActor: "架月らみゅ",
      majorFetish:
        "イキ癖刻印 / 触手 / 前立腺 / 乳首責め / メスイキ",
      kinkType: "ドM向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording:
        "約1時間39分（プロローグ〜解除6本・バイブ音無しVer・バイノーラル）",
      recommendedFor: [
        "支配的な溺愛調教と触手責めが好きな方",
        "イキ癖刻印とカウント絶頂の長尺多峰が好きな方",
        "前立腺、脳イキ（乳首）を好まれる方",
      ],
      notRecommendedFor: [
        "穏やかなリラックス催眠だけを求める方",
        "暗示残存を望まない方",
      ],
      workImpressionParagraphs: [
        "えーー、正直圧巻の完成度です。約1時間40分前後という催眠音声としては、長尺に差し掛かるか差し掛からないくらいのなかで、これでもかと要素を詰め込んだ、聴いていて飽きない作品でした。",
        "催眠の感覚はわかるけど、前立腺イキや乳首イキをしたことがない中級者の方に、非常におすすめな一本だと感じます。モン娘のダリアが終始甘々だけど執拗に責めてくるのは、個人的に大好物なシチュエーションでした。",
        "イかされるたびにカウントが徐々に短くなっていくのですが、連続区間は浅イキで連続絶頂を味わえたので、疲れすぎずいい塩梅でした。ここは体質や好みの差が出ると思います。",
        "色々書きましたが、フェチやおすすめの方に当てはまっている方には購入する価値ありです。てか買ってください。そのくらいおすすめです。",
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
        "「あなたの無意識」として語り手が一体化し、往復深化と扉暗示で最深部まで落としたあと、心→頭→全身のドライ絶頂波を長尺で重ねる深催眠",
      inductionType: "多段深化系 / 自己同一化系 / 現実混線系",
      voiceActor: "天知遥",
      majorFetish: "一体感 / 往復深化 / 脳イキ / 全身絶頂 / 安眠分岐",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間49分（注意〜覚醒／バイノーラル本編）",
      recommendedFor: [
        "往復深化で底まで落ちたい方",
        "「私はあなたの無意識」という同一化語りが刺さる方",
        "心→頭→全身のドライ絶頂波を長尺で味わいたい方",
      ],
      notRecommendedFor: [
        "物語やキャラ設定の没入を最優先する方",
        "射精・喘ぎ中心の物理刺激を重視する方",
      ],
      workImpressionParagraphs: [
        "「大丈夫、私の声に委ねて」という言葉から、語り手の声に意識がすっと引き込まれます。疲労に寄り添う優しいラポールから、深呼吸と全身脱力が細かく重なり、思考が止まっても声だけは届く感覚が印象的でした。この両立が、後半に訪れる自己同一化暗示の基盤をしっかりと築きます。",
        "「私はあなたの無意識」という言葉が響くと、リスナーの批判的フィルターは一気に薄れていきます。往復するような深化誘導は、一度意識が浮かんではまた沈むたびに、より深い場所へと誘い込む感覚が強いです。時間をかけて意識の底を耕すように、じっくりと深まりを促します。",
        "性感パートでは、心から頭、そして全身へと快感が広がるドライオーガズムが体験できます。喘ぎや具体的な本番描写がなくても、波のように途切れない刺激が心地よく続きました。ただ、キャラクターや物語よりも内面への誘導が前面に出るため、ロールプレイによる没入を最優先する方には物足りなさを感じるかもしれません。",
        "覚醒では暗示を丁寧に外しつつ、心の満たされ感だけが残る着地が好印象でした。深く意識を落とし込む没入感と、ドライ絶頂の厚み、そして安心して戻れる丁寧な締めが揃った作品です。催眠の深さを一度で存分に味わいたい方や、言葉だけで壮大なドライオーガズムを求める方には深く刺さる一本だと思います。",
      ],
    },
    "saimin-douwa-grim-grimm-ike-nai-ohanashi": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "グリム童話風の物語誘導で夢と現実を混線させ、ページめくりと耳舐めで快感を溜めてから鍵解放する脳イキ型の催眠童話",
      inductionType: "物語誘導系 / カウント誘導系 / 現実混線系",
      voiceActor: "伊倉える",
      majorFetish: "物語没入 / 双子 / 耳舐め / 快感ロック / 脳イキ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "約44分51秒（01一週＋02／01を2周時は約57分・KU100）",
      recommendedFor: [
        "童話型催眠音声が好みの型",
        "夢と現実の境界を楽しみたい方",
        "快感をため込んでから解放するドライが好きな方",
      ],
      notRecommendedFor: [
        "直接的な性的描写を求める方",
        "シンプルな誘導を好む方",
      ],
      workImpressionParagraphs: [
        "少し幼いけれど落ち着いている双子に、森の奥へ連れて行ってもらう「催眠童話」作品です。絵本のページをめくる音を深化に上手く落とし込めていて、物語への没入度は高いです。",
        "視聴方法としてはトラック1「眠れない人のおはなし」を2周聞くことがおすすめされていますが、リラックスしやすい方は1周でも問題なく気持ちよくなれると思います。催眠音声初心者の方は2周聞いた方がリラックスしやすい一方、同じ話をもう一度聞くということに抵抗を感じるなら、無理して聞く必要はないと思います。",
        "ページをめくる音と耳舐めを軸にしてリスナーをドライへ誘っていくわけですが、耳舐めが激しめでしっかりと快感が送り込まれます。物語を読み進められる形で進行するので、寝落ち性能も高めです。",
        "導入・深化・快楽のバランスがいい、帽子屋さんらしい聞きやすい催眠音声となっておりました。おすすめする方としては、催眠音声をある程度聞いている方ですね。",
      ],
    },
    "kouhai-downer-shoujo-ouchi-date": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "文化祭当日、ダウナー後輩・凪の部屋で「寝落ちしたら負け」のゲームから耳かき・添い寝へ進み、幼馴染が恋人になる全年齢おうちデート。",
      inductionType: "幼馴染 / おうちデート / 後輩",
      voiceActor: "川村玲奈",
      majorFetish: "幼馴染 / ダウナー / 耳かき / 添い寝",
      kinkType: "ノーマル",
      recording: "本編約1時間25分（5パート）／EX約29分",
      recommendedFor: [
        "ダウナー後輩の心情変化を追いたい方",
        "おうちデートの耳かき・添い寝で癒されたい方",
        "恋人になったあとの日常まで楽しみたい方",
      ],
      notRecommendedFor: [
        "穏やかな関係性だけを好む方",
        "物語の進展を急ぎたい方",
      ],
      workImpressionParagraphs: [
        "文化祭の日に後輩の部屋へ招かれ、「寝落ちしたら負け」というゲームを口実に始まる本作は、先輩と凪のあいだの距離感が印象的です。「えー…私今、パジャマだし、足出てるんだけど…」と照れながらも膝枕を許す姿からは、だるげな雰囲気の中に隠された親密さが垣間見えました。",
        "耳かきの場面では「先輩の耳の中は綺麗になってないから。こうしてちゃんとメンテナンスしてあげないと、すぐ聞こえなくなっちゃうよ」と、ぶっきらぼうながらも世話を焼く後輩の姿が描かれます。カリカリと耳の奥を掻く音と、そのあとの甘い囁きが心地よいです。",
        "物語が進むにつれて、ダウナーだった後輩が「どれくらい好き？人生全部あげられるくらい？」と問いかけ、甘えと独占欲を覗かせる変化が魅力的でした。素っ気ない態度から一転、愛情をストレートに表すギャップに心が揺さぶられます。",
        "ダウナーな後輩の心情が変化していく過程や、日常の延長にある親密な触れ合いの余韻が、耳かきのあとまで続くのが好きでした。付き合う前後の甘いやり取りや、少し重めの愛情表現にときめく場面が多く、最後まで聴くと二人の関係が一段落ち着いた感じが残ります。",
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
    "etora-isu-ni-naru-asmr": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "エトラの休日を椅子視点で追う全年齢ASMR。カウンターから配信チェア、運転席、カフェ、ソファ、ロデオ、ベッドまで座るたびに圧と距離が変わる。",
      inductionType: "日常 / 椅子POV / VTuber",
      voiceActor: "エトラ",
      majorFetish: "椅子 / 日常 / VTuber / バイノーラル",
      kinkType: "ノーマル",
      recording: "本編約1時間34分（7トラック）",
      recommendedFor: [
        "エトラの日常ボイスを近い距離で聴きたい方",
        "椅子・座面視点のユニークなASMRが好きな方",
        "コミカルな掛け合いと癒しのバランスを楽しみたい方",
      ],
      notRecommendedFor: [
        "刺激的な展開や恋愛ドラマの起伏を重視する方",
        "静かな環境音だけで眠りたい方",
      ],
      workImpressionParagraphs: [
        "「座るイス」になるという設定が最初から効いていて、カウンターに腰を下ろした瞬間の衣擦れと体重の移動が近すぎて笑ってしまいました。シリクサの天気予報読み上げが長引くたびに語り手がツッコむ掛け合いも、配信で見慣れた空気がそのまま届きます。",
        "配信チェアの組み立てトークは座面の話が続き、ここで初めて「自分が座られる側だ」と実感が強まります。ロデオマシーンでは規則的な揺れが下から伝わり、ベッドでは足のマッサージ音が静かな寝室に届くので、終盤だけ聴いても眠気が寄ってきます。",
        "前作のギャグ路線から日常ASMRへ広がった一本で、オフの一日を追いかける余白が心地よかったです。劇的な恋愛展開より、座るたびに変わる距離感を味わいたいときに合いそうです。",
        "椅子視点のASMRは珍しいので、タイトルどおりの体験を試したい方や、シリクサとのコミカルな掛け合いが好きな方におすすめです。静かな環境音だけを求める聴き方とは少し噛み合わないかもしれません。",
      ],
    },
    "gokujou-oneesan-yoshiyoshi-amayakashu-tokubetsu-jikan": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "あおぎり高校・エトラが演じるお姉さん甘やかし。配信ASMRの手触りを耳かき・ヘッドスパ・雨音添い寝に凝縮した全年齢ボイス。",
      inductionType: "お姉さん / 甘やかし / 安眠",
      voiceActor: "エトラ",
      majorFetish: "お姉さん / 甘やかし / 添い寝 / 耳かき",
      kinkType: "ノーマル",
      recording: "本編約1時間2分（4パート）",
      recommendedFor: [
        "心身ともに深く癒されたい方",
        "エトラのASMR配信が好きな方",
        "耳かきと安眠のASMRを重視する方",
      ],
      notRecommendedFor: [
        "刺激的な展開や強い起伏を求める方",
        "明確な物語の起承転結を重視する方",
      ],
      workImpressionParagraphs: [
        "ルイボスティーの香りとウィンドチャイムから入る導入が、個人チャンネルのASMRに近い空気をそのまま運んできました。疲れた顔を見抜いて労ってくれる言葉が自然で、膝枕に進むまでの距離感が急に近づかないのも心地よかったです。",
        "耳かきとこんにゃくスポンジのマッサージは、カリカリ音とぷにぷにした感触のコントラストがはっきりしていて、シャンプー台に移ったあとも頭の重さが抜けていく感じが続きました。成分の話をさらっと挟む場面は好みが分かれるかもしれませんが、キャラの色としては効いていました。",
        "添い寝パートの雨音と心音、背中トントンが重なると、本当に眠くなってきます。配信では見せにくいお姉さん役の甘さがここで一段深まり、おやすみのキスで一区切りつくので寝落ち用としても使いやすいと感じました。",
        "一日かけて甘やかされる体験を、穏やかなテンポで味わいたいときに聴きたい一本です。起伏の大きいドラマより、連続するおもてなしの手触りを楽しみたい聴き方と噛み合いやすい印象でした。",
      ],
    },
    "amama-multi-saimin-shirome-kairaku": {
      scoreLabel: "1.0 / 10",
      oneLine:
        "マルチ催眠と謳うが実態は耳責め淫語RPのみ。催眠は名残程度で深化なし、催眠目当てだと中身とズレる。本編はウェット射精の反復",
      inductionType: "リラックス系 / 反復刷り込み系 / 快感増幅系",
      voiceActor: "陽向葵ゅか／柚木つばめ",
      majorFetish: "マルチボイス / 耳責め / 白目 / 甘やかし / 連続絶頂 / 淫語",
      kinkType: "M向け",
      recommendedLevel: "なし",
      recording: "約75分（6パート本編）",
      recommendedFor: [
        "催眠の完成度は捨て、360°耳責めと淫語だけ聴きたい方",
        "イキトリガーからイキ地獄までウェット絶頂を重ねたい方",
        "母性甘やかしと本性命令の落差を割り切って楽しみたい方",
      ],
      notRecommendedFor: [
        "催眠音声として満足したい方",
        "覚醒・暗示解除まで丁寧に整えて終わりたい方",
      ],
      workImpressionParagraphs: [
        "タイトルはマルチ催眠ですが、聴いてみると入口の委ね以外に催眠としての厚みはほぼありません。本編は耳責めと淫語命令、ウェット絶頂の反復がずっと続き、没入は浅いままです。「催眠」の文字に惹かれて買うと、中身とのギャップがきついです。",
        "二声の甘やかしと本性命令の落差は聴けますし、360°耳責めの刺激は強い。ただし快感の正体はエロRP側で、深化や変性意識の往復は読み取れません。ドライ到達もなく、射精描写前提の一本です。",
        "イキ地獄までの約束は回収されますが、覚醒・解除は雑で終わり方が整いません。耳責めRPを割り切って聴くなら使えますが、催眠音声としての完成度や聴き終わりの満足を求めるなら、買わない方がよい作品だと思います。",
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
    "asmr-kamisama-giri-giri-all-ages": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "神様キャラが全年齢枠をからかいながら、耳かき・添い寝・膝枕から長尺バイノーラルまで届ける約2時間28分",
      inductionType: "神様 / 添い寝 / 膝枕",
      voiceActor: "中井みのる",
      majorFetish: "耳舐め / 耳かき / 添い寝 / 言葉攻め",
      kinkType: "ノーマル",
      recording: "約2時間28分（本編5パート／バイノーラル）",
      recommendedFor: [
        "メタな掛け合いと神様キャラが好きな方",
        "耳かき・耳舐め・添い寝をまとめて味わいたい方",
        "バイノーラルでドキドキしつつ眠りたい方",
      ],
      notRecommendedFor: [
        "穏やかな環境音だけの癒しを求める方",
        "キャラのからかいやメタ発言が苦手な方",
      ],
      workImpressionParagraphs: [
        "オウム返しで空気が悪くなった直後に口調が戻る入り方と、黒塗りで全年齢をからかうくだりで、最初から笑いが混ざります。「ASMRじゃない？」と突っ込まれる瞬間も、メタな掛け合い好きには刺さる温度だと思いました。",
        "KU100を自称する近接の囁きは、吐息まで含めて耳元が忙しく、膝枕の耳かきは温もりが強いです。別作品への嫉妬で早口になるのは笑いより可愛さで、ご褒美のキスや耳ふーのあとに心臓がまた忙しくなる場面が残りました。",
        "耳舐めと耳かきは密着した定位で届きますが、語り手の言葉遊びやメタが挟まると、没入が一度外に出る瞬間もあります。からかうトーンが苦手な日は刺激だけ追いにくいかもしれません。",
        "メタと会話を楽しみつつ、添い寝や耳元の密着も味わいたい人向きです。R18ほど直球ではない分、快感の尖りは穏めですが、全年齢の枠の中でここまで色気とドキドキを出せるのが本作の売りだと感じました。直球の興奮だけを最後まで追い続けたい日には、途中で眠気に落ちて物足りなく感じることもあります。",
      ],
    },
    "warui-inma-kanashiki-koufuku-nadenade-hagu": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "恋人導入で受容を作り、淫魔の幸福快感をナデナデとハグで重ね、背徳と甘さを同時に回収する幸福系ドライ",
      inductionType: "ペーシング系 / 分画法系 / 反復刷り込み系",
      voiceActor: "みもりあいの／和水創太（女性向け）",
      majorFetish: "ナデナデ / ハグ / 幸福暗示 / 背徳シチュ / 憑依淫魔",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約1時間44分（01〜06＋淫魔完全乗っ取りエピローグ／バイノーラル）",
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
        "恋人マリーとの甘い導入から、乗っ取られた声と体でナデナデとハグへ移行する流れが印象的でした。幸せという名の快感が心側へ重なり、背徳と安心が同時に走る独特の没入感があります。",
        "「ドロップ」トリガーと脱力誘導で受容が先に固まり、後半は撫でと密着の触覚暗示が主役です。セルフやウェット刺激がなく、幸福系のドライ回収が段階的に続く構成は、穏やかな誘導を好む方に合いやすいと感じました。",
        "分岐エピローグで救済ルートを選べる点も安心材料です。長尺ですが一本道で物語がつながっており、聴き終わったあとに甘さと背徳の余韻が残る一本だと思います。",
      ],
    },
    "tenshi-akuma-souhan-saimin": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "天使と悪魔の二声を同時入力して判断軸を揺らし、連続ドライから終端セルフまで矛盾を快感へ転換する長尺構成",
      inductionType: "競合入力系 / 反復カウント系 / 二重誘導系",
      voiceActor: "野上菜月／花笠れい",
      majorFetish: "天使×悪魔 / 相反命令 / 連続ドライ / 終端セルフ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間43分28秒（01〜04／バイノーラル）",
      recommendedFor: [
        "二声掛け合いで没入したい方",
        "矛盾入力を快感に変換する構成が好きな方",
        "連続ドライ回収を段階的に体感したい方",
      ],
      notRecommendedFor: [
        "矛盾文や比喩のねじれが苦手な方",
        "単線で分かりやすい誘導を好む方",
      ],
      workImpressionParagraphs: [
        "サークルF・A・Sのtareme氏が台本・編集を担当し、野上菜月さんと花笠れいさんの二声がバイノーラルで左右から同時に入る掛け合い催眠です。聴き終わった印象としては、天使と悪魔の相反命令が判断の軸を揺らし続け、意味を追うより二声の競合へ意識が寄っていく点が深く、相反催眠らしい一枚だと感じました。二声競合を楽しみたい方におすすめできます。",
        "本作は、立位のリラックス運動で身体を整えてから本編へ入り、矛盾文とカウント反復で連続ドライを段階的に回収する流れが特徴です。終端だけセルフへ切り替わる着地が明快で、矛盾を快感へ変換する聴き方に合う方には、ぴったりでしょう。",
        "約1時間40分超と長尺で、初回はリラックス運動を聴いてから本編へ入る想定です。解除で再統合まで整えられるので、聴き終わったあともすっきり戻りやすい一本だと私は思います。",
      ],
    },
    "time-rotor": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "古典脱力のあと公園・繁華街・満員電車へ羞恥を上げ、遅延許可と強度100%でドライ一回に収束させるリモコンローター屋外催眠（非バイノーラル・全6パート約59分）",
      inductionType: "リラックス系 / イメージ誘導系 / 段階深化系",
      voiceActor: "かの仔",
      majorFetish: "リモコンローター / 屋外羞恥 / 満員電車 / 遅延許可 / エロトランス",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）以上の方",
      recording: "約59分00秒（6パート・非バイノーラル）",
      recommendedFor: [
        "古典的な脱力誘導から入りたい方",
        "バレそうな緊張で快感を吊りたい方",
        "ローター操作と屋外羞恥シチュが好きな方",
      ],
      notRecommendedFor: [
        "バイノーラル定位を主目的にしたい方",
        "背徳的な屋外シチュが苦手な方",
      ],
      workImpressionParagraphs: [
        "「タイムローター」は、落ち着いた一人語りで脱力から入り、記憶の風景を公園・繁華街・満員電車へと移していく屋外催眠です。リモコンローターが段階的に動かされ、羞恥とスリルが快感へ反転していく流れが印象に残りました。",
        "「許可するまで行けない」というルールが、バレそうな状況での緊張を際立たせ、快感へ変換する要になっています。特に電車パートでは「目の前の女の子の顔に当たっちゃいそうだよ」といった言葉で、追い詰められる感覚が強く伝わってきました。",
        "振動パターンや強度をいじる描写は、実際に操作されているような生々しさがあります。強度100%までのカウント誘導は、ドライ絶頂へ向かう流れを強く意識させ、深く収束していく手応えがありました。",
        "古典的な脱力誘導から入りたい方や、バレそうな緊張感で快感を高めたい方に響く作品だと思います。ただし、音声のみで屋外の状況を想像するのが苦手な方には、没入しにくいかもしれません。",
      ],
    },
    "sukisuki-surikomi-chudoku-onanie-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "ヘミシンク音と呼吸・脱力で受容を整え、「好き」「名前」「快感」を連結する条件付け型オナニー催眠として、深化から好き好きオナニー絶頂・解除まで一気通貫の長尺構成",
      inductionType: "条件付け系 / 反復刷り込み系 / 深化誘導系",
      voiceActor: "御子柴泉",
      majorFetish: "刷り込み暗示 / 名前呼称 / オナニー指示 / 終端ウェット",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間19分03秒（導入〜解除／バイノーラル）",
      recommendedFor: [
        "ヘミシンクと深化で深く落ちたい方",
        "「好き」「名前」と快感の連結刷り込みが好きな方",
        "声への依存感を育てたい方",
      ],
      notRecommendedFor: [
        "催眠的な快感より直接的な刺激だけを求める方",
        "人形化や支配の暗示が苦手な方",
      ],
      workImpressionParagraphs: [
        "バーチャルライバー「冬木さくら」の配信のなかで、ヘミシンク音と声が重なりながら落ちていく条件付けオナニー催眠です。呼吸と脱力のあと、声がそのまま考えになっていく感じが早い段階から効いてきます。",
        "好き好きオナニー絶頂では「好き」と「さくらちゃん」を交互に言うほど握力と速度が変わるので、もどかしさがそのまま快感の燃料になります。「好き」と名前を同時に言え、という合図のあたりから一気に加速するのが、この作品らしい中毒の手触りです。",
        "握れないのに速くしろ、という命令の落差はかなり効きます。合図で一回ウェットに収束するあたりまで、刷り込みと焦らしのバランスが整っていると感じました。",
        "人形化や支配のテーマに抵抗がなければ、約80分通しでも戻りやすい余韻があります。ヘミシンクと名前刷り込みが好きな方に、長尺でじっくり追い込みたい一本だと思います。",
      ],
    },
    "nouiki-nohand-nouiki": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "呼吸・PC筋反復・空想セックスを段階接続し、ノーハンド脳イキを体づくりから本番まで一連で回収する実践型",
      inductionType: "身体感覚集中系 / 反復刷り込み系 / イメージ誘導系",
      voiceActor: "秋野かえで",
      majorFetish: "ノーハンド / 脳イキ / PC筋トレ / 空想セックス",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約55分（本編・4パート通し）",
      recommendedFor: [
        "ノーハンド・脳イキ実践型が好きな方",
        "PC筋・下腹部トレーニングが好きな方",
        "イメージ誘導・空想セックスが好きな方",
      ],
      notRecommendedFor: [
        "即刺激だけを求める方",
        "深い多段深化の催眠没入を重視する方",
      ],
      workImpressionParagraphs: [
        "横向きと呼吸から入る導入が丁寧で、服を理性の象徴として手放す流れまで安心感が続きました。鼓動を聞く誘導で内向きになりやすく、本編に入る前から受容側に寄せてくれます。",
        "PC筋のキュッ反復と枕を締める動作が音声と同期し、砂時計カウントで一度押し上がる落差が印象的でした。空想セックスパートでは手を動かさない到達がはっきり回収され、ノーハンドの約束どおりの体感になります。",
        "解除まで一本のラインで閉じる実践型としてまとまっており、深い催眠より身体感覚と快感を重視する聴き方に合う一本だと感じました。PC筋トレと脳イキ実践を試したい方には満足感が得られると思います。",
      ],
    },
    "kurayami-kodzukuri-noumitsu-shokubutsu-mesuiki": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "夢の種孕シチュで受容を固め、蜜・受粉比喩と321カウントで連続メスイキへ積層回収する長尺誘導構成",
      inductionType: "イメージ誘導系 / 逆カウント系 / 連続回収系",
      voiceActor: "魔暗ヤミ",
      majorFetish: "連続メスイキ / 受粉比喩 / 身体変容 / 夢催眠 / 愛語反復",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "本編約51分42秒（寝落ち救済版・安眠版あり）",
      recommendedFor: [
        "夢世界・植物種孕シチュが好きな方",
        "呼吸・逆カウント誘導が好きな方",
        "連続メスイキ・蜜・受粉比喩が好きな方",
      ],
      notRecommendedFor: [
        "現実混線・身体変容イメージが苦手な方",
        "穏やかな催眠誘導だけを好む方",
      ],
      workImpressionParagraphs: [
        "夢の花に転がり込む導入から、ストレッチと呼吸でじわじわ深く落ちていく手触りが印象的でした。急がずに受容を固めてから10→0へ入るので、半ばで現実に戻されにくく、蜜の比喩まで一気通貫で乗れます。",
        "濃蜜から受粉にかけて身体の境界が溶けていく描写が強く、結合のあと花粉と321カウントでメスイキの山が連続します。「受粉地獄」の名どおり、止められない快感の波が何度も押し返してきます。",
        "夢世界の種孕シチュと身体変容に惹かれる方には、約51分を通して没入しやすい一本だと感じました。カウントで深く、比喩で快感を重ねるタイプの催眠が好きなら、完成度の高い満足感が得られると思います。",
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
        "心理テストの体裁と「ダメ」反復はあるが、催眠誘導は短く没入は浅い。本編の大半は手コキ・フェラ・挿入の実演で、催眠としての気持ちよさ・着地はほぼ期待できない。催眠音声とは？という作品です。",
        "金額面を考えてもコスパが悪いとしかいいようがないです。禁止反転フェチを割り切って聴く以外ではおすすめしません。完成度や聴き終わりの満足を求めるなら、買わない方がよい作品です。",
        "エロ実演だけを消費する用途なら使えますが、催眠として気持ちよさや再統合を重視する方は買わないにこしたことはないでしょう。",
      ],
    },
    "futarigake-saimin-love-happy-orgasm": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "双子の左右定位と褒め反復で安心と快感を同時更新し、幸福感を保ったまま同調ピークへ積層回収する長尺構成",
      inductionType: "リラックス系 / 同調深化系 / 反復刷り込み系",
      voiceActor: "みもりあいの",
      majorFetish: "双子掛け合い / 褒め暗示 / 耳刺激 / 幸福ドライ / 愛語反復",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約1時間40分38秒",
      recommendedFor: [
        "双子ラブハピ幸福系シチュが好きな方",
        "往復深化・褒め誘導が好きな方",
        "耳刺激・愛語反復が好きな方",
      ],
      notRecommendedFor: [
        "「0」や発話で深まる誘導が苦手な方",
        "強い支配語を求める方",
      ],
      workImpressionParagraphs: [
        "「3人で気持ちよくなろうね」と双子が迎えてくれる導入から、帰ってきた直後の余韻そのものに感じられました。「0」と声に出すたびに意識が一段落ちる流れは、長尺でも集中が切れにくく、カウントと褒め言葉の反復が心地よいリズムになっています。",
        "左右から交互に届く愛語と、呼吸を合わせる囁きのあいだ、気づけば三人一緒になっている一体感が強まります。一度浅く戻されてからまた深く落ちる往復でも甘いトーンが途切れず、幸福感だけが先に体に残っていく手触りがありました。",
        "褒めと「好き」の反復、耳元のぺろぺろで頭の奥がとろけていく幸福系ドライは、射精描写なしでも十分に峰があります。後半で「好き好き」と重ねられる場面ほど、愛語そのものが快感の主役になっている感じが強いです。",
        "解除は穏やかなカウントで現実へ戻れ、聴き終わったあとも温かな余韻が長く残ります。ふたりがけのラブハピと幸福系ドライを一作で味わいたい方に、約1時間40分じっくり効く一本だと思います。",
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
      workImpressionParagraphs: [
        "「今から私の言う言葉をイメージしてください」という静かな語りかけから、幻想の草原へと誘われるジャーニーが始まります。10から0へとカウントが落ちていくにつれて意識が遠のき、暖かい日差しや爽やかな風を感じる情景が鮮やかに浮かび上がる作りでした。",
        "半覚醒を挟んで幻想世界と現実を往復する誘導は、聴き手をより深い没入へと引き込む手触りがあります。妖精が問いかける「言葉とは音、音とは空気の振動」というフレーズは、暗示が身体に染み渡るような感覚をもたらし、直接的な快感ではなく幻想的な変容を楽しむ誘導だと感じました。",
        "ファンタジーの世界観でじっくりと催眠に浸りたい方、特に最終覚醒がなく深い余韻に浸りたい方には、この作品は響くでしょう。一方で、明確なドライオーガズムや強い刺激を求める方には、物足りなく感じるかもしれません。",
      ],
    },
    "hypno-cloud": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "手を引くジャーニーで視界を奪い、雲の濃度とカウント増幅で性感を段階的に積むバイノーラル催眠",
      inductionType: "リラックス系 / ジャーニー誘導系 / カウント誘導系",
      voiceActor: "紗藤ましろ",
      majorFetish: "囁きバイノーラル / 霧・雲メタファ / ジャーニー追随 / 段階増幅カウント",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約45分22秒（4パート・バイノーラル）",
      recommendedFor: [
        "手を引く霧の旅シチュが好きな方",
        "ジャーニー誘導・段階カウントが好きな方",
        "囁きバイノーラル・雲メタファが好きな方",
      ],
      notRecommendedFor: [
        "導入・誘導を省いてエロパートだけを追いたい方",
        "イヤホン視聴が難しい環境の方",
      ],
      workImpressionParagraphs: [
        "「気がつくと周りは真っ白な世界」——誘導の冒頭で霧のジャーニーが始まり、手を引かれるたびに視界が狭まっていく手触りが強いです。「全てがどうでもいいめんどくさい」まで脱力が進むと、追随するだけで深度が伸びやすくなります。",
        "「私の声がもう耳からではなく頭の中に直接聞こえてくるみたいだよね」という囁きで、左右定位より内側への集中が先に立ちます。「私についてくる」という約束と落下・浮遊の反復で、身体感覚が薄れていくのがこの作品らしい導入です。",
        "白→ピンク→赤の雲で感情が段階的に高まり、浮遊のまま1→10増幅が返ってきます。「びくんびくんという快感が体全身に訪れる」あたりから波状のドライ多峰が続き、終盤のカウントで一気にヘロヘロまで抜けやすいです。一方で、台詞誘導が中心のため、SEや定位の刺激だけを追う聴き方には物足りないかもしれません。",
        "手を引く霧の旅と雲メタファーが好きな方、ジャーニー追随型の深いトランスをじっくり味わいたい方に向いています。堕落・背徳の落差が苦手な方や、短い命令だけで一気に落ちたい方には合いにくい一本です。",
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
      recording: "約48分35秒",
      recommendedFor: [
        "コンフュージョン・二段カウント誘導が好きな方",
        "多声囁き・数字トリガーが好きな方",
        "背徳・敗北催眠シチュが好きな方",
      ],
      notRecommendedFor: [
        "回避不能感が苦手な方",
        "穏やかな単声催眠を求める方",
      ],
      workImpressionParagraphs: [
        "左右から同時に声が入ってくる「ヒプノマルチレイプ」は、意味を追うより先に二重の囁きに吸い込まれるタイプの催眠です。脱力と10→0のカウントが何度も重なる誘導では、肩の力が抜けるたびに思考より身体が先に沈んでいきました。",
        "防ごうとしても言葉だけで反応が先に立つあたりが、この作品の肝です。「10、数えると下半身に快感が集まっていく」合図が走るたびにドライの波が連鎖し、敗北感が止まりません。",
        "後半の数字のインフレは半ば荒々しくて、笑える瞬間もあるのに頭が追いつかないまま快感だけが押し上がってきます。100万、10億と増えていくたびに、抵抗の言葉が快感語にすり替わっていく変わり方がおもしろかったです。",
        "声とカウントで追い込まれたいM向けの方におすすめな作品です",
      ],
    },
    "ijigen-trip-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "無意識の語り手が異次元フェスへ連れ込み、ビート同期で思考を止めたあとDJパートの背徳劇場で連続ドライへ落とす長編バイノーラル催眠",
      inductionType: "混乱誘導系 / 反復刷り込み系 / 思考停止系",
      voiceActor: "沢野ぽぷら・野上菜月",
      majorFetish:
        "クラブミュージック / フェス没入 / 分割弛緩 / 連続ドライ / M向け羞恥・公開",
      kinkType: "M向け",
      recommendedLevel:
        "上級トランス（脳イキは可能・ドライ絶頂は未達）以上の方",
      recording: "約2時間18分（全5パート）",
      recommendedFor: [
        "音楽フェス没入シチュが好きな方",
        "分割弛緩・音楽同期の誘導が好きな方",
        "背徳・公開羞恥と連続ドライが好きな方",
      ],
      notRecommendedFor: [
        "甘々な癒し系・優しい誘導だけを求める方",
        "強い背徳感や理性の喪失に抵抗がある方",
      ],
      workImpressionParagraphs: [
        "音楽フェスのような没入シチュエーションや、音楽と同期した誘導が好きな方に強く響く作品です。無意識の語り手が異次元フェスへと誘い、会場の熱気と音楽のトリップ感に身を任せるうちに、思考が溶けていくような感覚に包まれます。",
        "「頭が真っ白になっちゃうんだよ」という言葉が示すように、思考を停止させる音楽的なアプローチがこの作品の肝です。心地よいビートやピアノのメロディが脳内に広がり、理性が外れていくような感覚が深まっていきます。フェスの高揚感とともに、日常の意識から離れていく流れが印象的でした。",
        "DJ前の背徳劇場では、「人前でキスなんて普段は恥ずかしくてできないけど雰囲気に飲まれちゃったのかも」と、理性のタガが外れたような言葉が飛び出します。キスと同時に湧き上がる身体の熱や、何度も「気持ちいい」と繰り返される連続ドライの快感が、感情を深く揺さぶる手触りでした。",
        "感情を揺さぶる言葉と音楽による没入感は高く、特にフェスのような非日常空間での解放感を求める方には深く刺さるでしょう。ただ、思考停止までの音楽同期誘導はじっくりと時間をかけるため、導入部分で刺激を強く求める方には少し物足りなく感じるかもしれません。",
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
        "一本完結だけを重視する方",
      ],
      workImpressionParagraphs: [
        "頭の中の迷い子との契約から入る入口が、この作品ならではの温度感です。「想像を超える最高の快感をプレゼントしてあげる」という約束が先に走り、単独誘導のあと多声へ切り替わる落差がはっきりしています。ヒプノマルチシリーズの入口として、迷い子シチュだけを味わいたい人にも刺さる作りです。",
        "予言カウントが本編の肝で、「30秒で行っちゃう」「120秒後には行きっぱなし」と宣言された瞬間から、身体側が先に反応し始める手触りがあります。両耳同時の耳舐めと120秒トリガーの組み合わせは、先読みさせられながら波が返ってくる構造としてよくできています。",
        "一方で、エンドレス用差分の聴き分けが必要なので、初回はトラック構成を確認してから聴いた方が迷いにくいです。誘導パートに時間を割く構成のため、すぐ多声責めだけを求める聴き方とは噛み合いにくい面もあります。",
      ],
    },
    "usotsuki-kouhai-suki-suki-seishin-shihai": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "演劇部後輩の嘘「好き」で半覚醒往復し、好き連呼の脳イキと寸止めから反転カウントでウェット着地する精神支配催眠",
      inductionType: "好き条件づけ系 / 逆カウント系 / 精神支配系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "好き攻撃 / 嘘告白 / 寸止め / 自動手コキ / M煽り",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間00分50秒（注意＋レクリ＋ドラマ＋本編＋解除）",
      recommendedFor: [
        "好きトリガーで深く堕ちたい方",
        "演劇部・嘘つき後輩シチュが好きな方",
        "寸止めと脳イキの連鎖が好きな方",
      ],
      notRecommendedFor: [
        "本気の純愛告白だけを求める方",
        "嘘弄り・寸止め屈辱に抵抗がある方",
      ],
      workImpressionParagraphs: [
        "演劇部の後輩が、演技だと言いながら「好き」を何度も浴びせてくる作品です。嘘から始まった言葉が本当へ反転していく手触りに、本編が自然と引き込まれていきます。",
        "「嘘なんです今言ったこともぜーんぶ嘘」と告げられるたびに、嘘と本当の境界が曖昧になり、精神が深く追い込まれていく感覚がこの作品の肝です。好きという言葉がトリガーとなり、意識がとろけて深い場所へ落ちていくのが印象的でした。",
        "好き連呼の脳イキと寸止め自動手コキの連鎖がはっきり届きます。反転カウントで意識が真っ白になり、ウェットな着地まで一度で終わらない強さが残ります。",
        "好きという言葉に条件づけされ、心を追い込まれる背徳感が好きな方に深く刺さる一本です。ただし、ドラマとレクリが長く、本編の快感導入を急ぐ方には物足りなく感じるかもしれません。",
      ],
    },
    "yuushu-ana-mimi-nabe-azatoi": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "政府公認の専属耳舐めパートナー・いちかが、初ご奉仕から校舎裏・保健室・危険日本編まで耳奥舐めを軸にご奉仕するあざとい系シチュボイス",
      inductionType: "耳舐め系 / ご奉仕系 / 学校系",
      voiceActor: "みもりあい",
      majorFetish: "耳舐め / あざとい / ご奉仕 / 学校",
      kinkType: "ノーマル〜M向け",
      recording: "本編約2時間（7トラック）",
      recommendedFor: [
        "耳舐めとあざとい甘声が好きな方",
        "ご奉仕系の関係を楽しみたい方",
        "耳舐め特化の専属パートナーというシチュエーションが好きという方",
      ],
      notRecommendedFor: [
        "物語の深い心理描写を最優先する方",
        "耳舐め以外の刺激が主役だと感じたい方",
      ],
      workImpressionParagraphs: [
        "パートナー制度の説明から入る導入は、いきなり耳舐めに入るより世界観が掴みやすかったです。いちかのあざとい口調と、初ご奉仕での丁寧な舐め音のコントラストが効いていて、専属感が早い段階で伝わってきます。",
        "校舎裏の手コキパートでは耳舐めが止まらないまま手への刺激が重なり、耳奥まで届く音の質感はここでも一貫していました。左右の移動も追いやすく、ご奉仕と焦らしのバランスが取れていると感じました。",
        "【保健室】膝の上で密着しながら初めての本番へ進む流れは、あざとい口調がそのまま残っていて違和感がありません。「おまんこでいっぱいご奉仕」と言いながら動く場面では、パートナー制度の甘さと初めての青さが重なり、耳舐め以外でも関係の深まりがはっきり伝わってきました。",
        "【危険日】自宅の終盤パートは、耳舐めを挟みながら本番が長く続きます。正常位で顔を見ながらの囁きや、何度も収まらない密度が印象的で、専属パートナーが最後まで耳元を離さない流れだと思いました。",
        "耳舐め特化のコンセプトが最後までぶれないのが好印象でした。制度説明が長く感じる方や、耳舐め以外の刺激だけを追い続けたい方には、テンポが合わないかもしれません。",
      ],
    },
    "neko-ka-anji-amama-oshioki-nouiki-wakarase": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "甘やかし猫化からお仕置き寸止めへ切り替え、泣きイキと矛盾暗示で脳イキを連鎖させる温度差型",
      inductionType: "リラックス系 / 多段深化系 / カウント誘導系",
      voiceActor: "紫雲",
      majorFetish: "猫化暗示 / 甘辛切替 / 寸止め / 泣きイキ / 脳イキ",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約34分（バイノーラル）",
      recommendedFor: [
        "猫化・甘やかしシチュが好きな方",
        "寸止め・わからせ誘導が好きな方",
        "背徳的な脳イキ・快感制御が好きな方",
      ],
      notRecommendedFor: [
        "深いトランスの持続を重視する方",
        "穏やかな催眠誘導だけを好む方",
      ],
      workImpressionParagraphs: [
        "「今日って猫の日なんだよね？猫は好き？」という語りかけから、リスナーは猫へと姿を変える暗示に誘われます。耳がぴょこんと生え、しっぽが揺れる様子が具体的に語られ、もふもふした毛に覆われていく感覚が意識をゆっくりと変えていく導入でした。",
        "「ゴビにニャンってついちゃってるよ」「にゃんにゃんってなっちゃうね」と、猫になりきっていく様子を語り手が優しく指摘します。人間の理性が少しずつ手放され、本能的な部分が解放されていく感覚がこの作品の肝だと感じました。甘やかしと寸止めのお仕置きが交互に訪れることで、意識はさらに深い場所へと引き込まれていきます。",
        "「可愛すぎてやばいよ？顔赤くして可愛いって言われるの嬉しい？」といった言葉が、快感と羞恥を同時に刺激し、背徳的な脳イキへと導きます。泣きながら快感に溺れる体験は、刺激に慣れていないと少し戸惑うかもしれません。しかし、そのギャップこそが快感を増幅させる手触りでした。",
        "理性を手放して本能に従う解放感を味わいたい方や、甘やかしと刺激的なお仕置きのギャップを楽しみたい方に深く刺さる作品です。猫化というロールプレイを存分に体験したい方にも、この徹底した世界観はおすすめできます。",
      ],
    },
    "spy-jinrui-saimin-doreika-kousaku": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "声を出せない制約を自己暗示へ転換し、射精管理とキーワード暴露で脳イキを重ねる約3時間半のスパイ洗脳長尺",
      inductionType: "多段深化系 / 現実混線系 / 快楽洗脳系",
      voiceActor: "野上菜月",
      majorFetish: "スパイ洗脳 / 自己暗示 / 射精管理 / キーワード暴露 / 脳イキ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording:
        "約3時間34分（注意1:22＋レクリエーション19:04＋事前説明7:15＋本編62:05＋射精管理40:29＋オナサポ17:52＋結末5:36＋完全解除14:20／バイノーラル）",
      recommendedFor: [
        "深いトランスと物語性の洗脳を味わいたい方",
        "脳イキと射精管理の寸止め連鎖が好きな方",
        "完全解除で後催眠を掃除したい方",
      ],
      notRecommendedFor: [
        "長尺を一度に聴き切れない方",
        "穏やかな催眠誘導だけを好む方",
      ],
      workImpressionParagraphs: [
        "「スパイの人類催眠奴隷化工作」は、スパイが聴き手へ直接語りかけるような導入から、深く引き込まれる作品でした。左右の耳元から巧みに囁かれる声が、まるで現実の会話のような「掛け合い」を生み出し、その語り口は時に冷徹に、時に優しく、二つの異なる表情を見せるように響きます。冒頭から、その臨場感と語りの深さに驚かされました。",
        "導入のレクリエーションで集中力を高めた後、本編では「声を出せない」という制約を、自己暗示へと巧みに転換させる誘導が見事でした。脳イキを深める快感は、言葉の反復や思考の飽和によって深く追求されます。ファミレスでのRP中に周囲の音を遠ざけ、呼吸に意識を集中させる場面は、日常の環境が催眠状態と混じり合うような、独特の感覚をもたらしました。",
        "緻密に練られた誘導と物語が一体となり、聴き手を深く没入させる手触りでした。「絶頂管理」のように日常行動へ介入する暗示は、催眠が現実世界にまで及ぶかのような錯覚を与えます。ただ、これほどのボリュームで深いトランスを体験するには、まとまった集中時間が必要になるため、聴く人によっては少しハードルが高く感じる可能性もあるかもしれません。",
        "丁寧な解除パートが用意されているため、深い催眠体験から現実へ安全に戻れる安心感も大きかったです。スパイによる奴隷化工作という設定を、長尺で堪能できる一本でした。脳イキを求める方には、おすすめの作品だと感じます。",
      ],
    },
    "nisemono-genjitsu-anji": {
      scoreLabel: "10.0",
      oneLine:
        "音聴き分けから仮想と現実を混線させ、解除の連鎖で深化し、解放トリガーと触手・家畜化まで追い込む長尺の現実暗示催眠",
      inductionType: "多段解除系 / 現実混線系 / 解放トリガー系",
      voiceActor: "逢坂成美",
      majorFetish: "逆催眠 / 触手 / 解放トリガー / 連続絶頂 / 家畜化 / M煽り",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間2分（注意＋レクリ＋プロローグ＋本編＋解除）",
      recommendedFor: [
        "破滅願望・家畜化反転シチュが好きな方",
        "逆進行解除・現実リンク誘導が好きな方",
        "解放トリガー・触手多峰が好きな方",
      ],
      notRecommendedFor: [
        "救済・ハッピーエンドだけを求める方",
        "触手・搾取・背徳屈辱に抵抗がある方",
      ],
      workImpressionParagraphs: [
        "「私の言葉を聞いているうちにそれが真実だったと思い出せるようになるはずです」という語りかけが、聴き手の意識を深く掴んでいく導入です。仮想と現実が巧みに混線し、聴き手の認識そのものを書き換えていくような展開に引き込まれました。名の通り、聴き手の世界観を塗り替えるような、鮮烈な体験でした。",
        "音の聴き分けから始まり、「両肩がダラーンと重くなって腕からスーッと力が抜ける感覚」と身体像が丁寧に書き換えられていきます。カプセル降下による浮遊感や落下感覚は、平衡感覚に直接訴えかけ、意識が深く沈み込んでいくようでした。意識阻害の解除も巧みに挟まれ、聴き手は抗う術なくトランスへと誘われていく感覚です。",
        "中盤からは「体がすくんで、キューッと股が閉じる」という表現とともに、背徳的な快感が幾重にも重なって広がっていきます。快楽物質の分泌を促す多幸感や「解放」トリガー、連続絶頂抑制解除後の波状攻撃は、まさに圧巻の一言でした。触手による寸止めと締め付けで快感はさらに深く刻まれ、最終的には快楽への降伏へと導かれる感覚が強く残りました。",
        "多層的なトランス誘導で深く没入したい方や、背徳的な快感と家畜化の物語に身を委ねたい方には、この作品が強く響くでしょう。ただし、明確な覚醒や自己主導の満足感を求める方には、快楽へ降伏させられるという着地が、もしかしたら少し物足りなく感じるかもしれません。深く沈み込みたい時に、強力な体験を与えてくれる一本だと感じました。",
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
        "実演エロを中心に据えたい方",
        "物語性より即効性を重視する方",
      ],
      workImpressionParagraphs: [
        "公園のロケ音を催眠誘導の軸にするという、一見矛盾したアプローチが本作の特徴です。膝枕で目を覆われ、静かな公園の環境音に包まれると、合成されたSEとは異なるリアルな風の音や囁きが、抵抗する間もなくデートの続きのように深く引き込んでいきます。",
        "「催眠はもとより、そこにあるものを使う」という言葉が、説教がましくなく自然に響きました。風の音や囁きがそのまま意識の落とし穴となり、公園にいたはずの体が草原のふかふかした地面に移り変わる矛盾が、心地よい混乱を呼びます。",
        "ベルが鳴るたびに意識が真っ白になり、戻るたびに「プレゼント」が増える往復運動は、聴覚が快感側へ回転する感覚が印象的でした。10→0のカウントで着地すると、ドライ絶頂が二度はっきりと届き、「もう他のプレイじゃ満足できないかも」という言葉には、思わず信じそうになるほどの強さがありました。",
        "覚醒はエッチ暗示を外した後に数え上げで戻るので、デートの終わりを感じさせる余韻だけが心地よく残りました。環境音を軸にした催眠誘導やイメージ移動を好む方には、リアルなロケ音主導でドライ絶頂まで味わえる、他にない体験をもたらす一本だと感じました。",
      ],
    },
    "slime-musume-guchu-nouiki": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "粘液幻触と耳奥ASMR、10→0反復で失神系脳イキを三連ロングで追い込む捕食型超長尺",
      inductionType: "幻覚誘導系 / 現実混線系 / 反復刷り込み系",
      voiceActor: "琴音有波（紅月ことね）",
      majorFetish: "スライム捕食 / 耳穴ASMR / 幻覚混線 / 連続脳イキ / 失神",
      kinkType: "M向け",
      recommendedLevel:
        "上級トランス（脳イキは可能・ドライ絶頂は未達）以上の方",
      recording: "約2時間15分55秒",
      recommendedFor: [
        "スライム娘・捕食シチュが好きな方",
        "幻覚誘導・現実混線が好きな方",
        "耳穴ASMR・連続脳イキが好きな方",
      ],
      notRecommendedFor: [
        "自我崩壊系の暗示が苦手な方",
        "捕食比喩が合わない方",
      ],
      workImpressionParagraphs: [
        "粘液に全身を包まれ、耳奥のぐちゅぐちゅとした音とカウントで深く落ちていく捕食型の催眠です。現実と幻想が溶け合う語りが続き、失神まで意識が遠のく快感を三連ロングでじわじわ追える一本でした。",
        "耳奥のぐちゅぐちゅとした音と10→0の反復が重なるたび、頭内の快感が連鎖していきます。捕食を思わせる言葉が意識を深く沈め、絶頂のたびに遠のく失神系の波まで押し上げられる手触りがありました。",
        "超長尺のあとも、暗示の解除が別トラックに分かれているので、聴き終えたあとの切り替えが楽でした。呼吸と数え上げで意識を穏やかに戻せ、深いトランスから覚めても心地よい余韻が残りました。",
        "捕食モチーフと自我が削られる言葉に惹かれるM向けの方に、約2時間超を通しで追い込みたい一本だと思います。",
      ],
    },
    "nohand-shasei-mahou-shoujo-mesuiki": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "即売会ブースで女装魔法少女化し、前立腺焦らしとゼロカウントでメスイキ3回からノーハンド射精へ収束する構成",
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
        "解除後の長い余韻を求める方",
      ],
      workImpressionParagraphs: [
        "恋人ユカリとの会話から、ラブホ女子会の実録が即売会ブースの催眠DVD販売へ姿を変える入口が印象的でした。フリフリの魔法少女コスを「ほら、試してみよ」と差し出される場面は、恥ずかしさより先に売り子として場を仕切る余裕が伝わってきます。",
        "天井一点凝視から肩・瞼の同期へ進む入り方は、目だけ我慢させるタイプでした。目を開けたまま深く落ちていくうち、来場者に見られているような緊張が混ざり、ゼロカウントで弾ける前から身体が熱くなっていきます。",
        "手・爪・袖から魔法少女売り子へ身体像が上書きされていく先で、前立腺焦らしとゼロの反復が重なります。「周りにバレない」「声を上げちゃダメ」のあいだに「射精以外で行く」暗示が来て、タイトルどおりのメスイキが連鎖し、触れずにノーハンドまで一気に収束する流れがありました。",
        "解除は「催眠音声ディスクを作って遊びに行くよ」で短く終わるので、長い余韻よりオチを楽しむタイプです。即売会羞恥とカウント焦らし、女装魔法少女からメスイキ→ノーハンドまで一括で好きな方向きだと思います。",
      ],
    },
    "re-limit-marionette": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "糸弛緩とマリオネット深化のあと「まだ、いけるよね」と多段カウントでドライ絶頂を連鎖させる人形支配催眠",
      inductionType: "リラックス系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "涼花みなせ",
      majorFetish: "主従関係 / マリオネット化 / 寸止め / 多絶頂 / ドライ連鎖",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約72分29秒（本編1ファイル通し）",
      recommendedFor: [
        "人形支配・マリオネットシチュが好きな方",
        "カウント・トリガー反復誘導が好きな方",
        "寸止め・多段ドライが好きな方",
      ],
      notRecommendedFor: [
        "後催眠・暗示の持続を重視する方",
        "短時間刺激だけ欲しい方",
      ],
      workImpressionParagraphs: [
        "二人の人形使いに操られ、マリオネットとして深く沈んでいく「催眠童話」のような作品です。「気持ちよく呼吸ができることに感謝し」という言葉から、全身の力が抜けていく感覚が丁寧に描かれていました。",
        "思考を奪われ「何も考えられないただただ気持ちのいい状態」で、人形として支配されていくのがこの作品の肝だと感じます。耳や唇、おへそをなぞる指の刺激と「けど動けないの…かわいそうだね…」という言葉が、意識を深いところへ誘います。",
        "「ビリビリビリビリジーン終わらないまだ終わらない」という言葉が示すように、限界を超えたドライ絶頂が何度も連鎖する快感が特徴です。鳥肌が立つほどの快感が全身に駆け巡り、頭の中が真っ白になる感覚が強く残りました。",
        "人形として喜ばされ、「まだいけるよね」と限界まで快感を追い求められる背徳感が、エロトランスさんらしい作品の魅力です。人形支配や多段ドライの快感を求める方に、深く刺さる一本だと思います。",
      ],
    },
    "ts-mahou-shoujo-haiboku-shinai": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "捕縛と唾液汚染で受容を固め、部位別カウント反復で敗北TSの女体化とドライ絶頂を物語型長尺で積み上げる構成",
      inductionType: "カウント誘導系 / 反復刷り込み系 / イメージ誘導系",
      voiceActor: "餅梨あむ",
      majorFetish: "敗北TS / 女体化 / 唾液汚染 / 体外式ポルチオ / ドライ絶頂",
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
        "同型反復が苦手な方",
      ],
      workImpressionParagraphs: [
        "「TS魔法少女は敗北しない」というタイトル通り、魔法少女が敗北し、女の子へと強制的に転換させられる場面から物語が始まります。耳元で囁かれる唾液汚染や身体変容の暗示が、じわじわと身体に馴染んでいくような感覚でした。口唇や耳への刺激から全身へと広がる、抗えない変化の予感が強く印象に残ります。",
        "「本当はなりたかった」という言葉が繰り返し語られるたび、意識が深く引き込まれていくのが本作の肝だと感じました。捕縛や接触の暗示、花畑や胎内のイメージ、そして部位ごとのカウントが次々と重なり、トランス状態が途切れることなく続いていきます。ドライオーガズムを連続で回収する快感が、はっきりとした手応えで届きました。",
        "敗北をテーマにしたTS催眠という独特な世界観が、この作品の大きな魅力です。言葉と想像力で連続するドライ絶頂を深く味わいたい方には、特に心に響く一本だと思います。精神がじっくりと支配されていくような体験を求める方に、心地よい余韻を残す作品でした。",
      ],
    },
    "dakimakura-kanojo-pretty-holic-yurukawa-kouhai": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "抱き枕から恋人まで一本道。小悪魔後輩のあまあま純愛が、キス・耳舐めのKU100密着のまま場面を変えずに続く添い寝ボイス",
      inductionType: "生徒会 / 抱き枕 / 後輩",
      voiceActor: "陽向葵ゅか",
      majorFetish: "抱き枕 / 生徒会 / 後輩 / 恋人",
      kinkType: "ノーマル〜M向け",
      recording: "本編約2時間8分（6パート）／【安眠用】約35分（総再生約2時間43分）",
      recommendedFor: [
        "甘えん坊な後輩に癒されたい方",
        "関係性の進展をじっくり楽しみたい方",
        "多彩なシチュエーションと刺激を求める方",
      ],
      notRecommendedFor: [
        "刺激の強さや過激な表現が苦手な方",
        "物語の意外性や深いテーマ性を重視する方",
      ],
      workImpressionParagraphs: [
        "「枕役になってあげますよ」と言われた瞬間、生徒会室の静けさのなかで年下の彼女の体温だけが手触りとして残りました。からかいと甘さが同じトーンに乗っているので、安心と高揚が同時に来る導入だと感じます。",
        "告白のあと恋人になってからは、自宅やラブホへ場所が移るたびに接触の種類が変わり、キスと耳元の愛撫が主役のまま関係だけが一段ずつ進むのが本作の肝です。没入はおおむね良好ですが、声が正面に寄りすぎる区間では密着の厚みが薄く感じる場面もありました。",
        "演技の緩急は高く、オホ声に偏らずあまあまな煽りで峰を作るので、甘さ寄りのイチャラブを味わいたい方には合うと思います。一方、深いテーマや意外な展開を最優先する方には、恋人一本道のテンポが物足りなく感じるかもしれません。",
      ],
    },
    "dry-org-amadashi-prostate-nipple": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "甘出し反復で締めと抜きを学習させ、乳首・前立腺刺激とカウント暗示を同期して枯渇後ドライへ収束させる訓練型構成",
      inductionType: "エクスポージャー法系 / カウント誘導系 / 実践訓練系",
      voiceActor: "天音羽乃",
      majorFetish: "甘出し / 前立腺責め / 乳首責め / カウント暗示 / ドライ開発",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間28分48秒",
      recommendedFor: [
        "幼馴染訓練・開発シチュが好きな方",
        "甘出し・カウント誘導が好きな方",
        "前立腺・乳首同期が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いドラマを主目的にする方",
        "手を動かす連続指示が苦手な方",
      ],
      workImpressionParagraphs: [
        "「ただいまー」から部屋に上がり込む幼馴染ソマリに、甘出しから枯渇後ドライまで開発される流れが冒頭からはっきりしていました。エクスポージャー法の説明が冗長に感じない程度に入り、カウントで感度が上がる暗示がそのまま実践へつながる手触りがありました。",
        "催眠パートで深層心理と操り人形を重ねたあと、おちんちんに触れず乳首と前立腺だけで進む指示が長く続きます。甘出しの甘い波を何度も踏んだあと、枯渇してからドライのカウント三連が走る落差は、題材どおり再現しやすい訓練型だと感じました。",
        "解除は二つの暗示を列挙して外すだけの短い着地で、続編を匂わせる会話が残ります。完全な余韻より次回期待側なので、着地のすっきり感を最優先する聴き方には少し物足りないかもしれません。",
        "手順を追いながら甘出し開発と枯渇後ドライを一作で試したい方、幼馴染訓練シチュが好きな方には向きやすい一本だと思います。",
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
      scoreLabel: "9.0 / 10",
      oneLine:
        "前室で運用条件を明示し、儀式語の反復と耳舐めを長尺で積層して深度を押し込み、専用解除まで一体化して完走させる洗脳儀式型",
      inductionType: "洗脳系 / 儀式反復系 / 耳刺激系",
      voiceActor: "逢坂成美",
      majorFetish: "洗脳ロールプレイ / 儀式語反復 / 耳舐め / 崇拝暗示 / 支配語彙",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間6分7秒",
      recommendedFor: [
        "儀式・同一語彙の反復で深まりたい方",
        "応答プロトコルで参加型に落ちたい方",
        "耳舐めと支配語を同期させたい方",
      ],
      notRecommendedFor: [
        "穏やかな入眠誘導だけを求める方",
        "洗脳・崇拝など強い語感が苦手な方",
      ],
      workImpressionParagraphs: [
        "「目は閉じましょうか」という穏やかな語りかけから始まり、リスナーの頭を真っ白に洗い流していく儀式へと誘われます。左右からズブズブと舌をねじ込まれるような耳舐めは生々しく、意識が敏感になっていく感覚が強く伝わってきました。",
        "作品全体を貫く「洗脳」「祝福」「崇拝」といった反復語は、まるで呪文のように聴く者の意識に深く刻み込まれていきます。女神様への「はい、女神様。」という応答を促されることで、受動的な聴取を超えた、儀式への参加感が確かにありました。",
        "耳舐めが激しく展開される中で、額へのキスマーク暗示や10から0へのカウントダウンは、脳内の快感を明確に連鎖させていく印象です。ただ、穏やかな入眠を期待する方には、支配的な語彙の反復がやや強すぎると感じるかもしれません。",
        "この作品は、儀式めいた反復や支配的な言葉によって深く意識をコントロールされたい方に強く響く体験をもたらします。耳舐めと同期する強い支配語彙で、徹底的に脳内を漂白されたい方に、ぜひ一度試してほしい作品だと感じました。",
      ],
    },
    "futari-saimin-namahousou": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "二人の催眠生放送ドラマからバイノーラル二声へ入り、媚薬と人形の本編をスイ／メロで分岐しながら快感を回収する長尺構成",
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
      workImpressionParagraphs: [
        "【催眠生放送】「どうもー!毎週高齢の最美生放送始まりました!」の掛け合いから入るので、最初はラジオ番組を聴いている感覚が強いです。左右に声が分かれるバイノーラルの説明のあと、コメントや水着の雑談が長く続き、背徳的な生放送の空気は育つ一方で、催眠本体までの間がやや空きやすいと感じました。",
        "【催眠誘導】片方が落ちたような演出から、一人での誘導に切り替わる場面は不気味さもあり、いきなり集中が促されます。「ふわふわーって」から呼吸と全身の脱力、10から0のカウントまで、古典的な落とし方は手堅いです。ただ本編の快感パートに比べると尺は短く、深化だけをじっくり味わいたい日には物足りなく感じるかもしれません。",
        "【スイパート】液体化してから媚薬を混ぜるイメージ、女性化への書き換えまで、感覚の変化が段階を踏んで押し寄せます。「トロトロからシャバシャバの液体に」という落差が刺さり、深い眠りより快感の刺激を追う聴き方に合う手触りです。セルフ指示ありとなしで強さを選べるのも、このルートならではの遊び心だと思いました。",
        "【メロパート】戻ってきた声が「お人形さん」扱いに入るパートは、スイルートより命令と晒しの圧が尖ります。生放送で全世界に見られている設定が絶頂前に重ねられ、背徳の熱が一気に増す構図が印象に残りました。二声が同時に迫る場面では耳の処理が追いつかず、負荷が苦手な方にはきつい瞬間もあります。",
        "【覚醒】1から10のカウントで暗示を外し、起き上がるまで戻す流れは迷いがありません。スイとメロの分岐は同じ媚薬・人形テーマでも温度差がはっきり出るので、聴き分けの楽しみにもなります。ラジオ導入の長さと誘導の浅さを気にしない、刺激寄りの一本だと思いました。",
      ],
    },
    "futarigake-saimin-coming-orgasm": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "双子の同期呼吸とリップ密集で能動を手放し、GoではなくComeとしてドライの波を迎える受動体験へ寄せる高密度バイノーラル",
      inductionType: "コンフュージョン系 / バイノーラル快感系 / 受動受容系",
      voiceActor: "みもりあいの",
      majorFetish: "双子掛け合い / リップASMR / Come受容 / 淫紋・先端帯 / ドライ連鎖",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間8分31秒",
      recommendedFor: [
        "双子カミング受容シチュが好きな方",
        "双子同期・Come誘導が好きな方",
        "リップ密集・淫紋先端帯が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いドラマを主目的にする方",
        "淫紋・先端責めの刺激が苦手な方",
      ],
      workImpressionParagraphs: [
        "「行くものじゃなくて来るものなの」という言い回しから、能動を手放す方向が冒頭からはっきりしていました。王様のように構えて全部任せていい、という掛け合いが双子の同期呼吸と重なり、リップに入る前から受容側へ寄りやすいと感じました。",
        "吐息リップが首筋から腰へ広がる区間では、触れていないのに熱が溜まっていく手触りが続きます。エナジーで第一波が走ったあと、マルチプルと淫紋で波が押し返してくる流れは、射精描写なしでも峰がはっきり残りました。",
        "物語より波の連鎖が主役なので、掛け合いドラマを期待すると物足りなく感じることもあります。淫紋の煽りはセッション内のロールプレイとして聴いた方が整合しやすく、解除で「また会いに来てね」と再訪を促す語りは、物語より快感受容を重視する聴き方向きです。",
        "Come受容と双子同期が好きな方、リップASMRで能動を忘れたい方には向きやすい一本だと思います。",
      ],
    },
    "futarigake-saimin-dry-iki-support": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "ふたりがけ同調で我慢・蓄積・解放を重ね、ダイヤル・カウント・PC筋・前立腺を反復してドライ到達を支援する長尺サポート型",
      inductionType: "訓練支援型 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "みもりあいの",
      majorFetish: "ふたりがけ / 我慢蓄積 / 前立腺・PC筋 / ダイヤル暗示 / ドライ多段",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約3時間35分（03・04に版差あり）",
      recommendedFor: [
        "ふたりがけドライサポートシチュが好きな方",
        "我慢蓄積・カウント誘導が好きな方",
        "前立腺・PC筋開発が好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いドラマを主目的にする方",
        "同型反復が苦手な方",
      ],
      workImpressionParagraphs: [
        "おかえりなさいから始まる双子の包み込みと、我慢ルールの提示が早い段階で安心感を作ってくれました。合図まで快感を溜める流れがはっきりしていて、一人では再現しにくい同調感が本編を通して続きます。",
        "ダイヤル往復で深度を保ちながら性感開発へ入り、前立腺責めと321カウントでドライが連続する落差が印象的でした。脱力絶頂版では二度、最後のパートで大きく回収されるまで一気通貫で乗れます。",
        "版差で03・04の負荷を選べるのもサポート編らしく、長尺でも型が崩れにくい一本だと感じました。カウントと我慢蓄積が好きなら、ドライ支援として完成度の高い満足感が得られると思います。",
      ],
    },
    "inuka-anji-amatime-oshioki-wakarase": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "甘やかし犬化からお仕置き寸止めへ切り替え、「行け」合図で脳イキを連鎖させる温度差型",
      inductionType: "リラックス系 / 多段深化系 / カウント誘導系",
      voiceActor: "紫雲",
      majorFetish: "犬化暗示 / 甘辛切替 / 寸止め / 支配語 / 脳イキ",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約30分57秒（本編1ファイル通し）",
      recommendedFor: [
        "犬化・甘やかしシチュが好きな方",
        "寸止め・わからせ誘導が好きな方",
        "脳イキ・快感制御が好きな方",
      ],
      notRecommendedFor: [
        "犬化暗示やわからせが苦手な方",
        "穏やかなリラックスだけを好む方",
      ],
      workImpressionParagraphs: [
        "「わん」という語尾の変化や、撫でられると喜ぶといった反応の反復が、リスナーを犬化へと自然に誘い込みます。呼びかけに鳴き声で応えるなど、一つ一つの行動が催眠状態を深めるサインとして機能し、変化していく自分を追いやすいと感じました。",
        "甘えたい気持ちを誘う優しい語りかけから始まり、犬としての反応を促すことで、リスナーは次第に犬化へと深く落ちていきます。撫でられて喜ぶ無邪気な姿から一転、お仕置き寸止めで脳イキが連鎖する展開は、快感の振れ幅が大きく強く響きました。",
        "「あまあまタイム」と見せかけてからの「おしおき脳イキ」というギャップが、この作品の醍醐味です。犬化を通して、徹底的に調教される背徳感と、そこから得られる快感を存分に味わいたい方にぴったりだと感じます。最後まで人間へと戻る流れも、物語としてきれいにまとまっていました。",
      ],
    },
    "jigoku-hypno-multi-rape": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "多声コンフュージョンと三段逆カウントで受動化を固め、エロ四連のカウント圧でドライ回収を連鎖させる拘束型長尺",
      inductionType: "コンフュージョン系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "沢野ぽぷら",
      majorFetish: "多声拘束 / カウント圧迫 / 暗示レイプ / ドライ三連",
      kinkType: "M向け",
      recommendedLevel: "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間47分",
      recommendedFor: [
        "拘束・敗北催眠シチュが好きな方",
        "コンフュージョン・逆カウント誘導が好きな方",
        "カウント圧迫と多声囁きが好きな方",
      ],
      notRecommendedFor: [
        "同型反復が苦手な方",
        "穏やかな情緒を求める方",
      ],
      workImpressionParagraphs: [
        "「始めまして」が左右から重なってくる瞬間から、日常の判断が追いつかなくなる感じがしました。催眠誘導3で10→0が何度も返ってくるたび、肩の力が抜けて、抵抗する余裕だけが薄れていく手触りがはっきり残ります。",
        "エロ1の「まだ暗示を与えていないのにゾクゾク」という焦らしから、エロ2以降のカウント地獄へ一気に落ちる落差が強いです。数字が100・1億へ膨らむたびに、触れてもいないのに下半身が痺れる描写が畳みかけられ、ドライの波が連続して押し寄せてくる感覚が印象的でした。",
        "覚醒は短めですが、暗示解除を先に明言してから数え上げる流れは安心できます。多声圧とカウント反復を許容できるなら、前作より一段ハードに振った続編として、快楽の密度だけはかなり満足できる一本だと感じました。",
      ],
    },
    "oton-akachan-hipu-muryoku": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "保育所設定で大人の判断を外し、挨拶・語尾・命令反復で赤ちゃん化を通しで定着させ、服従報酬からウェット回収へ繋ぐ退行型",
      inductionType: "退行系 / 命令反復系 / 無力化系",
      voiceActor: "あやめ（先生役）",
      majorFetish: "育児退行 / 赤ちゃん化 / しつけ・授乳語彙 / 服従報酬 / ドライ・ウェット",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約70分（導入・本編・解除の3パート）",
      recommendedFor: [
        "保育所・上下関係シチュが好きな方",
        "命令反復・挨拶合図誘導が好きな方",
        "育児退行・授乳語彙が好きな方",
      ],
      notRecommendedFor: [
        "上下関係・無力化が苦手な方",
        "同型反復が苦手な方",
      ],
      workImpressionParagraphs: [
        "ヒプノガーデンの体験入所から、赤ちゃん呼吸と「落ちる」合図で一気に深く落ちる流れが印象的でした。半覚醒を挟んでもドロドロが保たれ、園児側への没入が途切れにくいです。",
        "授乳の甘さといないいないばーの視線落差、しこしこ命令から「出すな／出せ」まで段階がはっきりしていて、ドライが複数回のあとウェット1回で大きく回収されます。無力化と快感が同時に進む退行型として完成度が高いと感じました。",
        "解除で元の姿へ戻しつつ「先生、おはようございます」再暗示を残す着地も丁寧です。上下関係・命令反復・退行シチュが好きなら、約70分を通して満足感の高い一本だと思います。",
      ],
    },
    "osananajimi-m-sei-mazo-saimin-play": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "お客さん／あんた呼びの半覚醒往復とパウダー責めから、乳首・足裏・前立腺で脳息が連鎖する幼馴染M性感催眠",
      inductionType: "半覚醒分画法系 / 深化誘導系 / トリガー暗示系",
      voiceActor: "そらまめ。",
      majorFetish:
        "幼馴染 / M性感 / パウダー責め / 脳イキ / 前立腺 / 半覚醒",
      kinkType: "ドM",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約1時間41分（5パート通し）",
      recommendedFor: [
        "M性感と羞恥を快感と結びたい方",
        "幼馴染M性感館シチュが好きな方",
        "半覚醒分画法と脳イキ連鎖が好きな方",
      ],
      notRecommendedFor: [
        "下品語・マゾ言責めが苦手な方",
        "完全にクリーンな覚醒だけを求める方",
      ],
      workImpressionParagraphs: [
        "幼馴染が半覚醒と深催眠を往復させながら、リスナーをM性感へと誘う作品です。親しい関係性だからこそ許されるような、普段とは違う呼びかけにドキドキさせられました。半覚醒からより深い催眠状態へ落ちるという言葉が、独特の期待感を高めます。",
        "「あんた」と「お客さん」という呼び分けが、意識を半覚醒と深催眠の間で揺さぶる肝だと感じました。幼馴染の言葉によって心の内をさらけ出す流れは、信頼感と背徳感が混じり合う独特の感覚を生みます。意識が声に集中していく感覚が心地よかったです。",
        "パウダー責めから乳首や足裏、前立腺への刺激へと移り、射精禁止のまま脳息が連鎖する快感が特徴です。幼馴染の言葉に身を委ねることで、恥ずかしさと同時に安心感に包まれるような、複雑な快楽が押し寄せてきました。M性感の刺激が好きな方には響くと思います。",
        "幼馴染という関係性の中で、心と体を深く追い込まれていく感覚をじっくり味わえる作品です。半覚醒と深催眠の往復による意識の揺れが、M性感の快感をより強く感じさせてくれるタイプです。ただし、ドラマが長く、純粋な快感導入を急ぐ方には物足りなく感じるかもしれません。",
      ],
    },
    "miraiyochi-zeccho-countdown": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "未来予知の宣言と絶頂カウントを合図化し、先読み反応を快感増幅へ転換して連続ピークへ運ぶ二本立て催眠",
      inductionType: "予言トリガー系 / カウント誘導系 / 教祖崇拝系",
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
      workImpressionParagraphs: [
        "未来予知の宣言と、絶頂へのカウントダウンが繰り返されることで、意識が自然と数字に集中していく作品です。「君の未来は決定している」という言葉に導かれ、耳への刺激と数字の反復が心地よく重なり、深く落ちていく感覚がありました。",
        "耳元で囁かれる「気持ちいいよね」という言葉とともに、舌先で軽く弾かれたり、耳の上をハムハムされたりする刺激が作品の肝です。舐められる耳から頭の中までトロトロに溶かされていくような感覚は、予言された快感がダイレクトに届く手触りでした。",
        "耳の感覚が敏感になり、意識が耳元に集中していく中で、「頭も心もドロドロに溶かされていく」ような不思議な快感が強調されます。体温を感じる温かさと、離れると冷たくなる焦らしが交互に訪れ、快感がさらに深く刻まれる印象でした。",
        "教祖や崇拝シチュエーション、カウントによる誘導が好きな方には、この作品の狙いが深く刺さるでしょう。しかし、耳への直接的な刺激が苦手な方や、焦らしの感覚が強く出る展開が好みではない方には、やや合わないかもしれません。",
      ],
    },
    "aku-no-soshiki-futago-jokan-nouijiri-uraiki-sennou": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "約59分。センノージョ姉妹がガスと反復暗示でヒーローを雑魚戦闘員へ書き換え、エナジードレインから人格排出射精まで背徳洗脳を一本で回収する双子支配催眠",
      inductionType: "洗脳系 / 支配服従系 / 反復刷り込み系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "双子 / 洗脳 / 脳イキ / 敗北 / エナジードレイン / 人格排出",
      kinkType: "M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "約59分11秒（注意・プロローグ・誘導・戦闘員化・エナジードレイン・人格排出・解除）",
      recommendedFor: [
        "双子支配と敗北洗脳のシチュが好きな方",
        "脳イキとエナジードレインの快感連鎖が好きな方",
        "反復暗示で自己認識が書き換わる体験が好きな方",
      ],
      notRecommendedFor: [
        "穏やかな深化型催眠だけを好む方",
        "支配的な二声責めや人格改変が苦手な方",
      ],
      workImpressionParagraphs: [
        "悪の組織に捕らえられたヒーローが、双子の女幹部によって無力化されていく導入は、最初から心を掴むものでした。「頭は幸せ甘くとろけて」というガス誘導から、全身が「ズーンと重く」脱力していく感覚が鮮やかに描かれ、抗う意思が奪われる様子が肌で感じられます。",
        "ヒーローとしての自我が「真っ白に塗り替えられて」いく洗脳の過程が、この作品の売りです。「戦闘員くん？はい」という反復暗示は、自己認識を組織への絶対的な服従へと書き換え、抵抗感を煽りつつも、最終的に全てを奪い去る背徳感が深く残りました。",
        "双子の女幹部による掛け合いは、甘さと冷徹さを巧みに使い分け、主人公を翻弄します。焦らしと開放感の波が繰り返されることで、快感への依存性が高まっていくような手触りでした。ただ、徹底的な人格改変や強い抵抗を煽る構成は、人によってはやや強引に受け止めるかもしれません。",
        "この作品は、悪の組織に捕らえられ、ヒーローとしての誇りを奪われながら徹底的に支配される背徳感を深く味わいたい方に響くでしょう。脳イキを伴う絶頂体験を求め、双子の女幹部の冷酷な命令に身を委ねたい方に、ぜひ聴いていただきたい一本です。",
      ],
    },
    "aku-no-soshiki-hero-akudachi-sennou-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "エナジー100→0と思考増幅ノイズでヒーローを深く落とし、触手スーツと忠誠宣誓射精で悪堕ち洗脳を完走する背徳長編催眠",
      inductionType: "洗脳系 / 悪堕ち系 / 無力化系 / カウント誘導系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "悪堕ち / 洗脳 / 触手 / 薬液 / エナジー吸引 / 言葉責め",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間14分（触手SEあり本編＋解除）",
      recommendedFor: [
        "ヒーロー悪堕ち・洗脳シチュが好きな方",
        "カウント・強い命令誘導が好きな方",
        "言葉責めと身体感覚を組み合わせた快感が好きな方",
      ],
      notRecommendedFor: [
        "触手・薬液・悪役・強制的な無力化が苦手な方",
        "穏やかなリラックス催眠だけを好む方",
      ],
      workImpressionParagraphs: [
        "悪の組織に捕らえられたヒーローが悪堕ち洗脳されていく、というシチュエーションが聴き手の心を掴む作品です。導入の「深く音を感じるためのレクリエーション」で、聴く姿勢を丁寧に整えさせ、暗示への準備を促される点が印象的でした。「プールへつけてあげる」という言葉で、あっという間に物語の世界へと引き込まれていく感覚があります。",
        "薬液プールに浸かる暗示と連動したエナジー吸引カウントダウンが、全身から力が抜けていく感覚をリアルに呼び起こします。「抵抗すればするほど声を意識する」という矛盾した言葉は、思考を混乱させ、聴き手の意識をさらに深く引き込んでいく手腕が光ります。徹底した脱力感を生み出す誘導が巧みだと感じました。",
        "触手スーツによる拘束と「僕負けちゃいました」という宣言は、ヒーローとしての矜持が崩れ去る敗北感を、快感へと反転させる劇的な瞬間です。思考増幅ノイズが批判的な思考を麻痺させ、無意識下へと深く暗示を叩き込むことで、背徳的な快感が連鎖していくのが特徴的でした。終盤の「組織に忠誠を誓います」という言葉と共にウェットな快感へ収束していく流れは、悪堕ちの完成形だと感じます。",
        "強い命令誘導と身体感覚を組み合わせた快感が好きな方には、向き作品だと感じました。レクリエーションが丁寧な分、本編へ入る前に集中の準備が長めに感じられる人もいるかもしれません。ヒーローが悪の組織に堕ちていく過程を、徹底した脱力と精神的な支配で味わいたい方には特におすすめできる一本です。",
      ],
    },
    "zeccho-furi-karakai-kouhai-mazo-mesuiki-nohand": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "約1時間36分49秒。フリからマゾ確定へ落差を作り、『ダメ』系禁制と感度操作を経て初級編でノーハンド志向まで言語で収束させる学園バイノーラル催眠（ルート選択あり）",
      inductionType: "カリギュラ系 / 禁制反復系 / カウント誘導系",
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
      workImpressionParagraphs: [
        "「543210、はい、力を抜いてください」——期待しちゃダメですパートの脱力カウントが、最初の引き込みになります。「ダメと言ったことはしちゃいけません」と先に釘を刺されたあと、禁止語を聞くほど想像が膨らむ手触りが、この作品らしい背徳の入口です。",
        "プロローグの「催眠で本性を暴く」賭けは、からかい上手な後輩の声と相まって、勉強会のはずが一気に密室ゲームへ入る落差を作ります。「吊り橋の上で動いちゃダメ」みたいな言葉遊びの禁止暗示が理性を揺さぶり、三段カウントで「今の先輩を思い通りにできるのは私一人」まで落ちていくのが肝です。",
        "本編は報酬側の語りが長く、メスイキの寸止めと「行ったふり」反復で焦らされ続けます。初級編では手を離したあと「シコシコ」「カリカリ」の囁きだけで追い込まれ、触れていないのに腰が震えるノーハンド射精へ向かう落差が強いです。解除は短めで、エピローグの「私だけ…ですもんね」が日常側に残る締め方は、からかいシチュの約束どおりですが、穏やかに解けたい聴き方には物足りないかもしれません。",
        "禁止暗示とカウント反復が好きで、後輩にからかわれながらマゾ確定へ落ちたいM向けには向いています。短い命令の連打が疲れる方や、ノーハンド・屈辱設定に抵抗がある方には負担になりやすい一本です。",
      ],
    },
    "shinitagari-junai-maid-yogarekake": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "屋上で傷を分かち合ったメイドの楓が、死にたがる彼を重い愛で叱責し、添い寝や電話で心身を支え続ける物語。",
      inductionType: "メイド / 添い寝 / 純愛",
      voiceActor: "浅木ゆめみ",
      majorFetish: "メイド / 添い寝 / 純愛 / 安眠",
      kinkType: "ノーマル",
      recording: "本編約1時間46分　おまけ安眠トラック（約1時間12分）",
      recommendedFor: [
        "深い関係性を求める方",
        "重い愛に包まれたい方",
        "聴き手の存在を強く感じたい方",
      ],
      notRecommendedFor: [
        "明るく軽快なシチュエーションを好む方",
        "バイノーラル定位や左右移動の音像演出を主目的にする方",
      ],
      workImpressionParagraphs: [
        "二人の出会いを描くプロローグから、本作は一般的なシチュエーションボイスとは異なる入り方を見せます。出会いの時点から「やめときなこんなしみったれた女」と語りかける声は、聴き手と語り手がお互いを受け入れ、深く関わっていく物語の始まりを予感させました。",
        "聴き手が過去に語り手を救ったように、今度は語り手が聴き手へ「私のために生きてください」と切実に訴えかける場面が印象的です。互いの存在が幸福の理由であり、「私の幸せはご主人様の隣にしかない」という言葉からは、その愛の重さと深い結びつきが伝わってきました。",
        "優しく、時に強く語りかける声は、聴き手の心に温かく寄り添う感覚があります。離れていても電話越しで睡眠をサポートする場面など、心の距離の近さを感じる余韻が残ります。ただ、音声がモノラルであるため、左右からの囁きといった定位演出が薄く感じられるのは惜しい点でした。",
        "この作品は、誰かの深い愛に包まれたい、あるいは互いに支え合うような関係性を求める方に響くでしょう。一人で眠れない夜に、温かい声でそっと寄り添ってほしいと願う方にも、心の奥底まで届く作品だと感じました。",
      ],
    },
    "spy-kairaku-semina-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "自己啓発セミナーを装ったスパイ洗脳でCFバイパスと視線トリガーから契約カウントのドライオーガズムへ連鎖する約1時間44分の催眠",
      inductionType: "コンフュージョン系 / 多段深化系 / 快楽洗脳系",
      voiceActor: "野上菜月",
      majorFetish: "スパイ洗脳 / 見られる羞恥 / ドライオーガズム / CFバイパス / 背徳イキ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "約1時間44分（注意1:19＋リラックス運動16:48＋本編1:10:38＋解除7:04＋完全解除8:13／バイノーラル）",
      recommendedFor: [
        "深いトランスと心理的変容を味わいたい方",
        "見られる羞恥と契約カウントのドライ連鎖が好きな方",
        "興奮維持と完全解除から着地を選びたい方",
      ],
      notRecommendedFor: [
        "導入で身体的な行動を避けたい方",
        "興奮の完全な収束をすぐに求める方",
      ],
      workImpressionParagraphs: [
        "催眠音声としては珍しいセミナー形式で、自己啓発の枠組みを借りて聴き手をスパイの世界へと誘う作品です。「疲れないことしかしないから、安心してくださいね」という語り手の言葉は、これから始まる体験への期待感を高めていきました。意識を自然に誘導する導入は、聴き手がスムーズに作品世界へ入り込む手助けをしていると感じました。",
        "本編では倫理と快感を結びつけるコンフュージョンが巧みに展開され、「見てるよ」という視線誘導が聴き手の心理に強く作用します。語り手の甘い言葉と誘惑は、背徳感と信頼を結合させ、聴き手の心理的境界を曖昧にしていく感覚が残りました。スパイとしての真意と、裏切りへの契約へと自然と引き込まれていく感覚が残る構成です。",
        "快感の要となるのは、見られている羞恥と支配される感覚が織りなす複合的な体験でした。契約復唱とカウントが重ねられるたびに、ドライオーガズムが何度も重なる場面は、この作品の特徴だと感じます。語り手の声が聴き手の身体と心に浸透し、抗えない快感へと誘い込むようでした。",
        "深いトランスと心理的変容、複合的な快感体験を求める方には、この作品は特に向いていると感じました。一方で、セミナー形式や心理的な駆け引きが苦手な方は、導入部分でやや入り込みにくいと感じるかもしれません。興奮を残す解除と完全解除の二系統が用意されており、聴き終わり方を自分で選べる配慮が嬉しい作品です。",
      ],
    },
    "sound-of-ecstasy-saimin": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "双子の左右声と音楽で快楽の光を流し、連続ドライ絶頂まで押し上げる約1時間21分のバイノーラル催眠",
      inductionType: "意識変容誘導系 / トリガー暗示系 / 連続絶頂系",
      voiceActor: "沢野ぽぷら、野上菜月",
      majorFetish: "音楽催眠 / 双子 / ドライオーガズム / 連続絶頂 / 分割弛緩",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "約1時間21分（注意0:56＋リラックス運動11:15＋本編62:32＋解除6:27／バイノーラル）",
      recommendedFor: [
        "左右の声で挟まれながら深いトランスへ落ちたい方",
        "音楽と声で連続ドライ絶頂を味わいたい方",
        "意識を預けて快感に身を任せたい方",
      ],
      notRecommendedFor: [
        "自己喪失・破壊イメージが苦手な方",
        "穏やかなリラックス誘導だけを求める方",
      ],
      workImpressionParagraphs: [
        "左右から同時に耳へ届く双子の声と音が、聴き始めから意識を強く挟み込む。この作品の顔です。交互に、ときに重なりながら畳みかける二声は、片方だけ追おうとしても吸い込まれていく。「快楽の光」が全身を満たすという言葉も、体感としてはっきり届きます。",
        "奇抜な演出より、手堅く深いトランスへ誘う誘導が心地よい一本。音の種類もシンプルで想像しやすく、思考が止まったまま主導権を預けている時間が長く続きます。双子と音楽が重なることで、抵抗なく意識が深く沈んでいく。そこがこの作品の強みだと思います。",
        "終盤、音が高まるたび快感が弾け、連続ドライの波が休む間もなく全身を襲いかけます。跳ね上がるような強さで、聴き終えたあともしばらく動けない脱力。壊れるくらい貪りたい日に是非。",
        "双子の左右定位と音楽トリガーで連続絶頂したい方におすすめな1本だと感じました。ドライのみに特化している分、快感のイメージははっきり。穏やかな催眠だけを求める日には、刺激が強すぎるかもしれませんね。",
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
        "サロン規約と膝枕から30→0で深く落とし、耳かきの幸福感を経て終盤口淫サービスと覚醒までつなぐバイノーラル催眠",
      inductionType: "リラクゼーション系 / 耳刺激集中系 / カウント誘導系",
      voiceActor: "伊ヶ崎綾香",
      majorFetish: "耳かき / サロン主導 / 膝枕 / 受動没入 / バイノーラル",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約79分",
      recommendedFor: [
        "サロン委ね・施術者主導のシチュが好きな方",
        "呼吸・カウント誘導が好きな方",
        "耳かき・幸せイキを重視したい方",
      ],
      notRecommendedFor: [
        "極めて緻密な現実混線を求める方",
        "穏やかなリラックス催眠だけを好む方",
      ],
      workImpressionParagraphs: [
        "「催眠総合リラクゼーションサロン」という設定で、膝枕を受けながら耳かきを体験する作品です。耳かきパートでは「頭の中はドロドロの状態で全神経を右耳だけに向けている」という言葉の通り、細やかな耳の刺激に意識が集中させられます。耳全体をゆっくりとほぐしたり、ぐりぐりと綿棒で仕上げをする描写がリアルで、純粋な気持ちよさが際立っていました。",
        "呼吸とカウントで意識を深く落とし、「幸せな状態ですね」という言葉で満たされた感覚へ導かれます。耳かきによる幸福感がじっくりと深まったところで、終盤の口淫サービスへとスムーズに移行する流れが印象的でした。「じんわりとした快感が…心地いいよね」と語りかけられるように、穏やかながらも確かな快感が届けられます。",
        "この作品は、性的な気持ちよさだけでなく「純粋な気持ちよさ」や頭内の快感を重視している点が特徴です。ドライシーン3回・ウェット1回と回収ははっきりしていますが、現実混線や矛盾文の密度は控えめで、最深部まで一気に落ちるタイプではありません。代わりに、耳から来る幸福感とリラックス効果は深く味わえます。",
        "施術者に身を委ねるサロンシチュエーションが好きな方や、呼吸・カウントによる穏やかな誘導を好む方に特に向いています。耳かきや、それによって得られる「幸せイキ」を重視したい方にとって、心身ともに満たされる体験ができる一本だと感じました。",
      ],
    },
    "haraguro-seiso-joou-uraomote-sasayaki": {
      scoreLabel: "6.0 / 10",
      oneLine:
        "心の声で本音だけが先に届く二本立て。腹黒マッサージ嬢と初Sの冷たいお姉さん、表と裏の落差が主役",
      inductionType: "視線誘導系 / 快感条件付け / 心の声ギャップ",
      voiceActor: "雲八はち / 海音ミヅチ",
      majorFetish: "心の声 / ギャップ / 乳首責め / M向け",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording:
        "本編約1時間36分（腹黒清楚の性感マッサージ・優しい女王様の初M性感プレイ）",
      recommendedFor: [
        "表の台詞と心の声のズレが好きな方",
        "腹黒系と女王様系を一度に味わいたい方",
        "M向けの乳首開発と寸止めを求める方",
      ],
      notRecommendedFor: [
        "本格的な催眠トランスだけを追い続けたい方",
        "一本の物語としてキャラがつながる作品を期待する方",
      ],
      workImpressionParagraphs: [
        "「本当はお金だけが目当てだけどね」という心の声に背徳的な興奮を覚える方には、この作品が強く響くと思います。丁寧なマッサージの裏で語られる本音は、聴き手だけが知る秘密という状況を作り出し、独特のシチュエーションを楽しめました。腹黒清楚と優しい女王様、二つの顔を持つ語り手のギャップが魅力です。",
        "腹黒清楚編では、マッサージの体裁を取りながら「私の目に集中するよう」と視線誘導が始まり、じわじわと感度を高めていく手触りが印象的でした。「敏感部位をすっごーし指先でひじるだけで、ほら、ピコンって泣きそっちゃいますね」という言葉の通り、寸止めと快感の波が巧みに重ねられます。深い催眠誘導よりも、M向けの快感コントロールが際立っていました。",
        "この作品は、腹黒系や女王様系のキャラクターが好きで、その本音と表向きの言葉のギャップを楽しみたい方に特におすすめです。また、敏感部位への焦らしや寸止めによる快感の重なりを求める方にも、満足感が高いでしょう。一方で、純粋な催眠導入や深いリラックスを求める方には、刺激が強すぎるかもしれません。",
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
      recording: "約60分32秒",
      recommendedFor: [
        "擬声語パブロフ・ペット化シチュが好きな方",
        "条件付け・オノマトペ誘導が好きな方",
        "耳舐め・声のイメージが好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方",
        "台詞で状況説明が無いと不安な方",
      ],
      workImpressionParagraphs: [
        "「パブロフの首輪」というタイトルが示す通り、冒頭から「いい子、いい子」と褒められる導入で、リスナーはワンちゃん化されていくような感覚に包まれます。ベルの音を快感の合図として条件付ける、実験的ながらも作品の世界観に深く引き込む仕掛けが印象的でした。",
        "耳をなめる「レロレロぐちゅぐちゅちゅっぱちゅっぱじゅるじゅる」といった擬声語が、声と混ざり合い頭の中いっぱいに響き渡ります。耳から脳が侵されていくような、ヌルヌル、ペトペト、クチュクチュといった表現が、言葉を超えた感覚的な深化を促す流れでした。",
        "深く落ちたあと、「10カウントダウン」の後に「びくんびくん」というトリガーが発動し、全身に電気が走るようなドライオーガズムが駆け巡ります。腰をガクガクと震わせるほど強烈な快感が、本編中に二度訪れる構成でした。",
        "擬声語やオノマトペによる条件付け、そしてペット化シチュエーションが好きな方に特におすすめできる作品です。一方で、言葉による明確な誘導を好む方には、この擬声語中心の表現が少し独特で、期待と異なる場合もあるかもしれません。",
      ],
    },
    "saimin-asmr-daraku-no-match": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "マッチと練香で儀式へ誘い、依存と「好き」を快感の核に刻む約63分のバイノーラル催眠。前作続編",
      inductionType: "呼吸誘導系 / カウント誘導系 / 感覚連動系",
      voiceActor: "秋野かえで",
      majorFetish: "マッチ / 脳イキ / 依存 / 練香 / 耳舐め",
      kinkType: "M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れ・絶頂反応は未達）以上の方",
      recording: "約63分（5パート・バイノーラル）",
      recommendedFor: [
        "前作から関係が進んだ続編の甘さを味わいたい方",
        "マッチ・お香の音と香りで感覚を研ぎ澄ませたい方",
        "依存と愛情表現を快感の核にした脳イキが好きな方",
      ],
      notRecommendedFor: [
        "マッチテーマだけで深く落ちたい方",
        "催眠に極振りの重厚導入だけを求める方",
      ],
      workImpressionParagraphs: [
        "再会した語り手が手へのお香と拘束で儀式を始めると、擦れるマッチの音と甘い香りが非日常の空気へ切り替えていきます。前作を聴いた人ほど、関係が深まった体温が伝わり、意識の炎を息で消すカウントや練香を練る時間は、嗅覚へのイメージを伴い深く意識を落とすようでした。後半へ進むにつれてマッチの音より「好き」という言葉が快感の引き金となる比重が高まり、意地悪に好意を一度引いてから返す駆け引きでは胸に満たされる報酬感が強く残りました。",
        "カウント絶頂で脳内快感へと誘われたあと、試作品マッチと耳責めで堕落する快感へ向かいます。本番描写はあるものの挿入音は控えめなため、想像で補う余地があると感じました。赤いマッチの炎で覚醒を促されつつも、語り手からの依存を促す言葉が残る着地は、甘い余韻と次への期待を同時に感じさせる後味でした。前作『蠱惑のマッチ』から続くSっ気と純愛の進展を味わいたい方に向く一方、マッチの音だけで深く落ちたい方や重厚な導入を求める方には、テーマの重心移りが合わないかもしれません。",
      ],
    },
    "saimin-renchi-succubus": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "後輩サキュバスとの小話からレモン・梅干し誘導とメトロノーム深化、れんち共通とはれんちドライでいちゃいちゃ絶頂、現実のキスで着地する約1時間50分の物語催眠",
      inductionType: "イメージ誘導系 / メトロノーム深化系 / 身体感覚誘導系",
      voiceActor: "まきいづみ",
      majorFetish: "後輩サキュバス / いちゃいちゃ / 耳舐め / 焦らし / 初キス着地",
      kinkType: "ノーマル〜M向け（甘い支配・禁止）",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "約1時間50分（小話・誘導深化・れんち共通・はれんちドライ/よくばりセルフ分岐・解除・安眠・おまけ・バイノーラル）",
      recommendedFor: [
        "物語と快感が連動する体験を好む方",
        "後輩サキュバスといちゃいちゃ催眠が好きな方",
        "耳舐めと焦らしで脳内快感を追いたい方",
      ],
      notRecommendedFor: [
        "純粋なトランス深化の持続を求める方",
        "ドライオーガズムの厳密な定義を重視する方",
      ],
      workImpressionParagraphs: [
        "サキュバスハーフの後輩が「エッチはまだダメ」と言いながら、先輩の家で催眠をかけてもらう小話から入る作品です。手を繋げない体質の悩みと、夢の中なら触れ合えるという提案が甘く、物語として聴き進めやすかったです。",
        "レモンと梅干しのイメージ誘導から全身脱力、メトロノームで「揺れ」「落ちてゆく」意識へ進む誘導・深化は丁寧です。アダルト共通では「好き」「幸せ」とキスが結び、全身キスで感度が順に上がっていく流れがいちゃいちゃ系の核でした。",
        "はれんちルートでは指パッチンと耳舐め、騎乗位の焦らしが効いています。ドライを謳いつつ最後は射精描写になる点は、厳密なドライ定義を求める方にはずれるかもしれません。深化の持続より快感報酬が主になるので、純トランス重視の方には物足りない可能性もあります。",
        "解除で夢から覚醒し、現実で初キスへつながる着地は温かいです。物語と快感が一本で閉じる一本で、脳イキを求める方には、おすすめの作品だと感じます。",
      ],
    },
    "saimin-akuma-na-tenshi-kairaku-jigoku": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "癒しの天使から堕天使へ転換し、触覚誘導とカウントで感度を上げ、耳舐めと焦らしで無限絶頂を暗示する約60分のバイノーラル催眠",
      inductionType: "コンフュージョン系 / カウント誘導系 / 身体感覚誘導系",
      voiceActor: "かの仔",
      majorFetish: "天使×堕天使 / 耳舐め / 焦らし / 連続絶頂 / 背徳転換",
      kinkType: "ノーマル〜M向け（支配・禁止）",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "約60分（誘導・深化・アダルトSE有無・解除・安眠移行・バイノーラル）",
      recommendedFor: [
        "丁寧な導入で安心して没入したい方",
        "天使から堕天使への背徳転換が好きな方",
        "耳舐めと焦らしで脳内快感を追いたい方",
      ],
      notRecommendedFor: [
        "深い変性意識の持続的深化を求める方",
        "依存の余韻を断ち切られたくない方",
      ],
      workImpressionParagraphs: [
        "「こんばんは、私は天使です」から入る本作で、部屋に現れた天使が癒しを申し出る導入が印象的でした。手を合わせて深呼吸し、腕やおでこへ温もりが広がっていく触覚誘導は、約22分かけてじっくり信頼を積む手触りです。",
        "深化・私の世界は短尺ですが、そのあとのアダルトパートで「天使の癒しは終わり」と堕天使へ転換する瞬間が強烈です。カウントと指パッチンで感度が上がり、耳舐めと「正気吸収」の背徳感が重なって、頭の奥が締まるような快感へ進みます。",
        "「出してって言うまで絶対に出したらいけません」といった焦らしと無限絶頂の暗示は支配的で、耳舐め多めの構成が好きな方には刺さると思います。一方、深化の持続を長く味わいたい方には物足りなく感じるかもしれません。",
        "解除で依存がきれいさっぱり消える台詞は、背徳の余韻を断ち切る着地です。それでも導入の安心感とアダルトの厚みは際立つ一本で、脳イキを求める方には、おすすめの作品だと感じます。",
      ],
    },
    "saimin-asmr-octokisin": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "タコ娘リプスがたこ焼き化と意識を食べる描写で意識を溶かし、触手の段階刺激で約65分のバイノーラル催眠へ導く帽子屋作",
      inductionType:
        "イメージ誘導系 / 感覚連動系 / 身体弛緩系",
      voiceActor: "陽向葵ゅか",
      majorFetish: "触手 / 人外娘 / 意識を食べる / ASMR / 連続絶頂",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "本編約1時間5分",
      recommendedFor: [
        "催眠による乳首、お尻へ快楽を溜めるのが好きな方",
        "意識を食べられる描写と背徳と安心の同居を味わいたい方",
        "局部に溜めた快感を、終盤のカウントで全身解放したい方",
      ],
      notRecommendedFor: [
        "射精描写やウェット絶頂を必須にしたい方",
        "意識を食べられる・飲み込まれる描写が苦手な方",
      ],
      workImpressionParagraphs: [
        "タコ娘のたこ焼き屋から、鉄板のジュー音と試食の流れで場に入る催眠作品です。",
        "「全身をにゅるにゅる撫で回されたいですよね？」と問いかけられるたび、触手が四肢に這い上がって体が抜けていきます。とろとろにぐちゃぐちゃにされる感覚と乳首、アナル責め、耳舐めといった様々な催眠的快楽を堪能できるのがこの作品の特徴です。",
        "たこ焼きを焼く工程に意識を重ねる誘導は、斬新で面白かったです。耳舐めはメイン表記ではないですがガッツリと入っています。",
        "あきらかな絶頂シーンは1回ですが、快感が非常に高く満足できると思います。",
      ],
    },
    "saimin-asmr-noushin-slime": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "耳から頭内へ侵食する擬音と批判的因子バイパスで脳イキを飽和させる約56分のバイノーラル催眠。解除はカウント覚醒まで丁寧",
      inductionType:
        "呼吸誘導系 / 批判的因子バイパス系 / 感覚連動系",
      voiceActor: "伊倉える",
      majorFetish: "脳イキ / 耳舐め・耳掃除 / 支配 / 記憶改変",
      kinkType: "ノーマル〜M向け",
      recommendedLevel:
        "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording:
        "本編約55分54秒",
      recommendedFor: [
        "頭内のしびれと締まりで脳イキを味わいたい方",
        "擬音で耳から頭内へ場面が広がる没入が好きな方",
        "書き換え・支配の暗示が快感に直結する作品が好きな方",
      ],
      notRecommendedFor: [
        "物語の整合性を重視する方",
        "強烈な支配・洗脳描写が苦手な方",
      ],
      workImpressionParagraphs: [
        "耳元ににゅるにゅる響くスライムの音から入り、意識がすっと引き込まれていきます。耳舐めとは違う水っぽい質感が耳から脳へ侵食していく音像ははっきり届き、後頭部で広がる場面では定位の想像まで迫ってきました。大げさな催眠演出が少ないのに、気づいたら深いところまで落ちている。技術の高さが伺えます。",
        "本編はスライムが脳を書き換え、支配していくのがストーリーとしての流れです。甘くゆったりとした声が抵抗を溶かし、批判的な思考より快感を感じる場面が増えていきます。「頭の中を書き換えられたからそうなるのは当たり前」という暗示のあとからはもう抗うことすら叶いません。",
        "脳の奥でプチプチと泡が弾ける音とともに、脳イキの快感が訪れます。頭からスライムが抜け出さないゾワゾワは、怖さと気持ちよさを同時に体験でき、ここがタイトルどおりの「脳侵」だと思います。ただペースは穏やかめ。強い刺激を求める日には、物足りなく感じるかもしれません。",
        "スライムの音響と書き換え・支配系が好きな方にはおすすめな一本です。脳内快感をじっくり味わい、聴き終わったあと眠気に落ちたい時に聴く作品です。解除はカウントで現実へ戻れる一方、「寝落ちから覚醒」という説明口調は本編の支配感と温度差があり、物語の整合性を重視する人には好みが分かれると思います。",
      ],
    },
    "saimin-jutsushi-itazura-hypno-show-stage": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "約78分48秒の通し本編として、ステージ仕込みから公開催眠ショー・心象誘導・長めエロ帯・カウント覚醒まで処理するリアルヒプノ系バイノーラル",
      inductionType: "公示ショー系 / イエスセット系 / 心象誘導系",
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
        "明確な解除と安心感を求める方",
        "複雑な感情のまま終わるのが苦手な方",
      ],
      workImpressionParagraphs: [
        "穏やかな入眠誘導だけを求める方や、解除まで丁寧に処理してほしい方には、この作品はあまり向かないかもしれません。草原のロケ音から催眠ショーの幕が開き、古典的な深化が丁寧に進むと思いきや、後半は一気に背徳的なオナニー指示へと切り替わる大胆な構成です。ショーの体裁を保ったまま、リスナーをエロティックな領域へ誘い込む展開は、刺激を求める人には強く響くでしょう。",
        "「大好きな人の耳をなめる特別な日」という設定が、背徳感を伴う快感を強く意識させます。語り手の耳舐めはバイノーラルで頭の奥まで直接届くような感覚があり、「脳みそを直接侵されている」という言葉に思考が止まりやすかったです。梅干しテストから螺旋階段へと進む導入は丁寧で、ショーとしての没入感を高めていました。",
        "10カウントで罪悪感と快感が同時に押し寄せる演出は、精神的な揺さぶりが大きく、脳イキと堕落イキが連続して引き出される体験でした。支配的な暗示が深く入り込み、聴いている間は意識が語り手に強く引き寄せられます。この作品の肝は、ショーという公の場での背徳感と、そこから生まれる強烈な快楽のコントラストにあると感じました。",
        "一方で、覚醒パートが短く、「きれいさっぱり元に戻る」と言われた直後に暗示が残るニュアンスで終わるため、聴き終わったあとにモヤモヤとした余韻が残ります。安心して目を覚ましたい人には少し厳しいかもしれません。しかし、背徳的な支配や脳イキ寄りの催眠ショーを好み、その余韻まで含めて楽しみたい方には、深く刺さる一本だと思います。",
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
      workImpressionParagraphs: [
        "山小屋のベッドで「そのまま眠って大丈夫」と促されるような導入が、聴き手の意識を内側へ深く引き込みます。ローテンションな淫魔の語り口は、一見淡々としているようで、むしろ聴き手の集中力を高める効果がありました。「魅了」という設定が、物語を通して暗示への抵抗を自然と取り除いていくため、スムーズに意識が沈んでいく感覚でした。",
        "「君は私の魔力に囚われちゃってるの」という言葉が聴き手の内面に深く響き、感情と身体的な快感が緻密に連動していく過程が本作の売りです。最初はドライな感覚から始まり、「全身の感度上がっちゃうよ」と誘われるように、背徳的な絶頂へと移行する快感の波は高水準でした。意識が混濁する中で、ゾクゾクとした快感が全身を駆け巡る感覚が鮮明に感じられました。",
        "「もっと吸ってサキュバスの香り」と快感が最高潮に達した後の余韻は、魅了によって堕ちていく感覚を強く残すものでした。しかし、魅了状態からの完全な解除が曖昧に感じられ、催眠後のすっきりとした覚醒感や安心感は限定的です。物語のコンセプトとしては理解できるものの、聴き終えた後の心地よさには、もう少し配慮があっても良いかもしれません。",
        "この作品は、深いトランス状態で堕落や背徳感を味わいたい方に特に向いています。感情と身体感覚が密接に結びつく快感を求める方や、ローテンションな淫魔による焦らしと解放をじっくりと体験したい方には、響く内容だと感じました。終わった後の余韻まで含めて、作品の世界観に深く浸りたいリスナーにおすすめできる作品です。",
      ],
    },
    "saimin-yousei-surround-mugen-iki-mahou": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "三人妖精のサラウンド定位と宣言・ゼロ待機で脳を空にし、重ね掛け快楽魔法と裏筋指魔法まで追い込む通し約1時間49分の長尺催眠",
      inductionType: "サラウンド定位系 / 宣言トリガー系 / 反復カウント系",
      voiceActor: "かの仔",
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
        "穏やかな催眠誘導だけを好む方",
        "M煽り・無限絶頂に抵抗がある方",
      ],
      workImpressionParagraphs: [
        "「ここでおしまい」と一度終わりを告げ、すぐに「なんて嘘だよ」と引き戻される場面が、この作品の遊び心を強く感じさせます。いたずら妖精の語りかけは単なる演出に留まらず、終わりが見えた瞬間に再び意識が真っ白になるループ感が、聴き手を深く飽和させていくようでした。公園のロケ音が自然な環境音となり、サラウンドによる定位変化も相まって、作品世界へスムーズに引き込まれます。",
        "語り手は思考停止と快感を同じ魔法として扱い、「願い叶えてあげる」の合図と「ゼロ」のトリガーで意識を飽和させます。脳イキやドライオーガズムが複合的に誘発され、頭が飛び、一気に弾ける流れは、絶頂が重なって押し寄せるような手触りでした。裏筋指魔法に切り替わった後も刺激の種類が豊かで、飽きさせない工夫が凝らされていますが、純粋な深化型の催眠を求める人には、物足りなさを感じるかもしれません。",
        "この作品は、深いトランスの到達よりも、多層的な快感の報酬で聴き手を魅了する一本だと感じました。解除パートは丁寧に進められるものの、純粋な深化型の催眠を毎回求める方には、少し異なる体験になるでしょう。サラウンド音響を活かした混乱誘導や、宣言とカウントによる脳イキ、そして無限に続くドライオーガズムを好む方には、特に深く刺さる作品だと思います。",
      ],
    },
    "saimin-school-hypnosis-training": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "9名が同一台本を読む聴き比べ構成で、自分に合う声を見つけながら催眠導入を深められるスクール型作品",
      inductionType:
        "教育導入系 / 深化誘導系 / イメージ誘導系 / 反復刷り込み系",
      voiceActor:
        "かの仔、みもりあいの、陽向葵ゅか、あきら、一条ひらめ、ユメノシオリ、山田じぇみ子、月村望、御上みみ（同一台本）",
      majorFetish:
        "初心者向け / 声優比較 / イメージ誘導 / 講義形式 / 催眠トレーニング",
      kinkType: "ノーマル",
      recommendedLevel: "初級トランス（重感・深い脱力まで導入できる）以上の方",
      recording: "約1時間58分27秒（22トラック通し・同一台本聴き比べ）",
      recommendedFor: [
        "自分に合う声優を聴き比べで見つけたい方",
        "催眠の基礎から深く体験したい方",
        "長尺でじっくりと催眠に浸りたい方",
      ],
      notRecommendedFor: [
        "短時間で実践誘導だけを聴きたい方",
        "物語劇やキャラ会話を重視する方",
      ],
      workImpressionParagraphs: [
        "催眠の基礎からじっくり体験したい方、あるいは催眠にかかりにくいと感じている方に特におすすめできる作品です。右腕が重くなる感覚から始まり、「あなたからも歩み寄ってください」と語りかけられることで、リスナー自身が誘導へ参加していく意識が芽生えます。",
        "多層的なイメージ誘導が特徴的で、砂のお城をイメージさせるカウントダウンなど、様々なアプローチで深いトランスへと誘われます。一つの誘導に集中するだけでなく、複数の感覚を刺激されることで、意識が揺さぶられる感覚がありました。",
        "ドライオーガズムや脳イキといった直接的な絶頂ではなく、頭の中がじんわりと幸福感に満たされるような、情緒的な快感が中心です。深い呼吸を促され、体の力が抜けていくのを実感しながら、じわじわと意識が溶けていく感覚が心地よく感じられました。",
        "一方で、明確な絶頂感や強い刺激を求める方には、物足りなく感じるかもしれません。しかし、じっくりと時間をかけて催眠の感覚を深めたい方や、催眠体験そのものを理解したい方には、非常に良い機会になる一本だと感じます。",
      ],
    },
    "shoshinsha-mugen-rakka-ecstasy": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "立ちリラックスと分割弛緩、無限落下イメージと加速カウントでドライ絶頂を反復する同梱・無限落下エクスタシールート（約1時間35分）",
      inductionType:
        "身体的誘導系 / 分割弛緩系 / 落下イメージ系 / カウント誘導系",
      voiceActor: "恋鈴桃歌",
      majorFetish:
        "初心者向け / 分割弛緩 / 落下体感 / 立ちリラックス / カウント絶頂",
      kinkType: "ノーマル",
      recommendedLevel: "初心者（浅いトランス＋立ち運動・脱力受容が可能）以上の方",
      recording: "約1時間35分45秒（リラックス運動＋本編＋解除）",
      recommendedFor: [
        "分割弛緩や落下誘導が好きな方",
        "加速カウントでドライ絶頂を重ねたい方",
        "初心者向け無限落下シチュが好きな方",
      ],
      notRecommendedFor: [
        "物語や掛け合いが好きな方（分割弛緩と落下カウントの積層が主役）",
        "興奮の余韻をじっくり整えたい方（本編末の切り替えがやや急）",
      ],
      workImpressionParagraphs: [
        "「無限落下エクスタシー」は、その名の通り終わりなく落ちていく感覚に身を委ねる作品です。初心者向けと銘打たれていますが、深く落ちていく快感を求めるリスナーへ向けた、落下誘導とカウントダウンが特徴的だと感じました。",
        "本編では「カウントの度に落下速度は加速するのにそうやって落ちて意識が持っていかれる度に快感が倍増しちゃうのに」という言葉の通り、数字が減るごとに意識が遠のくような感覚が訪れます。ゾクゾクする背筋の痺れが、気持ちいい場所へ集まるように意識を奪い、快感へと向かわせる流れが印象的でした。",
        "「行く行く行く行く0」のカウントで意識が飛ぶほどの絶頂が訪れ、それが何度も繰り返されることでドライオーガズムが深く刻まれます。「白目向いて絶頂しなさい」といった強い言葉で、快感に身を任せる瞬間が強調されていました。しかし、初心者向けとしては刺激が強すぎると感じる方もいるかもしれません。",
        "分割弛緩や落下による深い催眠誘導を好む方、加速するカウントでドライ絶頂を重ねていきたい方に特に向いています。初心者向けとありますが、ある程度催眠音声に慣れていて、強い刺激を求める方がより深く楽しめる作品だと感じました。",
      ],
    },
    "shoshinsha-nouiki-ho-whiteout": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "レクリで音への集中を整えたうえ、双子定位と真っ白ジャーニー、「行く練習」で脳内のドライ絶頂を反復しやすい同梱・脳イキホワイトアウトルート（約1時間12分）",
      inductionType: "イメージ誘導系 / 双子定位系 / カウント誘導系",
      voiceActor: "乙倉ゅい",
      majorFetish: "初心者向け / 脳イキ / 白空間ジャーニー / 双子形式 / 行く練習",
      kinkType: "ノーマル",
      recommendedLevel: "初心者（浅いトランス＋イメージ受容が可能）以上の方",
      recording: "約1時間12分19秒（レクリ＋本編＋解除）",
      recommendedFor: [
        "催眠音声初心者で用語と体感の例が欲しい方",
        "イメージ誘導で深く落ちたい方",
        "双子形式の左右定位で注意を運ばれたい方",
        "脳イキを行く練習として試したい方",
      ],
      notRecommendedFor: [
        "視覚イメージを頭で組み立てるのが苦手な方（左右定位の双子形式にも負担を感じやすい）",
      ],
      workImpressionParagraphs: [
        "左右から聞こえる双子の声が、まるで耳元で掛け合っているかのように響き渡り、聴き始めから驚きがありました。「雲の中へと降りていくような感覚」といった言葉のイメージ誘導が、心地よい浮遊感とともに意識を深く引き込んでいきます。",
        "綿菓子に包まれるような優しい導入から、「頭の中快楽に支配されて」と語りかけられ、意識が真っ白になるほどの快感へと誘われます。「ゼロ気持ちいい感触」の声で訪れる絶頂は、全身が溶け出すような脱力感とともに、深く意識を飛ばす感覚でした。",
        "「何度も何度も飛ぶ」という言葉通り、ドライオーガズムを重ねていくことで、より深く意識を失う体験ができます。一方で、イメージ誘導が苦手な方や、より直接的な身体への刺激を求める方には、やや物足りなさを感じるかもしれません。",
        "二声による掛け合いと、綿密なイメージ誘導で心を深く落ち着かせたい方に特に向いています。「脳イキホワイトアウト」というタイトル通り、頭の中が真っ白になるほどの感覚をじっくりと味わいたい方におすすめしたい一本です。",
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
      scoreLabel: "9.0 / 10",
      oneLine:
        "こと玉融合で語彙が段階的に下品化し、言葉だけの絶頂と指添えドライのあとカウント射精まで追い込む言語責め催眠",
      inductionType: "論理説得系 / 言霊体感化系 / 段階カウント系",
      voiceActor: "逢坂成美",
      majorFetish:
        "言葉責め / 下品語段階化 / カウント絶頂 / ドライ→ウェット / M向け",
      kinkType: "ドM",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約2時間13分（4パート通し）",
      recommendedFor: [
        "言葉で背徳的に高まる快感を味わいたい方",
        "実験室・研究者シチュが好きな方",
        "ドライ絶頂から射精まで段階的に追い込まれたい方",
      ],
      notRecommendedFor: [
        "下品語・マゾ言責めが苦手な方",
        "完全にクリーンな覚醒だけを求める方",
      ],
      workImpressionParagraphs: [
        "「だんだん下品になる催眠音声」というタイトルがまず目を引きました。催眠状態へと導きながら、言葉によって聴き手の意識を「下品さ」へと向かわせる、そのアプローチは独創的だと感じます。導入では「なぜ催眠状態になるのか疑問に感じるのですね」と問いかけ、まるで研究室の被験者になったような独特の空気感で引き込まれました。",
        "導入では「光る玉」のイメージを使い、まぶたの裏の光から全身へと白い光が広がる感覚が具体的に語られます。その光が身体の緊張している部分に触れ、力を込めて解放する誘導は、身体感覚に訴えかける細やかなものでした。「私の言葉以外、入ってくる情報はありません」という暗示が深く響き、聴き手の意識を完全にコントロールしようとする強い意志が感じられます。",
        "深いトランス状態に入った後、「下品になるほど気持ちいい」というコンセプトがじわじわと効いてきます。最初は「おちんちん」といった言葉から始まり、口調の変化とともに背徳感と快感が徐々に高まっていくのが特徴的でした。言葉だけで快感のピークを作り出し、その後指添えだけのドライからカウント射精へと続く流れは、聴き手を徹底的に追い込むような手触りです。",
        "言葉の力で背徳的な快感を深めたい方や、研究室のようなシチュエーションでじっくりと変性意識に浸りたい方には特に向いているでしょう。序盤の論理的な説明がやや長く、早く快感に入りたい人には少しもどかしく感じるかもしれません。しかし、その分深く没入できたときの快感は格別でした。",
      ],
    },
    "numa-futari-akujo-free-hypnosis-rj01129822": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "双子の悪女が左右から囁きと吐息で混線を作り、魔性キスと耳舐めのあと20→40→60%の段階カウントでドライを3回回収する無料バイノーラル催眠",
      inductionType: "イメージ誘導系 / 深化誘導系 / 支配・服従系",
      voiceActor: "陽向葵ゅか / そらまめ。",
      majorFetish: "双子責め / キス / 吐息 / 耳舐め / マゾ言責め / 段階ドライ",
      kinkType: "ドM",
      recommendedLevel:
        "中級トランス（暗示を受け入れられる・絶頂反応は未達）以上の方",
      recording: "約55分39秒（本編・1トラック通し）",
      recommendedFor: [
        "双子悪女・マゾシチュが好きな方",
        "キス・吐息・耳舐めが好きな方",
        "段階ドライ・カウント絶頂が好きな方",
      ],
      notRecommendedFor: [
        "明確な完了感とすっきりした着地を重視する方",
        "マゾ言責めや強い支配語が苦手な方",
      ],
      workImpressionParagraphs: [
        "左右の悪女「ロベリア」と「クレモチス」が、リスナーのマゾ性を優しく、しかし確信的に暴いていく導入が印象的でした。アメ玉になぞらえた「なめとかされ、噛み砕かれ、美味しく味わわれること」という言葉が、この作品の方向性を強く示しています。",
        "左右から囁きかけられる声が脳内を侵食し、瞼の裏に幻覚が浮かぶような感覚に浸りました。吐息による全身の脱力から、二人の悪女による魔性のキスへと誘われる流れは、抗えない快感に身を委ねる感覚が強かったです。ドライ絶頂へ向かうカウントは、じわじわと追い込まれるような興奮を覚えました。",
        "悪女二人の支配的な言葉と、吐息やキスといった濃厚な接触が続くため、そういったシチュエーションが苦手な方には少し重く感じるかもしれません。しかし、マゾヒズムに目覚めたい方や、左右からの同時攻めに身を委ねて快楽を深く求める方には、まさに「沼」へと引きずり込まれるような体験ができる一本だと感じました。",
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
              <div className="flex flex-col gap-3 sm:gap-4">
                {showHeaderBadges ? (
                  <ReviewHeaderBadges
                    showNew={showNewBadge}
                    showShinsaku={showShinsakuBadge}
                    rankingEntries={dlsiteRankingBadges}
                  />
                ) : null}
                <h1
                  className={`w-full min-w-0 text-2xl font-bold leading-snug tracking-tight text-slate-50 sm:text-3xl sm:leading-tight ${isArticle || titleHasBreak ? "whitespace-pre-line text-pretty" : "text-balance"} ${isArticle ? "max-sm:text-[1.7rem] max-sm:leading-snug" : ""}`}
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
