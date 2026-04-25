/**
 * DLsite 作品ページから価格情報を取得し data/products.json を上書きします。
 * 利用規約・サーバー負荷に配慮し、手動・CI で適度な間隔での実行を想定しています。
 * 連続取得の間は 8〜15 秒のランダム待機（ジッター。負荷・パターン緩和用。規約遵守の代替にはなりません）。
 * リクエストは Chrome 風ヘッダに揃えるが、TLS 等はブラウザと同一ではない（見た目の一貫性・限定的な負荷平準化が目的）。
 * 起動直後の待機: 環境変数 DL_PRICE_START_JITTER_MAX_SEC に正の整数秒を指定すると、0〜その秒数まで等確率で待機（CI で開始時刻をばらす用途）。
 *
 * モード:
 * - 既定: 全行を取得
 * - `--stale-sale-ended` または DL_PRICE_MODE=stale-sale-ended:
 *   `on_sale===true` かつ `sale_end_iso` が現在より前の行だけ再取得（セール終了後の表示ずれ修正用）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "products.json");

/** 連続リクエスト間の待機（ミリ秒・両端含む） */
const DELAY_MIN_MS = 8000;
const DELAY_MAX_MS = 15000;

/** 一般的なデスクトップ Chrome の UA（定期的に実ブラウザと揃えるとよい） */
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

/** UA の major と揃える（Client Hints） */
const CHROME_MAJOR = "134";

/**
 * 作品ページ GET 用。ブラウザの文書ナビゲーションに近いヘッダ（Referer は dlsite のみ付与）。
 * @param {string} targetUrl
 */
function buildChromeLikeHtmlHeaders(targetUrl) {
  /** @type {Record<string, string>} */
  const h = {
    "User-Agent": CHROME_USER_AGENT,
    "Accept-Language": "ja,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "sec-ch-ua": `"Google Chrome";v="${CHROME_MAJOR}", "Chromium";v="${CHROME_MAJOR}", "Not-A.Brand";v="99"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
  };
  try {
    const u = new URL(targetUrl);
    if (/(\.|^)dlsite\.com$/i.test(u.hostname)) {
      h.Referer = `${u.protocol}//www.dlsite.com/`;
    }
  } catch {
    /* noop */
  }
  return h;
}

/**
 * 429 / 503 / ネットワークエラー時のみ最大 maxAttempts 回まで再試行。
 * @param {string} urlTrimmed
 * @param {number} [maxAttempts]
 */
async function getProductPageHtml(urlTrimmed, maxAttempts = 3) {
  const config = {
    timeout: 30000,
    headers: buildChromeLikeHtmlHeaders(urlTrimmed),
    validateStatus: (s) => s >= 200 && s < 400,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.get(urlTrimmed, config);
      return res;
    } catch (e) {
      const status = e.response?.status;
      const code = e.code;
      const retriable =
        status === 429 ||
        status === 503 ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ECONNABORTED" ||
        code === "ENOTFOUND" ||
        (typeof e.message === "string" && /network/i.test(e.message));
      if (!retriable || attempt >= maxAttempts) throw e;

      let waitMs = randomDelayMs() * attempt;
      const ra = e.response?.headers?.["retry-after"];
      if (ra) {
        const sec = parseInt(String(ra).trim(), 10);
        if (Number.isFinite(sec) && sec > 0) waitMs = Math.max(waitMs, sec * 1000);
      }
      waitMs = Math.min(waitMs, 120_000);
      console.warn(
        `試行 ${attempt}/${maxAttempts} 失敗（${status ?? code ?? "error"}）。${(waitMs / 1000).toFixed(0)} 秒待って再試行します…`
      );
      await sleep(waitMs);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelayMs() {
  return (
    DELAY_MIN_MS +
    Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1))
  );
}

/** 起動直後: 0〜 maxSec 秒を等確率で待つ（未設定・0 なら何もしない） */
async function startupJitter() {
  const raw = process.env.DL_PRICE_START_JITTER_MAX_SEC ?? "";
  const maxSec = parseInt(raw, 10);
  if (!Number.isFinite(maxSec) || maxSec <= 0) return;
  const sec = Math.floor(Math.random() * (maxSec + 1));
  console.log(
    `起動ジッター: 0〜${maxSec}秒のうち ${sec} 秒待機します（DL_PRICE_START_JITTER_MAX_SEC）…`
  );
  await sleep(sec * 1000);
}

