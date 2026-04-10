/** 免責事項本文（ページ内表示用） */
export function DisclaimerContent() {
  return (
    <div className="space-y-8 text-sm leading-relaxed text-slate-300 sm:text-base">
      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          1. 感想・評価について
        </h2>
        <p className="mt-3">
          当サイトに掲載される作品レビュー、評価、タグ、および解説記事の内容は、運営者または投稿者の
          <strong className="text-slate-200">個人的な感想・主観</strong>
          に基づくものです。特定の音声が医学的・心理的効果をもたらすこと、睡眠改善や疾患の治療に資することを
          <strong className="text-slate-200">保証するものではありません</strong>
          。利用は自己責任でお願いいたします。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          2. 健康上の注意（視聴をお控えいただきたい場合）
        </h2>
        <p className="mt-3">
          当サイトで紹介・レビューする催眠音声・ASMR
          等は、娯楽・情報提供を目的としており、
          <strong className="text-slate-200">
            医療行為・心理療法・診断の代替となるものではありません
          </strong>
          。音声に含まれる誘導・音響刺激や、情緒・集中状態の変化が、既存の疾患や治療に影響を及ぼすおそれがあります。次のいずれかに該当する方、またはご心配がある方は、
          <strong className="text-slate-200">無理のない範囲で視聴をお控えください</strong>
          。必要に応じて、事前に医師・精神科・心療内科等へのご相談をおすすめします。
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-slate-500">
          <li>
            <strong className="text-slate-200">心臓疾患</strong>
            （狭心症、心不全、重い不整脈等）で治療中の方、または循環器に関して医師から刺激・興奮・負荷に注意するよう指導を受けている方
          </li>
          <li>
            <strong className="text-slate-200">精神疾患で通院中・投薬治療中の方</strong>
            、または症状が不安定な時期にある方（幻聴・妄想の増悪、解離感の強まり等が懸念される場合）
          </li>
          <li>
            てんかん等の発作性の疾患で、音・リラックス誘導等が発作の誘因となりうると医師から示唆されている方
          </li>
        </ul>
        <p className="mt-3">
          上記は例示であり、妊娠中・授乳中、強い疲労や飲酒直後など、ご自身の状態に迷いがある場合もご利用はお控えください。視聴中に動悸、胸の痛み、めまい、強い不安、気分の著しい落ち込みなどが生じた場合は、
          <strong className="text-slate-200">直ちに再生を中止</strong>
          し、必要に応じて医療機関へご相談ください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          3. 催眠・ASMR 音声の安全な利用
        </h2>
        <p className="mt-3">
          催眠音声や ASMR
          を利用する際は、安全な場所に着席または横になり、
          <strong className="text-slate-200">
            運転中・機械操作・高所・水場など、集中が途切れると危険な状況
          </strong>
          では視聴しないでください。イヤホン使用時は周囲の音量に注意し、長時間の高音量聴取は避けてください。体調不良や違和感を感じた場合は利用を中止し、必要に応じて医療機関等にご相談ください。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          4. 外部サイト・購入リンク
        </h2>
        <p className="mt-3">
          当サイトからリンクされる販売サイト（DLsite、Amazon
          等）の商品内容、価格、利用規約は各事業者の責任で管理されています。リンク先でのトラブルについて、当サイトは責任を負いかねます。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          5. アフィリエイト・広告
        </h2>
        <p className="mt-3">
          当サイトは、Amazon
          アソシエイトプログラム等のアフィリエイト、および広告配信サービスに参加する場合があります。該当リンクや広告から成果が発生した場合、運営者に紹介料等が支払われることがありますが、掲載内容の公正性を損なう意図はありません。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
          6. 情報の正確性
        </h2>
        <p className="mt-3">
          当サイトの情報には誤りや古い内容が含まれる可能性があります。重要な判断は、必ず公式情報や専門家の意見も参照してください。
        </p>
      </section>

      <p className="text-xs text-slate-500">制定日: 2026年4月10日</p>
    </div>
  );
}
