import Link from "next/link";
import { SITE_X_URL } from "@/lib/site-brand";

/** サイトについて本文 */
export function AboutContent() {
  return (
    <div className="space-y-10 text-[0.9375rem] leading-[1.85] text-slate-300 sm:text-base sm:leading-relaxed">
      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          1. このサイトについて
        </h2>
        <p className="mt-3">
          ムキネコ解析室は、催眠音声・同人音声（ASMR）について、主観と音声データに様々なツールを駆使し、心身科学に落とし込んでレビューする個人運営サイトです。データはデータとして読み、最後は主観で総評することを心掛けています。
        </p>
        <p className="mt-3">
          「音声作品は好きだけど、駄作を引いてお金や時間を無駄にしたくない」——そういう方の参考の一助になれば、という思いで運営しています。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          2. 運営者
        </h2>
        <ul className="mt-3 space-y-1.5 text-slate-300">
          <li>
            <span className="text-slate-400">名前：</span>ムキネコ
          </li>
          <li>
            <span className="text-slate-400">年齢：</span>23歳
          </li>
          <li>
            <span className="text-slate-400">催眠音声歴：</span>7年
          </li>
        </ul>
        <p className="mt-4">
          作品はすべて自費で購入し、サークル・販売サイトからの金銭提供や執筆依頼は受けていません（レビュー用の提供を受けた場合は、その記事内で必ず明記します）。
        </p>
        <p className="mt-3">
          日々の更新情報は
          <a
            href={SITE_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
          >
            X（旧Twitter）
          </a>
          でもお知らせしています。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          3. このサイトを始めた理由
        </h2>
        <p className="mt-3">
          高校生だった当時、エロに対して好奇心旺盛だったムキネコは、催眠音声というジャンルに行きつきました。行きついたはいいものの、自分には才能がなく、中々催眠体験ができない日々が続きました。音声作品の良し悪しもわからず、原理もわからない——催眠体験ができるようになるまで、1年はかかった記憶があります。
        </p>
        <p className="mt-3">
          そんな過去の自分のような人の助けになれば、という思いでこのサイトを始めました。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          4. レビュー・採点の方針
        </h2>
        <p className="mt-3">
          評価の対象は
          <strong className="text-slate-200">
            実際に再生される音声そのもの
          </strong>
          だけです。価格・セール・特典の有無・サークルの知名度は、点数の理由にしません。
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-slate-500">
          <li>
            <strong className="text-slate-200">全編を聴いてから書く</strong>
            ——冒頭だけ・サンプルだけで採点することはありません。
          </li>
          <li>
            <strong className="text-slate-200">根拠を添える</strong>
            ——タイムスタンプ付き文字起こし（WhisperX）、音響解析（librosa）、心拍ログ（Polar
            H10）を突き合わせ、体験と矛盾しないかを確認します。
          </li>
          <li>
            <strong className="text-slate-200">合わない人も書く</strong>
            ——どのレビューにも「合わない可能性がある人」を必ず載せます。すべての人におすすめの作品は存在しないからです。
          </li>
          <li>
            <strong className="text-slate-200">性癖で減点しない</strong>
            ——題材の好みではなく、誘導・演技・音の設計として優れているかで判断します。
          </li>
        </ul>
        <p className="mt-3">
          手順とツールの詳細は
          <Link
            href="/evaluation-method/"
            className="text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
          >
            評価メソッド
          </Link>
          で全文公開しています。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          5. 執筆者名について
        </h2>
        <p className="mt-3">
          記事には「催眠音声解析室」「同人音声レビュー室」「ASMR研究所
          所長」といった名義が付いていますが、これらは
          <strong className="text-slate-200">
            ジャンルごとの編集上の名義
          </strong>
          で、いずれも同じ運営者が執筆・監修しています。催眠作品・一般の同人音声・解説記事で求められる書き方が違うため、名義を分けて文体と基準を揃えています。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          6. アフィリエイト・広告について
        </h2>
        <p className="mt-3">
          当サイトの作品購入リンクには、DLsite
          等のアフィリエイトリンクを含みます。リンク経由で購入があった場合、運営者に紹介料が入ります。これはサイトの運営費（作品の購入費・サーバー代）に充てています。
        </p>
        <p className="mt-3">
          ただし、
          <strong className="text-slate-200">
            紹介料の有無・多寡が採点や紹介の順番に影響することはありません
          </strong>
          。評価が低い作品にもアフィリエイトリンクは付きますし、リンクのない作品を高く評価することもあります。詳細は
          <Link
            href="/disclaimer/"
            className="text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
          >
            免責事項
          </Link>
          をご覧ください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          7. お問い合わせ・記事の修正について
        </h2>
        <p className="mt-3">
          記事内容の誤り・権利に関するご連絡・レビューのご要望は、
          <Link
            href="/contact/"
            className="text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
          >
            お問い合わせフォーム
          </Link>
          からお寄せください。事実誤認のご指摘は確認のうえ、速やかに修正します。
        </p>
        <p className="mt-3">
          サークル・権利者の方で、掲載内容（引用・画像・リンク）に問題がある場合も、同フォームからご連絡いただければ対応します。
        </p>
        <p className="mt-3 text-slate-400">
          更新は社畜のため不定期です。新着記事は
          <a
            href={SITE_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-200"
          >
            X（旧Twitter）
          </a>
          でもお知らせしています。
        </p>
      </section>
    </div>
  );
}
