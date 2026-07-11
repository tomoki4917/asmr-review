/** ヘッダー・モバイルメニュー共通のナビ項目 */

export type SiteNavItem = {
  href: string;
  label: string;
};

export function getSiteNavItems(listHref: string): SiteNavItem[] {
  return [
    { href: listHref, label: "一覧" },
    { href: "/start/", label: "はじめての方へ" },
    { href: "/about/", label: "サイトについて" },
    { href: "/evaluation-method/", label: "評価メソッド" },
    { href: "/contact/", label: "お問い合わせ" },
  ];
}
