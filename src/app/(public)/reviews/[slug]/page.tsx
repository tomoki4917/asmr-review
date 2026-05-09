import type { Metadata } from "next";
import BananaSlug from "github-slugger";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateButton, AffiliateButtonGroup } from "@/components/AffiliateButton";
import { MatureContentNotice } from "@/components/MatureContentNotice";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewJsonLd } from "@/components/ReviewJsonLd";
import { ArticleNextNav } from "@/components/ArticleNextNav";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { StarRating } from "@/components/StarRating";
import { ReviewNewBadge } from "@/components/ReviewNewBadge";
import { ShinsakuBadge } from "@/components/ShinsakuBadge";
import { DlsitePricePanel } from "@/components/DlsitePricePanel";
import { ReviewModeSwitcher } from "@/components/ReviewModeSwitcher";
import { resolveSocialPreviewImage, siteUrl } from "@/lib/og-metadata";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import {
  articlePublishedTimeIso,
  effectiveDisplayPublishedIsoDate,
  formatPublishedAtForList,
} from "@/lib/format-published-at";
import {
  getAllSlugs,
  getReviewBySlug,
  isReviewVisibleOnSite,
} from "@/lib/reviews";
import {
  splitBeforeAtRecommendedAudience,
  splitBodyAtFinalRating,
  splitRatingAtWorkIntroLabel,
  splitRestAfterWorkImpression,
} from "@/lib/split-review-body";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
} from "@/lib/dlsite-product-catalog";
import { resolveDlsiteAffiliateHref } from "@/lib/resolve-dlsite-affiliate-href";
import type { AffiliateLink } from "@/lib/types";

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

