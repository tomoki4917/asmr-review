"use client";

import { usePathname } from "next/navigation";
import { getSiteBrandForPath } from "@/lib/site-brand";

export function useSiteBrand() {
  const pathname = usePathname() ?? "/";
  return getSiteBrandForPath(pathname);
}
