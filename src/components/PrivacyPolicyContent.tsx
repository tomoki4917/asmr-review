/** プライバシーポリシー本文（ページ内表示用） */
export function PrivacyPolicyContent() {
  return (
    <div className="prose-legal space-y-8 text-sm leading-relaxed text-slate-300 sm:text-base">
      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          1. はじめに
        </h2>
        <p className="mt-3">
          「催眠音声レビュー室」（以下「当サイト」）は、催眠・同人音声
          作品のレビューおよび関連する解説を掲載する個人ブログです。当サイトでは、利用者の個人情報を適切に取り扱うため、本ポリシーに従います。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          2. 収集する情報
        </h2>
        <p className="mt-3">
          当サイトでは、次の情報が取得される場合があります。
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-400">
          <li>
            <strong className="text-slate-200">アクセス解析</strong>
            ：Google
            アナリティクス等により、ページ閲覧や参照元などの統計情報が Cookie
            等を通じて収集される場合があります。これらは匿名または匿名に近い形で処理され、個人を特定する目的では用いません。
          </li>
          <li>
            <strong className="text-slate-200">お問い合わせ</strong>
            ：フォーム経由で、お名前・メールアドレス・お問い合わせ内容をご入力いただく場合があります。内容は返信および不正利用防止のために利用し、目的外利用はしません。
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          3. 広告・アフィリエイト
        </h2>
        <p className="mt-3">
          当サイトでは、第三者配信の広告サービス（例: 忍者AdMax、Google
          AdSense 等）や、アフィリエイトプログラム（例: Amazon
          アソシエイト）を利用する場合があります。これらの事業者は、利用者の興味に応じた広告表示のため、Cookie
          等を用いて情報を取得することがあります。各事業者のプライバシーポリシーもあわせてご確認ください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          4. 利用目的・第三者提供
        </h2>
        <p className="mt-3">
          取得した情報は、サイトの運営・改善、お問い合わせ対応、不正利用の防止に限り利用します。法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供することはありません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          5. 開示・訂正・削除
        </h2>
        <p className="mt-3">
          お問い合わせフォーム等を通じて提供いただいた情報について、開示・訂正・削除を希望される場合は、当サイトの連絡先までご連絡ください。合理的な範囲で対応します。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          6. 本ポリシーの変更
        </h2>
        <p className="mt-3">
          法令の改正やサービス内容の変更に伴い、本ポリシーを改定することがあります。改定後の内容は当サイト上に掲載した時点から効力を生じます。
        </p>
      </section>

      <p className="text-xs text-slate-500">
        制定日: 2026年4月1日（例）
      </p>
    </div>
  );
}