/** 文頭サマリー横。先頭リンクのラベルを作品ページ導線に統一 */
function affiliateLinksHeader(links: AffiliateLink[]): AffiliateLink[] {
  return links.map((l, i) =>
    i === 0 ? { ...l, label: "作品ページはこちら" } : l
  );
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

function extractDryWetCounts(markdown?: string): string | undefined {
  if (!markdown) return undefined;
  const normalized = normalizeZenkakuDigits(markdown.replace(/\r\n/g, "\n"));
  const dryMatch = normalized.match(/ドライ\s*([0-9]+)\s*回/);
  const wetMatch = normalized.match(/ウェット\s*([0-9]+)\s*回/);

  const dry = dryMatch?.[1];
  const wet = wetMatch?.[1];
  if (!dry && !wet) return undefined;
  if (dry && wet) return `ドライ${dry}回 / ウェット${wet}回`;
  if (dry) return `ドライ${dry}回`;
  return `ウェット${wet}回`;
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
  const titleHasBreak = review.title.includes("\n");
  const nextReview = review.nextSlug
    ? getReviewBySlug(review.nextSlug)
    : undefined;

  const dlsiteProduct =
    !isArticle && review.dlsiteProductId != null
      ? getDlsiteProductById(review.dlsiteProductId)
      : undefined;

  const nowBadges = new Date();
  const showNewBadge = isReviewNewPublication(review, nowBadges);
  const showShinsakuBadge =
    !isArticle && isDlsiteProductShinsaku(dlsiteProduct, nowBadges);
  const showHeaderBadges = showNewBadge || showShinsakuBadge;

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

  const hasAffiliateContent =
    review.affiliateLinks.length > 0 || Boolean(review.coverAffiliateHref);

  const finalRatingSplit = review.body
    ? splitBodyAtFinalRating(review.body)
    : null;
  const restWorkSplit =
    finalRatingSplit?.rest != null
      ? splitRestAfterWorkImpression(finalRatingSplit.rest)
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
      tempoType: string;
      majorFetish: string;
      kinkType: string;
      recommendedLevel: string;
      recording: string;
      recommendedFor: string[];
      notRecommendedFor: string[];
    }
  > = {
    "jinsei-senpai-koi-dorei-mind-control": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "先輩後輩ドラマで関係を固め、はい／いいえの質問反復とトリガーで恋ドレイ化へ連れていく約163分のマインドコントロール",
      inductionType: "洗脳系 / 服従・支配系 / 反復刷り込み系",
      voiceActor: "野上菜月",
      tempoType: "ややゆっくり / 断続系（間が多い）",
      majorFetish: "主従関係 / 言葉責め / 耳舐め / 乳首責め / 前立腺責め",
      kinkType: "M推奨",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約163分（バイノーラル）",
      recommendedFor: [
        "「はい／いいえ」だけで思考を放棄したい",
        "長い時間をかけてじっくり堕とされたい",
        "特定の合図で体が反応する感覚（トリガー）を味わいたい",
      ],
      notRecommendedFor: [
        "短時間でパッと済ませたい",
        "命令されるのが苦手、対等な関係がいい",
      ],
    },
    "ryomimi-bug-kinshi-anji": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "「行っちゃダメ」の禁止暗示を両耳反復で快感トリガーに反転し、連続ピークから解除まで運ぶ約96分の実験型催眠",
      inductionType: "洗脳系 / 禁止暗示系 / 反復刷り込み系",
      voiceActor: "乙倉ゅい / 恋鈴桃歌",
      tempoType: "ややゆっくり / 断続系（間が多い）",
      majorFetish: "禁止暗示 / 言葉責め / 脳イキ / 寸止め / 両耳責め",
      kinkType: "M推奨",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約96分（バイノーラル）",
      recommendedFor: [
        "反復暗示で深まるタイプの方",
        "禁止暗示の逆説を体験したい方",
        "長尺で一気に落ちたい方",
      ],
      notRecommendedFor: [
        "癒やし中心で聴きたい方",
        "高反復語に疲れやすい方",
      ],
    },
    "kyoku-mugen-zekkyou-count-chikuni": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "双子ショー形式で定位と短文トリガーを積み、逆カウント終端で乳首ドライを連発し、脱出から後催眠・覚醒まで手続きで収束させる約56分のカウント依存型",
      inductionType: "反復刷り込み系 / カウント誘導系 / 双子定位系",
      voiceActor: "乙倉ゅい",
      tempoType: "ややゆっくり / 断続系（間が多い）",
      majorFetish: "乳首責め / カウント責め / 双子定位 / ドライ絶頂 / 後催眠",
      kinkType: "M推奨",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約56分27秒（R-18本編・パッケージ表記／バイノーラル）",
      recommendedFor: [
        "乳首起点でドライ絶頂を深めたい方",
        "カウント終端で反応が立ち上がる感覚を味わいたい方",
        "脱出から覚醒まで通し設計で聴きたい方",
      ],
      notRecommendedFor: [
        "短時間で軽く済ませたい方",
        "後催眠の持ち越し感を避けたい方",
      ],
    },
    "futarigake-saimin-melty-orgasm": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "双子定位と321・ふにゃーん反復で脱力を先行させ、幸福感からキス・カウント・ゼロ合図へ継ぎ足し、部位ローテでドライのみを約105分積む甘系長尺",
      inductionType: "リラックス系 / 快感増幅系 / 反復刷り込み系",
      voiceActor: "みもりあいの",
      tempoType: "ゆっくり / 断続系（間が多い）",
      majorFetish: "双子責め / キス責め / 乳首責め / 亀頭責め / 耳責め",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約1時間45分（01〜09・パッケージ表記／バイノーラル）",
      recommendedFor: [
        "安心トーンで深く入りたい方",
        "長尺でとろとろ没入したい方",
        "解除まで含めて通しで聴きたい方",
      ],
      notRecommendedFor: [
        "短時間で強刺激だけ欲しい方",
        "ウェット描写を重視する方",
      ],
    },
    "unknown-hypno-daijobu-koe-ni-yudanete": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "環境・呼吸・往復深化を長尺で積み、幸福と快感の波を心象入力として重ねて覚醒まで処理する約110分の深催眠構成",
      inductionType: "リラックス系 / 深化反復系 / 同一化誘導系",
      voiceActor: "天知遥",
      tempoType: "ゆっくり / 断続系（間が多い）",
      majorFetish: "耳元囁き / 呼吸同期 / 心象快感 / ドライ絶頂 / 深催眠",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約1時間49分49秒（01〜06・字幕終端／バイノーラル本編）",
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
        "吸気同期と逆カウント反復で深度を固定し、口唇イメージを終端カウントへ接続して脳イキ回収する約40分の誘導特化構成",
      inductionType: "反復刷り込み系 / カウント誘導系 / リラックス系",
      voiceActor: "魔暗ヤミ",
      tempoType: "ややゆっくり / 断続系（間が多い）",
      majorFetish: "カウント責め / 口唇責め / キスイメージ / 脳イキ / 催眠誘導",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約40分24秒（本編・字幕終端）",
      recommendedFor: [
        "数字トリガーで沈みたい方",
        "口唇イメージで快感を高めたい方",
        "四ブロックで進行を把握しながら深めたい方",
      ],
      notRecommendedFor: [
        "短時間の即刺激だけを求める方",
        "強語彙で一気に上げたい方",
      ],
    },
    "asmr-saimin-aman-toro-lip": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "呼吸同期から耳舐めASMRへ接続し、三段暗示で感度・脱力・好意を直列固定して約32分で回収まで完了する短尺高密度催眠",
      inductionType: "リラックス系 / 快感増幅系 / 反復刷り込み系",
      voiceActor: "みもりあいの／和水創太",
      tempoType: "ややゆっくり / 断続系（間が多い）",
      majorFetish: "耳舐め / 囁き / 好意暗示 / ドライ絶頂 / ASMR催眠",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約32分02秒（01+02・字幕終端／バイノーラル）",
      recommendedFor: [
        "短尺で深く落ちたい方",
        "耳刺激と暗示を同時に受けたい方",
        "導入から余韻まで短尺で密度を取りたい方",
      ],
      notRecommendedFor: [
        "長尺ドラマで浸りたい方",
        "実演動作を主軸にしたい方",
      ],
    },
    "warui-inma-kanashiki-koufuku-nadenade-hagu": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "恋人導入で受容を作り、淫魔の幸福快感再定義をナデナデとハグで重ねて背徳と甘さを同時回収する高密度構成",
      inductionType: "リラックス系 / 幸福再定義系 / 反復刷り込み系",
      voiceActor: "みもりあいの／和水創太",
      tempoType: "ややゆっくり / 断続系（間が多い）",
      majorFetish: "ナデナデ / ハグ / 幸福暗示 / 背徳シチュ / ドライ絶頂",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約50分〜約110分（構成分岐／バイノーラル）",
      recommendedFor: [
        "幸福感で落ちたい方",
        "背徳と甘さの温度差を味わいたい方",
        "ナデナデとハグで回収したい方",
      ],
      notRecommendedFor: [
        "短時間で刺激だけ欲しい方",
        "強い肉体実演を主軸にしたい方",
      ],
    },
    "tenshi-akuma-souhan-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "天使と悪魔の二声を同時入力して判断軸を揺らし、連続ドライから終端セルフまで矛盾を快感へ転換する長尺構成",
      inductionType: "競合入力系 / 反復カウント系 / 二重誘導系",
      voiceActor: "野上菜月／花笠れい",
      tempoType: "中速 / 断続〜連続（カウント密度高め）",
      majorFetish: "天使×悪魔 / 相反命令 / 連続ドライ / 終端セルフ",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間42分54秒（01〜04・字幕終端／バイノーラル）",
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
    "sukisuki-surikomi-chudoku-onanie-saimin": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "呼吸同期と深化誘導で受容を固定し、「好き」「名前」「快感」の連結反復で条件付けを成立させて終盤ウェット回収へ収束する長尺構成",
      inductionType: "条件付け系 / 反復刷り込み系 / 深化誘導系",
      voiceActor: "御子柴泉",
      tempoType: "ややゆっくり / 断続系（反復多め）",
      majorFetish: "刷り込み暗示 / 名前呼称 / オナニー指示 / 終端ウェット",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間19分03秒（Tr.1〜Tr.5・字幕終端／バイノーラル）",
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
      tempoType: "中速 / 断続系（手順説明あり）",
      majorFetish: "ノーハンド / 脳イキ / PC筋トレ / 空想セックス / 解除トラック",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（自己調整と暗示受容）",
      recording: "約54分（4トラック・字幕終端合算約53分55秒）",
      recommendedFor: [
        "手順で脳イキを試したい方",
        "筋制御を重視して再現したい方",
        "ノーハンド前提で深めたい方",
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
      tempoType: "ややゆっくり / 断続〜連続（終盤高密度）",
      majorFetish: "連続メスイキ / 受粉比喩 / 逆カウント / 夢催眠 / 愛語反復",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約51分40秒（本編・字幕終端・解析 duration 基準）",
      recommendedFor: [
        "誘導を長く味わいたい方",
        "比喩的な快感設計が好きな方",
        "連続メスイキを追いたい方",
      ],
      notRecommendedFor: [
        "短時間で回収したい方",
        "身体変容イメージが苦手な方",
      ],
    },
    "saimin-shinri-test-dame-iwakareru": {
      scoreLabel: "3.0 / 10",
      oneLine:
        "「ダメ」の禁止語を欲求トリガーに反転し、カリギュラ効果でウェット回収へ段階遷移する快楽重心の心理テスト型構成",
      inductionType: "禁止反転系 / カリギュラ効果系 / 反復刷り込み系",
      voiceActor: "柚木つばめ",
      tempoType: "中速 / 断続〜連続（反復語多め）",
      majorFetish: "禁止暗示 / 手コキ / フェラ / 中出し / お仕置き特典",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（暗示受容と成人描写耐性）",
      recording: "約1時間49分20秒（6トラック通し・derived_metrics duration 基準）",
      recommendedFor: [
        "禁止語で興奮を高めたい方",
        "長尺の焦らしを受けたい方",
        "成人描写を連続で追いたい方",
      ],
      notRecommendedFor: [
        "深い催眠没入を重視する方",
        "終わりの整いを重視する方",
      ],
    },
    "futarigake-saimin-love-happy-orgasm": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "双子の左右定位と褒め反復で安心と快感を同時更新し、幸福感を保ったまま同調ピークへ積層回収する長尺構成",
      inductionType: "リラックス系 / 同調深化系 / 反復刷り込み系",
      voiceActor: "みもりあいの",
      tempoType: "ややゆっくり / 断続〜連続（終盤高密度）",
      majorFetish: "双子掛け合い / 褒め暗示 / 耳刺激 / 幸福ドライ / 愛語反復",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初心者（浅いトランス＋暗示受容が可能）以上の方",
      recording: "約1時間40分43秒（7トラック・字幕終端）",
      recommendedFor: [
        "左右の掛け合いで没入したい方",
        "褒めで深くなりたい方",
        "幸福系ドライを連続で味わいたい方",
      ],
      notRecommendedFor: [
        "強い支配語を求める方",
        "短時間で終えたい方",
      ],
    },
    "hypno-multi-rape": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "複数声の同時入力で判断処理を飽和させ、二段カウントと数字トリガー反復で背徳寄りドライ回収を連鎖させる構成",
      inductionType: "コンフュージョン系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "沢野ぽぷら",
      tempoType: "中速 / 断続〜連続（後半反復密度高め）",
      majorFetish: "複数声囁き / 数字トリガー / 支配語彙 / 背徳ドライ / 覚醒解除",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約49分50秒（5トラック・字幕終端）",
      recommendedFor: [
        "多方向の声圧が好きな方",
        "長めの誘導を受けたい方",
        "数字トリガーで回収したい方",
      ],
      notRecommendedFor: [
        "短尺で済ませたい方",
        "回避不能感が苦手な方",
      ],
    },
    "mayoigo-saimin-hypno-multi-rape": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "単独導入から多声展開へ段階移行し、予言カウントと耳舐め反復で先読み反応を連続回収する約64分+差分のヒプノマルチ構成",
      inductionType: "反復刷り込み系 / カウント誘導系 / 多声展開系",
      voiceActor: "沢野ぽぷら",
      tempoType: "ややゆっくり / 断続〜連続（終盤高密度）",
      majorFetish: "多声囁き / 耳舐め / 連続絶頂 / 予言カウント / ドライオーガズム",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容が可能）以上の方",
      recording: "約64分（本編）+エンドレス差分（バイノーラル）",
      recommendedFor: [
        "予告カウントを聞いた瞬間に反応が走る感覚を深めたい方",
        "単独導入から多声圧へ切り替わる展開を楽しみたい方",
        "耳舐め反復で連続回収を長めに運用したい方",
      ],
      notRecommendedFor: [
        "穏やかな単声催眠だけを求める方",
        "差分運用なしで短時間完結を重視する方",
      ],
    },
    "unreal-hypno": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "膝枕とロケ音で日常同期を保ったまま非現実へ段階遷移し、音そのものを快感トリガーへ変換して耳刺激ドライへ回収する構成",
      inductionType: "リラックス系 / イメージ誘導系 / 音響同調系",
      voiceActor: "天知遥",
      tempoType: "ややゆっくり / 断続系（長尺遷移）",
      majorFetish: "環境音催眠 / 膝枕導入 / 逆カウント / 耳刺激 / ドライ回収",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間25分26秒（6トラック通し）",
      recommendedFor: [
        "環境音で没入したい方",
        "日常から滑らかに落ちたい方",
        "耳刺激主体で快感を取りたい方",
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
      tempoType: "ややゆっくり / 断続〜連続（長尺高密度）",
      majorFetish: "スライム捕食 / 耳奥ASMR / 逆カウント / 失神脳イキ / 解除分離",
      kinkType: "M向け",
      recommendedLevel: "中級者（長尺耐性＋暗示受容）",
      recording: "約2時間15分55秒（4トラック通し）",
      recommendedFor: [
        "捕食系シチュで落ちたい方",
        "耳奥ASMRで脳イキしたい方",
        "長尺で連続ピークを取りたい方",
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
      tempoType: "中速 / 断続〜連続（後半反復密度高め）",
      majorFetish: "男の娘 / 女装魔法少女 / 前立腺責め / ノーハンド射精 / 公開羞恥",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約63分15秒（4トラック通し）",
      recommendedFor: [
        "羞恥シチュで興奮したい方",
        "女装魔法少女化を追いたい方",
        "ドライ連鎖からノーハンドへ行きたい方",
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
      tempoType: "中速 / 断続〜連続（後半反復多め）",
      majorFetish: "主従関係 / マリオネット化 / 寸止め / 多絶頂 / ドライ連鎖",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間12分29秒（本編1ファイル通し）",
      recommendedFor: [
        "人形支配シチュが好きな方",
        "トリガー反復でイキたい方",
        "中尺で段階的に上げたい方",
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
      tempoType: "ややゆっくり / 断続系（反復多め）",
      majorFetish: "敗北TS / 女体化 / 唾液汚染 / 関係固定 / ドライ絶頂",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約1時間30分28秒（#0.5〜#4 通し）",
      recommendedFor: [
        "敗北TSの物語が好きな方",
        "身体改変の細密描写を味わいたい方",
        "甘毒系の支配語が刺さる方",
      ],
      notRecommendedFor: [
        "TSや身体改変が苦手な方",
        "反復の少ない短尺を求める方",
      ],
    },
    "dry-org-amadashi-prostate-nipple": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "甘出し反復で締めと抜きを学習させ、乳首・前立腺刺激とカウント暗示を同期して枯渇後ドライへ収束させる訓練型構成",
      inductionType: "リラックス系 / 反復刷り込み系 / 実践訓練系",
      voiceActor: "天音羽乃",
      tempoType: "ややゆっくり / 断続〜連続（実演長尺）",
      majorFetish: "甘出し / 前立腺責め / 乳首責め / カウント暗示 / ドライ開発",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（自己調整と暗示受容）",
      recording: "約1時間28分48秒（01〜05・同梱本編合計）",
      recommendedFor: [
        "ドライの手順を固めたい方",
        "反復訓練ができる方",
        "乳首と前立腺の同期を育てたい方",
      ],
      notRecommendedFor: [
        "即効ピークのみ求める方",
        "長めの尺の連続指示が苦手な方",
      ],
    },
    "nouiki-trip-denpa-live": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "移動導入から可愛い反復・指合図・歌唱リズムを統合し、ライブ高揚を脳イキ回収へ一本線で接続する長尺構成",
      inductionType: "音響同調系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "野上菜月 / 陽向葵ゅか / そらまめ。 / 乙倉ゅい / 恋鈴桃歌 ほか",
      tempoType: "中速 / 断続〜連続（歌唱帯あり）",
      majorFetish: "ライブ催眠 / 可愛い反復 / 指トリガー / 脳イキ / 歌唱連結",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "約2時間22分（01〜06・販売総再生表記／通常Ver本編は約1時間46分）",
      recommendedFor: [
        "ライブ催眠を味わいたい方",
        "可愛い反復で落ちたい方",
        "音楽主導の脳イキを求める方",
      ],
      notRecommendedFor: [
        "短尺で済ませたい方",
        "静かな囁きだけ欲しい方",
      ],
    },
    "nouiki-youko-noumimi": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "妖狐の情景導入と尻尾ASMRで注意を固定し、脳イキから耳イキへ快感経路を切り替えて二段回収する約76分の通し構成",
      inductionType: "イメージ誘導系 / 音響同調系 / 反復刷り込み系",
      voiceActor: "そらまめ。 / 和水創太（女性向け）",
      tempoType: "ややゆっくり / 断続〜連続（後半高密度）",
      majorFetish: "妖狐シチュ / 尻尾ASMR / 脳イキ / 耳イキ / 経路切替",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容）",
      recording: "男性向け本編 約76分（字幕終端合算約76:03）",
      recommendedFor: [
        "耳から深く落ちたい方",
        "脳イキと耳イキを両方追いたい方",
        "物語ごと通しで没入したい方",
      ],
      notRecommendedFor: [
        "短時間で刺激だけ欲しい方",
        "脳内侵入イメージが苦手な方",
      ],
    },
    "brain-washer": {
      scoreLabel: "8.0 / 10",
      oneLine:
        "前室で運用条件を固定し、儀式語の反復と耳舐めを長尺で積層して深度を押し込み、専用解除まで一体化して完走させる洗脳儀式型",
      inductionType: "洗脳系 / 儀式反復系 / 耳刺激系",
      voiceActor: "逢坂成美",
      tempoType: "ややゆっくり / 断続系（反復儀式中心）",
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
    "futarigake-saimin-coming-orgasm": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "双子の同期呼吸とリップ密集で能動を手放し、GoではなくComeとしてドライの波を迎える受動体験へ寄せる約69分（字幕終端合算／パッケージ約70分）の高密度バイノーラル",
      inductionType: "リラックス系 / バイノーラル快感系 / 受動受容系",
      voiceActor: "みもりあいの",
      tempoType: "ややゆっくり / 断続〜連続（リップ・定位の密度高め）",
      majorFetish: "双子掛け合い / リップASMR / Come受容 / 淫紋・先端帯 / ドライ連鎖",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（感覚優位・情報密度に耐性）",
      recording: "約69分（字幕終端8トラック合算／パッケージ約70分）",
      recommendedFor: [
        "イけばいいより「来る」受容を試したい方",
        "左右定位とリップで没入したい方",
        "Wave型ドライを段階的に積みたい方",
      ],
      notRecommendedFor: [
        "静寂のみの深催眠を求める方",
        "後半の強刺激ギミックが苦手な方",
      ],
    },
    "futarigake-saimin-dry-iki-support": {
      scoreLabel: "10.0 / 10",
      oneLine:
        "ふたりがけ同調で我慢・蓄積・解放を手順化し、ダイヤル・カウント・PC筋・前立腺を反復してドライ到達を支援する長尺サポート型",
      inductionType: "訓練支援型 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "みもりあいの",
      tempoType: "中速 / 断続〜連続（版差・反復多め）",
      majorFetish: "ふたりがけ / 我慢蓄積 / 前立腺・PC筋 / ダイヤル暗示 / ドライ多段",
      kinkType: "ノーマル〜M向け",
      recommendedLevel: "初中級（手順追従と長尺耐性）",
      recording: "約3時間35分（版・トラック合算の目安）",
      recommendedFor: [
        "ドライを再現工程として固めたい方",
        "二声のケアと命令の両立が好きな方",
        "反復訓練で深度を維持したい方",
      ],
      notRecommendedFor: [
        "同型反復が苦手な方",
        "短尺一本完結のみ求める方",
      ],
    },
    "inuka-anji-amatime-oshioki-wakarase": {
      scoreLabel: "6.0 / 10",
      oneLine:
        "甘やかしで受容した直後に犬化語尾と支配・寸止めへ切り替え、約31分の通しで温度差と脳イキ反復を強くぶつける起伏型",
      inductionType: "ペットプレイ系 / 温度差切替系 / 寸止め反復系",
      voiceActor: "紫雲",
      tempoType: "ややゆっくり〜中速 / 通し約31分（落差強め）",
      majorFetish: "犬化暗示 / 甘辛切替 / 寸止め / 支配語 / 脳イキ",
      kinkType: "M向け",
      recommendedLevel: "初中級（役割受容と支配語耐性）",
      recording: "約31分（字幕終端約30:56／derived_metrics整合）",
      recommendedFor: [
        "犬化プレイと甘辛落差が好きな方",
        "通し約31分で温度差を快感にしたい方",
        "寸止め反復で滞留快感を味わいたい方",
      ],
      notRecommendedFor: [
        "支配語・叱責が苦手な方",
        "長い深化を主目的にする方",
      ],
    },
    "jigoku-hypno-multi-rape": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "多声で判断処理を飽和させたうえで誘導三段からエロ四連へ接続し、カウントと命令の反復圧でドライ回収を連鎖させる拘束型長尺",
      inductionType: "コンフュージョン系 / 反復刷り込み系 / カウント誘導系",
      voiceActor: "沢野ぽぷら",
      tempoType: "中速 / 連続（後半反復密度高め）",
      majorFetish: "多声拘束 / カウント圧迫 / 支配語彙 / ドライ四連 / 覚醒解除",
      kinkType: "M向け",
      recommendedLevel: "初中級〜中級（多声・反復耐性）",
      recording: "約1時間47分（01〜09・販売音声時間表記）",
      recommendedFor: [
        "マルチボイス圧で沈みたい方",
        "長尺の同型反復で反応を固定されたい方",
        "カウントトリガーでドライ連鎖したい方",
      ],
      notRecommendedFor: [
        "同型反復が疲れる方",
        "穏やかな情緒催眠のみ求める方",
      ],
    },
    "oton-akachan-hipu-muryoku": {
      scoreLabel: "7.0 / 10",
      oneLine:
        "保育所設定で大人の判断を外し、挨拶・語尾・命令反復で赤ちゃん化を約70分の通しで定着させ、服従報酬からウェット回収へ繋ぐ退行型",
      inductionType: "退行系 / 命令反復系 / 無力化系",
      voiceActor: "あやめ（先生役）",
      tempoType: "ややゆっくり / 連続再生（反復多め）",
      majorFetish: "育児退行 / 赤ちゃん化 / しつけ・授乳語彙 / 服従報酬 / ドライ・ウェット",
      kinkType: "M向け",
      recommendedLevel: "初中級（役割没入と通し耐性）",
      recording: "約70分（01〜03・字幕終端合算）",
      recommendedFor: [
        "先生／園児の上下関係で落ちたい方",
        "命令反復で受動化したい方",
        "通し再生で設定をじわじわ積みたい方",
      ],
      notRecommendedFor: [
        "上下固定・無力化が苦手な方",
        "反復単調さを避けたい方",
      ],
    },
    "miraiyochi-zeccho-countdown": {
      scoreLabel: "9.0 / 10",
      oneLine:
        "未来予知の宣言と絶頂カウントを合図化し、先読み反応を快感増幅へ転換して連続ピークへ運ぶ約198分の二本立て催眠",
      inductionType: "予言トリガー系 / カウント誘導系 / 関係固定系",
      voiceActor: "陽向葵ゅか / みたかりん",
      tempoType: "中速 / 断続〜連続（後半反復密度高め）",
      majorFetish: "未来予知暗示 / 絶頂カウント / 教祖・崇拝 / キス責め / 脳イキ",
      kinkType: "M向け",
      recommendedLevel: "初中級（中程度トランス＋暗示受容が可能）以上の方",
      recording: "kuroko.版 約104分 / サイミー版 約94分",
      recommendedFor: [
        "予言カウントで反応を引き出されたい方",
        "先読みしてしまう感覚ごと快感にしたい方",
        "同コンセプトの別運用を聴き比べたい方",
      ],
      notRecommendedFor: [
        "穏やかな癒やしだけを求める方",
        "主従・崇拝の関係語が苦手な方",
      ],
    },
  };
  const quickGuideSpec = quickGuideBySlug[review.slug];
  const enableTwoModeReview = Boolean(quickGuideSpec);
  const quickDryWetCounts = extractDryWetCounts(review.body);
  const quickDiscountLabel = dlsiteProduct?.on_sale
    ? `今なら${dlsiteProduct.discount_rate}%OFF`
    : "価格はページでご確認ください";
  const quickAffiliateHref = resolveDlsiteAffiliateHref(review) ?? "#";
  const quickSampleHref =
    review.affiliateLinks.find((link) => /体験版|サンプル/.test(String(link.label ?? "")))?.href ??
    undefined;

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

        {!isArticle ? (
          <MatureContentNotice context="review" className="mt-5 sm:mt-6" />
        ) : null}

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
                className={`mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6 ${
                  review.affiliateLinks.length > 0 ? "sm:justify-between" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <SummaryMarkdown markdown={review.summary} />
                </div>
                {review.affiliateLinks.length > 0 ? (
                  <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:max-w-[min(100%,18rem)] sm:pt-0.5">
                    {review.affiliateLinks.length === 1 ? (
                      <AffiliateButton
                        link={affiliateLinksHeader(review.affiliateLinks)[0]}
                        className="min-h-11 w-full px-5 py-2.5 text-sm sm:min-w-[12rem]"
                      />
                    ) : (
                      <AffiliateButtonGroup
                        links={affiliateLinksHeader(review.affiliateLinks)}
                        className="w-full flex-col sm:w-auto"
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
              {hasAffiliateContent ? (
                <p
                  className="mt-4 border-t border-slate-700/25 pt-3 text-[11px] leading-relaxed text-slate-600 sm:text-xs"
                  role="note"
                >
                  ※本ページには紹介用のリンクが含まれる場合があります。成果が生じた際、当サイトに紹介料が入ることがあります。
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {enableTwoModeReview ? (
          <ReviewModeSwitcher
            quickTitle="1分で判断！クイック解析"
            detailTitle="しっかり見たい人向け！作品詳細解析"
            quickAffiliateHref={quickAffiliateHref}
            quickDiscountLabel={quickDiscountLabel}
            quickIsOnSale={Boolean(dlsiteProduct?.on_sale)}
            quickSampleHref={quickSampleHref}
            quickScoreLabel={quickGuideSpec?.scoreLabel ?? `${review.ratingValue}.0 / ${best}`}
            quickDryWetCounts={quickDryWetCounts}
            quickOneLine={
              quickGuideSpec?.oneLine ??
              "作品固有の体験を要点だけで把握できるクイック解析です。"
            }
            quickInductionType={quickGuideSpec?.inductionType ?? "分析中"}
            quickVoiceActor={quickGuideSpec?.voiceActor ?? ""}
            quickTempoType={quickGuideSpec?.tempoType ?? "分析中"}
            quickMajorFetish={quickGuideSpec?.majorFetish ?? "分析中"}
            quickKinkType={quickGuideSpec?.kinkType ?? "ノーマル"}
            quickRecommendedLevel={quickGuideSpec?.recommendedLevel ?? "初中級（中程度トランス＋暗示受容）"}
            quickRecording={quickGuideSpec?.recording ?? "収録時間を確認中"}
            quickRecommendedFor={
              quickGuideSpec?.recommendedFor ?? ["作品ごとの相性要件を整理中です。"]
            }
            quickNotRecommendedFor={
              quickGuideSpec?.notRecommendedFor ?? ["合わない可能性のある条件を整理中です。"]
            }
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
                        しっかり見たい人向け！作品詳細解析
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
                      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                        <div className="min-w-0 flex-1">
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
                          <div className="w-full shrink-0 sm:w-auto sm:max-w-[min(100%,20rem)] sm:pt-1">
                            <AffiliateButtonGroup
                              links={affiliateLinksBesideRating(review.affiliateLinks)}
                              className="w-full sm:w-auto"
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
                    {finalRatingSplit.rest.trim() ? (
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
                              markdown={finalRatingSplit.rest}
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
            {!isArticle ? (
              <section className="mt-6 rounded-2xl border border-slate-600/45 bg-slate-800/45 px-5 py-5 shadow-sm shadow-slate-950/20 sm:mt-7 sm:px-6 sm:py-6">
                {bodyH2Headings.length > 0 ? (
                  <nav
                    className=""
                    aria-label="本文見出し"
                  >
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
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                  <div className="min-w-0 flex-1">
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
                    <div className="w-full shrink-0 sm:w-auto sm:max-w-[min(100%,20rem)] sm:pt-1">
                      <AffiliateButtonGroup
                        links={affiliateLinksBesideRating(review.affiliateLinks)}
                        className="w-full sm:w-auto"
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
              {finalRatingSplit.rest.trim() ? (
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
                        markdown={finalRatingSplit.rest}
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
