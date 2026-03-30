import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "管理 · 投稿",
};

/**
 * 一般レイアウト（ヘッダー／フッター）なし。投稿 UI は全画面のダークテーマ。
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
