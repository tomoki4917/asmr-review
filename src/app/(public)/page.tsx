import type { Metadata } from "next";
import { AllAgesHomeView } from "@/components/all-ages/AllAgesHomeView";
import { SITE_NAME_ALL_AGES } from "@/lib/site-brand";

export const metadata: Metadata = {
  title: SITE_NAME_ALL_AGES,
  description: `全年齢向けの${SITE_NAME_ALL_AGES}。同人音声のレビュー・解説を掲載しています。`,
  alternates: { canonical: "/" },
};

/** サイト入口：全年齢トップ */
export default function HomePage() {
  return <AllAgesHomeView />;
}
