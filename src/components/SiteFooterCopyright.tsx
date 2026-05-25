"use client";

import { useSiteBrand } from "@/lib/use-site-brand";

export function SiteFooterCopyright() {
  const { siteName } = useSiteBrand();

  return (
    <p className="mt-3 text-xs text-slate-500">
      © {new Date().getFullYear()} {siteName}
    </p>
  );
}
