import LocalReviewPageClient from "./LocalReviewPageClient";

/**
 * localStorage 由来の ID はビルド時に列挙できない。
 * 静的書き出しでは少なくとも1パスが必要なためプレースホルダーを1件出す（実 ID はクライアント遷移）。
 */
export function generateStaticParams() {
  return [{ id: "__static_export__" }];
}

export default function LocalReviewPage() {
  return <LocalReviewPageClient />;
}