/** @param {string} html */
function parseContentsDetail(html) {
  const m = html.match(/var contents = (\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    const contents = JSON.parse(m[1]);
    const detail = contents?.detail?.[0];
    return detail && typeof detail === "object" ? detail : null;
  } catch {
    return null;
  }
}

/** @param {import("cheerio").CheerioAPI} $ */
function parseGa4($) {
  const el = $("[class*='ga4_event_item']").first();
  const price = parseInt(el.attr("data-price") ?? "", 10);
  const official = parseInt(el.attr("data-official_price") ?? "", 10);
  return {
    price: Number.isFinite(price) ? price : null,
    official_price: Number.isFinite(official) ? official : null,
  };
}

/**
 * schema.org の priceValidUntil（商品オファーの終了時刻＝セール締切に一致することが多い）
 * @param {string} html
 */
function extractSchemaPriceValidUntilRaw(html) {
  const m =
    html.match(/itemprop=["']priceValidUntil["'][^>]*\bcontent=["']([^"']+)["']/i) ||
    html.match(/\bcontent=["']([^"']+)["'][^>]*\bitemprop=["']priceValidUntil["']/i);
  return m ? m[1].trim() : "";
}

/**
 * sale_end_iso（UTC）から「M月d日 HH:mmまで」風の1行（日本時間）
 * @param {string} isoUtc
 */
function formatSaleDeadlineJa(isoUtc) {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "";
  return (
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d) + "まで"
  );
}

/**
 * 本文中の「M月d日 H:mm」または「yyyy年M月d日」風の表記を拾う（ベストエフォート）
 * 右カラムの「01/22 13:59 まで」形式も対象。
 * @param {string} html
 */
function extractSaleLimitSnippet(html) {
  const $ = cheerio.load(html);
  const buy = $(".work_buy_body, .campaign_info, [data-vue-component='product-price']")
    .text()
    .replace(/\s+/g, " ");
  const slashMd = buy.match(/(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})\s*まで/);
  if (slashMd) return slashMd[0].trim();
  const til =
    buy.match(/(\d{1,2}月\d{1,2}日[^\d]{0,8}\d{1,2}:\d{2})/) ||
    buy.match(/(\d{4}年\d{1,2}月\d{1,2}日[^\d]{0,8}\d{1,2}:\d{2})/);
  if (til) return til[1].trim();
  const loose = html.match(
    /(\d{4}年\d{1,2}月\d{1,2}日)[^\n<]{0,40}?(\d{1,2}:\d{2})/
  );
  if (loose) return `${loose[1]} ${loose[2]}`;
  return "";
}

/**
 * @param {string} snippet
 * @param {number} referenceYear
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * DLsite `contents.detail[0].regist_date`（例 "2026/04/24"）を UTC の ISO に変換
 * @param {unknown} regist
 */
function registDateToReleaseIso(regist) {
  if (regist == null) return "";
  const s = String(regist).trim();
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  const iso = `${y}-${pad2(mo)}-${pad2(d)}T00:00:00+09:00`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString();
}

/**
 * JST の日時を UTC の ISO 文字列に（締切表示が JST 前提のため）
 * @param {number} y
 * @param {number} mo 1-12
 * @param {number} d
 * @param {number} h 0-23 JST
 * @param {number} min
 */
function isoFromJstParts(y, mo, d, h, min) {
  const s = `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:00+09:00`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString();
}

function tryParseSaleEndIso(snippet, referenceYear) {
  if (!snippet.trim()) return "";
  const trimmed = snippet.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const t = Date.parse(trimmed);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  let m = snippet.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日[^\d]{0,6}(\d{1,2}):(\d{2})/
  );
  if (m) {
    return isoFromParts(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5])
    );
  }
  m = snippet.match(/(\d{1,2})月(\d{1,2})日[^\d]{0,8}(\d{1,2}):(\d{2})/);
  if (m) {
    return isoFromParts(
      referenceYear,
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4])
    );
  }
  /** 右カラムの「M/D HH:mm まで」（スクリーンショットの 01/22 13:59 など） */
  m = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*まで/);
  if (m) {
    const mo = Number(m[1]);
    const day = Number(m[2]);
    const hh = Number(m[3]);
    const mm = Number(m[4]);
    let y = referenceYear;
    let iso = isoFromJstParts(y, mo, day, hh, mm);
    if (iso && new Date(iso).getTime() < Date.now() - 7 * 86400000) {
      iso = isoFromJstParts(y + 1, mo, day, hh, mm);
    }
    return iso;
  }
  return "";
}

