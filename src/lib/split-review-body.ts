/**
 * 本文の `## 総合評価` で分割する（見出し横にアフィリエイト用）。
 * 見出し直後から、次の `## `（h2）手前までを `rating`。それ以降を `rest`（作品像・パート解説など）。
 */

/**
 * `rating` 文字列内の `### 作品解説と感想` で二分割する。
 * 星・価格・注記までを `core`、ラベル見出し以降を `workIntro` とし、体験版ボタンを `core` と同列に置く（モバイルでもラベルの下にボタンが来ない）。
 */
export function splitRatingAtWorkIntroLabel(rating: string): {
  core: string;
  workIntro: string;
} {
  const n = rating.replace(/\r\n/g, "\n");
  const needle = "\n### 作品解説と感想";
  const i = n.indexOf(needle);
  if (i === -1) {
    if (n.startsWith("### 作品解説と感想")) {
      return { core: "", workIntro: n.trim() };
    }
    return { core: n.trim(), workIntro: "" };
  }
  return {
    core: n.slice(0, i).trimEnd(),
    workIntro: n.slice(i + 1).trimStart(),
  };
}

/** `rest` 内の `## 作品感想` または `### 作品感想` ブロック直後で分割（購入ボタン挿入用）。該当見出しが無ければ null。 */
export function splitRestAfterWorkImpression(rest: string): {
  before: string;
  after: string;
} | null {
  const n = rest.replace(/\r\n/g, "\n");
  const re = /\n#{2,3} 作品感想\s*\n/;
  const m = re.exec(n);
  if (!m) return null;
  const contentStart = m.index + m[0].length;
  const remainder = n.slice(contentStart);
  const nextH = /\n#{2,3}\s+/;
  const m2 = nextH.exec(remainder);
  const body = m2 ? remainder.slice(0, m2.index) : remainder;
  const endPos = contentStart + body.length;
  return {
    before: n.slice(0, endPos).trimEnd(),
    after: n.slice(endPos).trimStart(),
  };
}

/**
 * `## 総合評価` より前の `before` を、`## どんな人におすすめか` で二分割する。
 * 見つからなければ null（従来どおり一括表示）。
 */
export function splitBeforeAtRecommendedAudience(before: string): {
  prefix: string;
  audience: string;
} | null {
  const n = before.replace(/\r\n/g, "\n").trimEnd();
  const needle = "\n## どんな人におすすめか\n";
  const idx = n.indexOf(needle);
  if (idx !== -1) {
    return {
      prefix: n.slice(0, idx).trimEnd(),
      audience: n.slice(idx + 1).trimStart(),
    };
  }
  if (n.startsWith("## どんな人におすすめか\n")) {
    return { prefix: "", audience: n.trimStart() };
  }
  const audienceLeads = [
    "\n**おすすめしたい方**",
    "\n**【こんな人におすすめ】**",
  ] as const;
  for (const audienceLead of audienceLeads) {
    const leadIdx = n.indexOf(audienceLead);
    if (leadIdx !== -1) {
      return {
        prefix: n.slice(0, leadIdx).trimEnd(),
        audience: n.slice(leadIdx + 1).trimStart(),
      };
    }
  }
  if (n.startsWith("**おすすめしたい方**") || n.startsWith("**【こんな人におすすめ】**")) {
    return { prefix: "", audience: n.trimStart() };
  }
  return null;
}

/** `ReviewMarkdown` がパネル／横スクロールを挟むときの分割単位 */
export type MarkdownReviewPipeSegment =
  | { kind: "markdown"; source: string }
  | {
      kind: "workImpressionPanel";
      /** `## 作品感想` / `### 作品感想` の1行（末尾改行付き） */
      headingMarkdown: string;
      /** 次のレベル2見出し `## ` 手前まで（パネル内にレンダリング） */
      bodyMarkdown: string;
    }
  | {
      kind: "workSummaryPanel";
      /** `## 作品概要` の1行（末尾改行付き） */
      headingMarkdown: string;
      /** 次のレベル2見出し `## ` 手前まで（カード分割のもとになる本文） */
      bodyMarkdown: string;
    };

/** @deprecated `MarkdownReviewPipeSegment` と同義 */
export type MarkdownWorkImpressionSegment = MarkdownReviewPipeSegment;

