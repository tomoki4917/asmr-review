import type { Metadata } from "next";
import { DevSiteNextHeader } from "@/components/dev/DevSiteNextHeader";
import { WorksListHub } from "@/components/WorksListHub";
import {
  DEV_SITE_NEXT_LIST_BASE,
  WORKS_LIST_HUB_PATH,
} from "@/lib/review-list-href";
import { getAllReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "作品一覧",
  description:
    "催眠音声解析室の作品レビュー一覧。キーワード検索・新しい順・評価・ジャンルで探せます。",
  alternates: { canonical: WORKS_LIST_HUB_PATH },
};

export default function WorksListPage() {
  const reviews = getAllReviews();
  const useDevChrome = process.env.NODE_ENV === "development";

  return (
    <main className="mx-auto w-full max-w-6xl">
      {useDevChrome ? (
        <>
          <p className="border-b border-amber-600/30 bg-amber-950/20 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-amber-200/90">
            次サイト草案と共通の作品一覧ハブ
          </p>
          <DevSiteNextHeader />
        </>
      ) : null}

      <WorksListHub
        markdownReviews={reviews}
        basePath={useDevChrome ? "/dev/site-next/works/" : WORKS_LIST_HUB_PATH}
        breadcrumbHref={useDevChrome ? DEV_SITE_NEXT_LIST_BASE : "/"}
      />
    </main>
  );
}