function isoFromParts(y, mo, d, h, min) {
  const t = Date.UTC(y, mo - 1, d, h, min, 0, 0);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString();
}

/** @param {object} discount */
function discountMeta(discount) {
  if (discount == null || typeof discount !== "object") return { sale_limit: "", sale_end_iso: "" };
  const raw =
    discount.end_date ??
    discount.endDate ??
    discount.until ??
    discount.limit_date ??
    "";
  const s = typeof raw === "string" ? raw : "";
  return { sale_limit: s, sale_end_iso: s ? tryParseSaleEndIso(s, new Date().getFullYear()) : "" };
}

/**
 * contents.detail.discount がオブジェクトでない場合、税込セール価格（円）のことがある。
 * @param {unknown} discount
 * @param {{ price_with_tax?: number; official_price?: unknown }} detail
 * @returns {number | null}
 */
function numericSalePriceFromDetail(discount, detail) {
  if (typeof discount !== "number" || !Number.isFinite(discount) || discount <= 0) {
    return null;
  }
  const list =
    typeof detail?.price_with_tax === "number" && !Number.isNaN(detail.price_with_tax)
      ? detail.price_with_tax
      : null;
  const off =
    detail?.official_price != null && detail.official_price !== ""
      ? typeof detail.official_price === "number"
        ? detail.official_price
        : parseInt(String(detail.official_price), 10)
      : null;
  const ref = [list, off].filter((x) => Number.isFinite(x) && x > 0);
  const maxRef = ref.length ? Math.max(...ref) : null;
  if (maxRef != null && discount < maxRef) return discount;
  if (maxRef == null) return discount;
  return null;
}

/** @param {string} html */
function extractPriceRow(html) {
  const $ = cheerio.load(html);
  const detail = parseContentsDetail(html);
  const ga = parseGa4($);

  /** 実際の購入表示価格。セール時は GA4 の data-price が正しいことが多く、
   * price_with_tax だけだと定価のままになるため GA を優先する。 */
  let current = null;
  if (ga.price != null && ga.price > 0) {
    current = ga.price;
  }
  if (current == null) {
    const fromDiscount = numericSalePriceFromDetail(detail?.discount, detail ?? {});
    if (fromDiscount != null) current = fromDiscount;
  }
  if (current == null) {
    current =
      typeof detail?.price_with_tax === "number" && !Number.isNaN(detail.price_with_tax)
        ? detail.price_with_tax
        : null;
  }
  if (current == null) {
    const priceText = $(".work_buy_body .price").first().text();
    const num = priceText.replace(/[^\d]/g, "");
    const n = parseInt(num, 10);
    current = Number.isFinite(n) ? n : 0;
  }

  let original = current;
  if (ga.official_price != null && ga.official_price > 0) {
    original = ga.official_price;
  } else {
    const offRaw = detail?.official_price;
    if (offRaw != null && offRaw !== "") {
      const n = typeof offRaw === "number" ? offRaw : parseInt(String(offRaw), 10);
      if (Number.isFinite(n) && n > 0) original = n;
    }
  }
  if (original < current) {
    original = current;
  }

  const on_sale = original > current && current > 0;
  const discount_rate =
    on_sale && original > 0 ? Math.round((1 - current / original) * 100) : 0;

  let sale_limit = "";
  let sale_end_iso = "";
  const discountObj =
    detail?.discount != null && typeof detail.discount === "object"
      ? detail.discount
      : null;
  const dm = discountMeta(discountObj);

  /** セール時は schema.org の priceValidUntil が最も安定（SSR HTML に載る） */
  if (on_sale) {
    const rawUntil = extractSchemaPriceValidUntilRaw(html);
    if (rawUntil) {
      const deadline = new Date(rawUntil);
      if (!Number.isNaN(deadline.getTime())) {
        sale_end_iso = deadline.toISOString();
        sale_limit = formatSaleDeadlineJa(sale_end_iso);
      }
    }
  }

  if (!sale_limit && dm.sale_limit) sale_limit = dm.sale_limit;
  if (!sale_end_iso && dm.sale_end_iso) sale_end_iso = dm.sale_end_iso;

  if (!sale_limit) {
    sale_limit = extractSaleLimitSnippet(html);
  }
  if (!sale_end_iso && sale_limit) {
    sale_end_iso = tryParseSaleEndIso(sale_limit, new Date().getFullYear());
  }

  const release_date_iso = registDateToReleaseIso(
    detail?.regist_date ?? detail?.release_date
  );

  return {
    current_price: current,
    original_price: original,
    discount_rate,
    on_sale,
    sale_limit,
    sale_end_iso,
    release_date_iso,
  };
}

