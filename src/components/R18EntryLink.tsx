"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { AgeVerificationGate } from "@/components/AgeGate";
import { isAgeVerified } from "@/lib/age-verification";
import { getR18SiteUrl, isExternalSiteUrl } from "@/lib/site-rating-switch";

type R18EntryLinkProps = {
  children: ReactNode;
  className?: string;
};

/** 成人向け【R18】へ進むリンク（未確認時のみ年齢確認） */
export function R18EntryLink({ children, className }: R18EntryLinkProps) {
  const router = useRouter();
  const [gateOpen, setGateOpen] = useState(false);
  const href = getR18SiteUrl();

  const navigate = useCallback(() => {
    if (isExternalSiteUrl(href)) {
      window.location.href = href;
      return;
    }
    router.push(href);
  }, [href, router]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isAgeVerified()) {
      navigate();
      return;
    }
    setGateOpen(true);
  };

  return (
    <>
      <a href={href} onClick={handleClick} className={className}>
        {children}
      </a>
      <AgeVerificationGate
        open={gateOpen}
        onVerified={() => {
          setGateOpen(false);
          navigate();
        }}
      />
    </>
  );
}
