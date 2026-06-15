import type { Metadata } from "next";
import { R18HomeView } from "@/components/home/R18HomeView";
import { SITE_NAME_R18 } from "@/lib/site-brand";
import { R18_SITE_BASE } from "@/lib/site-rating-switch";

export const metadata: Metadata = {
  title: `${SITE_NAME_R18}（成人向け）`,
  description: `${SITE_NAME_R18}。催眠音声・同人音声のレビューと紹介。`,
  alternates: { canonical: R18_SITE_BASE },
};

/** 成人向け【R18】トップ（年齢確認後に遷移） */
export default function R18HomePage() {
  return <R18HomeView />;
}