/**
 * セール終了時刻は過ぎているのに JSON 上はまだセール中の行か（再取得候補）
 * @param {Record<string, unknown>} row
 */
function isStaleSaleEndedRow(row) {
  if (row == null || typeof row !== "object") return false;
  if (row.on_sale !== true) return false;
  const iso = typeof row.sale_end_iso === "string" ? row.sale_end_iso.trim() : "";
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

/**
 * @param {Record<string, unknown>} row
 */
async function fetchProductRow(row) {
  let id = typeof row.id === "string" ? row.id : "";
  const url = typeof row.url === "string" ? row.url : "";
  const idFromUrl = url.match(/RJ\d+/i);
  if (!id.trim() && idFromUrl) id = idFromUrl[0].toUpperCase();
  if (!url.trim()) {
    throw new Error(`url なし: id=${id}`);
  }

  console.log(`取得: ${id} ${url}`);
  const res = await getProductPageHtml(url.trim());

  const html = typeof res.data === "string" ? res.data : String(res.data);
  const extracted = extractPriceRow(html);
  const fetched_at = new Date().toISOString();
  const prevRelease =
    typeof row.release_date_iso === "string" ? row.release_date_iso.trim() : "";

  return {
    ...row,
    id,
    url: url.trim(),
    current_price: extracted.current_price,
    original_price: extracted.original_price,
    discount_rate: extracted.discount_rate,
    on_sale: extracted.on_sale,
    sale_limit: extracted.sale_limit,
    sale_end_iso: extracted.sale_end_iso,
    release_date_iso: extracted.release_date_iso || prevRelease || "",
    fetched_at,
  };
}

function staleSaleEndedModeEnabled() {
  return (
    process.argv.includes("--stale-sale-ended") ||
    process.env.DL_PRICE_MODE === "stale-sale-ended"
  );
}

async function main() {
  await startupJitter();

  const raw = fs.readFileSync(OUT, "utf8");
  /** @type {Array<Record<string, unknown>>} */
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error("products.json は配列にしてください。");

  const staleMode = staleSaleEndedModeEnabled();

  if (staleMode) {
    const indices = [];
    for (let i = 0; i < list.length; i++) {
      if (isStaleSaleEndedRow(list[i])) indices.push(i);
    }
    if (indices.length === 0) {
      console.log(
        "stale-sale-ended: 対象なし（sale_end_iso 経過後も on_sale の行はありません）。ファイルは更新しません。"
      );
      return;
    }
    console.log(`stale-sale-ended: ${indices.length} 件を再取得します。`);
    const out = list.map((row) => ({ ...row }));
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const row = list[i];
      let id = typeof row.id === "string" ? row.id : "";
      const url = typeof row.url === "string" ? row.url : "";
      if (!url.trim()) {
        console.warn(`スキップ: id=${id} url なし`);
        continue;
      }
      out[i] = await fetchProductRow(row);
      if (k < indices.length - 1) {
        const wait = randomDelayMs();
        console.log(`次の取得まで ${(wait / 1000).toFixed(1)} 秒待機…`);
        await sleep(wait);
      }
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.log(`更新しました: ${OUT}`);
    return;
  }

  const out = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    let id = typeof row.id === "string" ? row.id : "";
    const url = typeof row.url === "string" ? row.url : "";
    const idFromUrl = url.match(/RJ\d+/i);
    if (!id.trim() && idFromUrl) id = idFromUrl[0].toUpperCase();
    if (!url.trim()) {
      console.warn(`スキップ: id=${id} url なし`);
      out.push(row);
      continue;
    }

    out.push(await fetchProductRow(row));

    if (i < list.length - 1) {
      const wait = randomDelayMs();
      console.log(`次の取得まで ${(wait / 1000).toFixed(1)} 秒待機…`);
      await sleep(wait);
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`更新しました: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
