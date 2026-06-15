import { DlsiteRankingSidebar } from "@/components/dlsite/DlsiteRankingSidebar";
import { AllAgesSpotlightReview } from "@/components/all-ages/AllAgesSpotlightReview";
import { pickAllAgesSpotlight } from "@/lib/all-ages-spotlight";
import type { Review } from "@/lib/types";

type Props = {
  reviews: Review[];
};

/** 全年齢トップ：ランキング＋ピックアップ（2 カラム） */
export function AllAgesHomeEditorial({ reviews }: Props) {
  if (!pickAllAgesSpotlight(reviews)) return null;

  return (
    <section
      className="mx-auto mt-12 max-w-7xl border-t border-slate-600/50 px-4 pt-10 sm:mt-14 sm:px-0"
      aria-label="注目エリア"
    >
      <div className="grid items-start gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.55fr)] lg:gap-x-10">
        <DlsiteRankingSidebar site="home" count={5} />
        <AllAgesSpotlightReview reviews={reviews} className="lg:px-1" />
      </div>
    </section>
  );
}
