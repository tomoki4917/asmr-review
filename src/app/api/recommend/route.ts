import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getReviewBySlug, getReviewsForRecommendation } from "@/lib/reviews";

const MOOD_HINTS: Record<string, string> = {
  relax: "落ち着き・癒やし・刺激が強すぎない作品",
  sleep: "寝落ち・長めの導入・穏やかな音量",
  focus_asmr: "ASMRらしいトリガー音・空気感が楽しめる作品",
  immersion: "ロールプレイやシチュエーションの没入感",
  gentle_voice: "声の優しさ・囁き系が中心の作品",
};

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GEMINI_API_KEY が設定されていません。.env.local にキーを追加してください。",
      },
      { status: 503 }
    );
  }

  let moodId = "relax";
  try {
    const body = (await req.json()) as { moodId?: string };
    if (body.moodId && typeof body.moodId === "string") moodId = body.moodId;
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です。" }, { status: 400 });
  }

  const catalog = getReviewsForRecommendation();
  if (catalog.length === 0) {
    return NextResponse.json({ ok: false, error: "レビューデータがありません。" }, { status: 500 });
  }

  const moodHint = MOOD_HINTS[moodId] ?? MOOD_HINTS.relax;
  const catalogJson = JSON.stringify(catalog, null, 0);

  const prompt = `あなたは音声作品レビューサイトのキュレーターです。
以下の JSON は利用可能なレビュー一覧です（slug, title, summary, tags）。

ユーザーの気分の方向性: ${moodHint}

この中から **ちょうど1件** だけ選び、次の JSON だけを返してください（前後に説明文を付けないこと）。
{"slug":"選んだslug","reason":"ユーザー向けに2〜4文で、なぜその作品が合うか。日本語。"}

選べる slug は次のいずれかのみ: ${catalog.map((c) => c.slug).join(", ")}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
    });
    const result = await model.generateContent([
      { text: `レビュー一覧:\n${catalogJson}` },
      { text: prompt },
    ]);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, error: "AI の応答を解釈できませんでした。" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as { slug?: string; reason?: string };
    if (!parsed.slug || !parsed.reason) {
      return NextResponse.json(
        { ok: false, error: "AI の応答形式が不正です。" },
        { status: 502 }
      );
    }

    const review = getReviewBySlug(parsed.slug);
    if (!review) {
      return NextResponse.json(
        { ok: false, error: "選ばれた作品が見つかりません。" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      slug: review.slug,
      title: review.title,
      reason: parsed.reason,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gemini API でエラーが発生しました。";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
