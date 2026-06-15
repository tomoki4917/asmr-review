/**
 * お問い合わせ（FormSubmit）の届け先メール。
 * 静的ホスティングで環境変数を渡し忘れても動くよう既定値を持つ。
 * 上書きはビルド時の `NEXT_PUBLIC_CONTACT_TO_EMAIL`（別ドメインやテスト用に利用可）。
 */
const FALLBACK_CONTACT_EMAIL = "mukineko0108@gmail.com";

export function getContactDestinationEmail(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim();
  return fromEnv || FALLBACK_CONTACT_EMAIL;
}