/**
 * `## 作品概要` 直下の本文を `### ` 見出し単位で分割（横スクロールのカード用）。
 */
export function splitMarkdownByH3Sections(body: string): string[] {
  const n = body.replace(/\r\n/g, "\n").trimEnd();
  if (!n) return [];
  const parts = n.split(/\n(?=### )/);
  return parts.map((p) => p.trimEnd()).filter((p) => p.length > 0);
}

/** `## 作品概要` の横スクロール枠に含めず、直後の通常本文として出す `###`（`\b` は日本語見出しで効かないため使わない） */
const WORK_SUMMARY_OUTSIDE_PANEL_H3_RES = [/^###\s+視聴時の注意/, /^###\s+作品評価グラフ/];

/**
 * `### 視聴時の注意` / `### 作品評価グラフ` をパネル外に回し、それ以外を概要パネル本文に残す。
 */
export function partitionWorkSummaryPanelBodyAndOutside(bodyMarkdown: string): {
  panelBodyMarkdown: string;
  outsideMarkdown: string;
} {
  const chunks = splitMarkdownByH3Sections(bodyMarkdown);
  const inside: string[] = [];
  const outside: string[] = [];
  for (const chunk of chunks) {
    const head = chunk.split("\n")[0]?.trim() ?? "";
    const isOutside = WORK_SUMMARY_OUTSIDE_PANEL_H3_RES.some((re) => re.test(head));
    if (isOutside) outside.push(chunk.trimEnd());
    else inside.push(chunk.trimEnd());
  }
  return {
    panelBodyMarkdown: inside.filter((c) => c.length > 0).join("\n\n"),
    outsideMarkdown: outside.filter((c) => c.length > 0).join("\n\n"),
  };
}

/**
 * `## 作品概要` から次の `## ` 手前までを切り出し、概要ブロックとしてマークする。
 */
export function partitionMarkdownAtWorkSummaryHeadings(
  markdown: string
): MarkdownReviewPipeSegment[] {
  const n = markdown.replace(/\r\n/g, "\n");
  const segments: MarkdownReviewPipeSegment[] = [];
  let pos = 0;

  while (pos < n.length) {
    const rest = n.slice(pos);
    const headingMatch = rest.match(/(?:^|\n)(## 作品概要\s*\n)/);
    if (!headingMatch || headingMatch.index === undefined) {
      const tail = n.slice(pos);
      if (tail.length > 0) {
        segments.push({ kind: "markdown", source: tail });
      }
      break;
    }

    const idx = headingMatch.index;
    const prefix = rest.slice(0, idx);
    if (prefix.length > 0) {
      segments.push({ kind: "markdown", source: prefix });
    }

    const headingMarkdown = headingMatch[1];
    const absHeadingEnd = pos + idx + headingMatch[0].length;
    const afterHeading = n.slice(absHeadingEnd);
    const nextH2Match = afterHeading.match(/\n## (?![#])/);
    const bodyLen =
      nextH2Match && nextH2Match.index !== undefined
        ? nextH2Match.index
        : afterHeading.length;
    const bodyMarkdown = afterHeading.slice(0, bodyLen).trimEnd();

    const { panelBodyMarkdown, outsideMarkdown } =
      partitionWorkSummaryPanelBodyAndOutside(bodyMarkdown);

    segments.push({
      kind: "workSummaryPanel",
      headingMarkdown,
      bodyMarkdown: panelBodyMarkdown,
    });

    if (outsideMarkdown.trim()) {
      segments.push({ kind: "markdown", source: outsideMarkdown });
    }

    pos = absHeadingEnd + bodyLen;
  }

  return segments.length > 0 ? segments : [{ kind: "markdown", source: n }];
}

/**
 * 作品概要パネル → 作品感想パネルの順で適用する（感想ブロックが概要より後ろにある前提）。
 */
export function partitionStarReviewMarkdown(markdown: string): MarkdownReviewPipeSegment[] {
  const impressionChunks = partitionMarkdownAtWorkImpressionHeadings(markdown);
  const out: MarkdownReviewPipeSegment[] = [];
  for (const seg of impressionChunks) {
    if (seg.kind !== "markdown") {
      out.push(seg);
      continue;
    }
    out.push(...partitionMarkdownAtWorkSummaryHeadings(seg.source));
  }
  return out.length > 0 ? out : [{ kind: "markdown", source: markdown.replace(/\r\n/g, "\n") }];
}

/**
 * `## 作品感想`（または `###`）から次の `## ` 手前までを1ブロックとして切り出す。
 * HTML でラップすると内部 Markdown がパースされないため、セグメント分割でパネルを挟む。
 */
export function partitionMarkdownAtWorkImpressionHeadings(
  markdown: string
): MarkdownReviewPipeSegment[] {
  const n = markdown.replace(/\r\n/g, "\n");
  const segments: MarkdownReviewPipeSegment[] = [];
  let pos = 0;

  while (pos < n.length) {
    const rest = n.slice(pos);
    const headingMatch = rest.match(/(?:^|\n)(#{2,3} 作品感想\s*\n)/);
    if (!headingMatch || headingMatch.index === undefined) {
      const tail = n.slice(pos);
      if (tail.length > 0) {
        segments.push({ kind: "markdown", source: tail });
      }
      break;
    }

    const idx = headingMatch.index;
    const prefix = rest.slice(0, idx);
    if (prefix.length > 0) {
      segments.push({ kind: "markdown", source: prefix });
    }

    const headingMarkdown = headingMatch[1];
    const absHeadingEnd = pos + idx + headingMatch[0].length;
    const afterHeading = n.slice(absHeadingEnd);
    const nextH2Match = afterHeading.match(/\n## (?![#])/);
    const bodyLen =
      nextH2Match && nextH2Match.index !== undefined
        ? nextH2Match.index
        : afterHeading.length;
    const bodyMarkdown = afterHeading.slice(0, bodyLen).trimEnd();

    segments.push({
      kind: "workImpressionPanel",
      headingMarkdown,
      bodyMarkdown,
    });

    pos = absHeadingEnd + bodyLen;
  }

  return segments.length > 0 ? segments : [{ kind: "markdown", source: n }];
}

/**
 * 最初のレベル2見出し `## ` 手前で分割する（記事のリード文と本文）。
 * 先頭から `## ` が始まる場合は `lead` は空、`main` は全文。
 */
export function splitBodyAtFirstH2(body: string): { lead: string; main: string } {
  const normalized = body.replace(/\r\n/g, "\n");
  const firstH2 = normalized.search(/(?:^|\n)## (?![#])/);
  if (firstH2 === -1) {
    return { lead: normalized.trimEnd(), main: "" };
  }
  if (firstH2 === 0) {
    return { lead: "", main: normalized.trim() };
  }
  const lead = normalized.slice(0, firstH2).trimEnd();
  const main = normalized.slice(firstH2 + 1).trimStart();
  return { lead, main };
}

const INDUCTION_ANALYSIS_H2_LABELS = [
  "本作の誘導・暗示解析詳細",
  "本作の誘導・暗示解析",
] as const;

/**
 * `## 総合評価` より後の `rest` から `## 本作の誘導・暗示解析（詳細）` ブロックを切り出す。
 * 記事モードの「解析データ」タブと詳細本文の重複表示を避けるため。
 * 表ブロックと流れブロックの分割は `splitInductionAnalysisContent` を使う。
 */
export function splitRestAtInductionAnalysis(rest: string): {
  induction: string;
  afterRest: string;
} | null {
  const n = rest.replace(/\r\n/g, "\n").trimEnd();

  function sliceInduction(afterHeading: string): { induction: string; after: string } {
    const nextH2 = /\n## (?![#])/;
    const m = nextH2.exec(afterHeading);
    if (!m) {
      return { induction: afterHeading.trim(), after: "" };
    }
    return {
      induction: afterHeading.slice(0, m.index).trim(),
      after: afterHeading.slice(m.index).trimStart(),
    };
  }

  for (const label of INDUCTION_ANALYSIS_H2_LABELS) {
    const midNeedle = `\n## ${label}\n`;
    const midIdx = n.indexOf(midNeedle);
    if (midIdx !== -1) {
      const before = n.slice(0, midIdx).trimEnd();
      const { induction, after } = sliceInduction(n.slice(midIdx + midNeedle.length));
      if (!induction) return null;
      const afterRest = [before, after].filter((part) => part.length > 0).join("\n\n");
      return { induction, afterRest };
    }
    const startNeedle = `## ${label}\n`;
    if (n.startsWith(startNeedle)) {
      const { induction, after } = sliceInduction(n.slice(startNeedle.length));
      if (!induction) return null;
      return { induction, afterRest: after };
    }
  }

  return null;
}

const INDUCTION_FLOW_START_HEADING = "### 主要誘導の流れ";

/**
 * `## 本作の誘導・暗示解析詳細` 本文を、記事モード「解析データ」（表）と詳細本文（流れ）に分ける。
 */
export function splitInductionAnalysisContent(induction: string): {
  analysisTables: string;
  inductionFlow: string;
} {
  const n = induction.replace(/\r\n/g, "\n").trim();
  if (!n) {
    return { analysisTables: "", inductionFlow: "" };
  }
  const idx = n.indexOf(INDUCTION_FLOW_START_HEADING);
  if (idx === -1) {
    if (n.includes("### 誘導構成比")) {
      return { analysisTables: n, inductionFlow: "" };
    }
    return { analysisTables: "", inductionFlow: n };
  }
  return {
    analysisTables: n.slice(0, idx).trim(),
    inductionFlow: n.slice(idx).trim(),
  };
}

export type ArticleModeInductionSplit = {
  /** B 型四表があり「解析データ」タブを出す */
  enableAnalysisDataTab: boolean;
  /** 解析データタブ用 Markdown（四表ブロックのみ） */
  analysisDataMarkdown?: string;
  /** 作品詳細解析タブ用の `## 総合評価` 以降本文 */
  detailRestMarkdown: string;
};

/**
 * 記事モード用に `## 総合評価` 以降を分割する。
 * - **解析データ** … `### 主要誘導の流れ（作品の流れ）` 直前まで（四表）
 * - **作品詳細解析** … 主要誘導の流れ ＋ 総評 以降（四表は重複表示しない）
 */
export function splitBodyForArticleMode(body: string): ArticleModeInductionSplit | null {
  const finalRatingSplit = splitBodyAtFinalRating(body);
  if (!finalRatingSplit) return null;

  const rest = finalRatingSplit.rest ?? "";
  const inductionAnalysisSplit = splitRestAtInductionAnalysis(rest);
  if (!inductionAnalysisSplit) {
    return { enableAnalysisDataTab: false, detailRestMarkdown: rest };
  }

  const inductionContentParts = splitInductionAnalysisContent(inductionAnalysisSplit.induction);
  const analysisTables = inductionContentParts.analysisTables.trim();
  const enableAnalysisDataTab =
    analysisTables.length > 0 && analysisTables.includes("### 誘導構成比");

  if (!enableAnalysisDataTab) {
    return { enableAnalysisDataTab: false, detailRestMarkdown: rest };
  }

  const flowPart = inductionContentParts.inductionFlow.trim();
  const detailInductionBlock = flowPart
    ? `## 本作の誘導・暗示解析詳細\n\n${flowPart}`
    : inductionAnalysisSplit.induction;
  const detailRestMarkdown = [detailInductionBlock, inductionAnalysisSplit.afterRest]
    .filter((part) => part.length > 0)
    .join("\n\n");

  return {
    enableAnalysisDataTab: true,
    analysisDataMarkdown: analysisTables,
    detailRestMarkdown,
  };
}

export function splitBodyAtFinalRating(
  body: string
): { before: string; rating: string; rest: string } | null {
  const normalized = body.replace(/\r\n/g, "\n");

  function splitRatingAndRest(afterHeading: string): {
    rating: string;
    rest: string;
  } {
    const nextH2 = /\n## (?![#])/;
    const m = nextH2.exec(afterHeading);
    if (!m) {
      return { rating: afterHeading.trim(), rest: "" };
    }
    return {
      rating: afterHeading.slice(0, m.index).trim(),
      rest: afterHeading.slice(m.index).trimStart(),
    };
  }

  const atStart = /^## 総合評価\s*\n/;
  if (atStart.test(normalized)) {
    const after = normalized.replace(atStart, "");
    const { rating, rest } = splitRatingAndRest(after);
    if (!rating) return null;
    return { before: "", rating, rest };
  }

  const mid = /\n## 総合評価\s*\n/;
  const m = mid.exec(normalized);
  if (!m) return null;

  const before = normalized.slice(0, m.index).trimEnd();
  const after = normalized.slice(m.index + m[0].length);
  const { rating, rest } = splitRatingAndRest(after);
  if (!rating) return null;
  return { before, rating, rest };
}
