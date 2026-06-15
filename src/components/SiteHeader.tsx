import { SiteHeaderBrand } from "@/components/SiteHeaderBrand";
import { SiteHeaderNavLinks } from "@/components/SiteHeaderNavLinks";
import { SiteRatingSwitch } from "@/components/SiteRatingSwitch";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[3.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:min-h-[4.25rem] sm:px-6 sm:py-2.5">
        <SiteHeaderBrand />
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          <SiteRatingSwitch className="max-w-[min(100%,20rem)]" />
          <SiteHeaderNavLinks />
        </div>
      </div>
    </header>
  );
}
