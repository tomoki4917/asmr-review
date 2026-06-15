import type { Metadata } from "next";
import { AllAgesHomeView } from "@/components/all-ages/AllAgesHomeView";
import { SITE_NAME_ALL_AGES } from "@/lib/site-brand";
import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";

export const metadata: Metadata = {
  title: `${SITE_NAME_ALL_AGES}（全年齢向け）`,
  description: `全年齢向けの${SITE_NAME_ALL_AGES}。同人音声のレビュー・解説を掲載しています。`,
  alternates: { canonical: ALL_AGES_SITE_BASE },
};

export default function AllAgesHomePage() {
  return <AllAgesHomeView />;
}
