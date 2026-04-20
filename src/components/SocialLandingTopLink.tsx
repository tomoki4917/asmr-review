"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SnsLandingAgeConfirmDialog } from "@/components/SnsLandingAgeConfirmDialog";

const TOP_DESCRIPTION =
  "サイトのトップでは、同人音声作品のレビューなどを掲載しており、成人向けの表現や話題を含む場合があります。";

export function SocialLandingTopLink() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sky-400/90 underline-offset-2 transition hover:text-sky-300 hover:underline"
      >
        サイトのトップへ
      </button>
      <SnsLandingAgeConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => router.push("/")}
        description={TOP_DESCRIPTION}
      />
    </>
  );
}
