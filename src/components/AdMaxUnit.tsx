"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  ADMAX_SCRIPT_SRC,
  ADMAX_SCRIPT_SRC_HOME_TOP,
  ADMAX_SCRIPT_SRC_MOBILE,
} from "@/lib/admax";

export type AdMaxPlacement = "content-bottom" | "article-top" | "home-top";

type Props = {
  placement: AdMaxPlacement;
  className?: string;
};

type UnitCfg = {
  scriptSrc: string;
  width: number;
  height: number;
  maxWrapPx: number;
  labelJa: string;
};

const MOBILE_MQ = "(max-width: 767px)";

function escapeAttr(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** PC（幅768px以上）向け。トップも MPU 300×250（728×枠だと横に白余白が出やすい）。 */
function desktopUnitConfig(placement: AdMaxPlacement): UnitCfg {
  switch (placement) {
    case "home-top":
      return {
        scriptSrc: ADMAX_SCRIPT_SRC_HOME_TOP,
        width: 300,
        height: 250,
        maxWrapPx: 300,
        labelJa: "トップ",
      };
    case "article-top":
      return {
        scriptSrc: ADMAX_SCRIPT_SRC,
        width: 300,
        height: 250,
        maxWrapPx: 300,
        labelJa: "記事上",
      };
    case "content-bottom":
      return {
        scriptSrc: ADMAX_SCRIPT_SRC,
        width: 300,
        height: 250,
        maxWrapPx: 300,
        labelJa: "記事下",
      };
  }
}

/** 768px 未満: 大枠は使わず MPU + モバイル用 script（トップのみ差し替え）。 */
function resolveUnitConfig(
  placement: AdMaxPlacement,
  narrow: boolean
): UnitCfg {
  const d = desktopUnitConfig(placement);
  if (!narrow) return d;

  return {
    ...d,
    width: 300,
    height: 250,
    maxWrapPx: 300,
    scriptSrc:
      placement === "home-top"
        ? ADMAX_SCRIPT_SRC_MOBILE
        : d.scriptSrc,
  };
}

function shellMinHeightPx(
  viewport: "unknown" | "narrow" | "wide",
  cfg: UnitCfg | null
): number {
  if (viewport === "unknown" || viewport === "narrow") return 250;
  if (!cfg) return 250;
  return cfg.height;
}

/**
 * 忍者AdMax: iframe（about:blank）内で document.write してタグを読み込む。
 * srcdoc 方式は一部モバイルブラウザで外部 script が動かず白画面になることがあるため使わない。
 */
export function AdMaxUnit({ placement, className = "" }: Props) {
  const [viewport, setViewport] = useState<"unknown" | "narrow" | "wide">(
    "unknown"
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setViewport(mq.matches ? "narrow" : "wide");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const narrow = viewport === "narrow";
  const cfg =
    viewport === "unknown" ? null : resolveUnitConfig(placement, narrow);

  const scriptSrc = cfg?.scriptSrc;
  const frameW = cfg?.width;
  const frameH = cfg?.height;

  useLayoutEffect(() => {
    if (
      viewport === "unknown" ||
      scriptSrc == null ||
      !String(scriptSrc).trim() ||
      frameW == null ||
      frameH == null
    ) {
      return;
    }

    const host = wrapRef.current;
    if (!host) return;

    host.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.title = "広告";
    if (!narrow) {
      iframe.setAttribute("loading", "lazy");
    }
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.style.width = `${frameW}px`;
    iframe.style.maxWidth = "100%";
    iframe.style.height = `${frameH}px`;
    iframe.style.verticalAlign = "top";
    iframe.style.backgroundColor = "transparent";

    host.appendChild(iframe);

    const srcEsc = escapeAttr(scriptSrc);
    const overflowY = narrow ? "auto" : "hidden";
    /* サイト背景に近い色。透明だと iframe 既定の白が広告まわりに見える */
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow-x:hidden;overflow-y:${overflowY};background:#0f172a;}body{display:flex;justify-content:center;align-items:flex-start;min-height:${frameH}px;}</style></head><body><script src="${srcEsc}"><\/script></body></html>`;

    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }

    return () => {
      host.innerHTML = "";
    };
  }, [viewport, placement, narrow, scriptSrc, frameW, frameH]);

  const missingAdConfig =
    viewport !== "unknown" &&
    cfg != null &&
    !cfg.scriptSrc.trim();

  if (missingAdConfig) {
    return null;
  }

  const maxWrap = cfg
    ? `min(100%,${cfg.maxWrapPx}px)`
    : "min(100%,300px)";
  const minH = shellMinHeightPx(viewport, cfg);

  const asideClass = [
    "m-0 flex flex-col items-center p-0 leading-none",
    placement === "home-top" &&
      (viewport === "wide" || viewport === "unknown") &&
      "mx-auto w-fit max-w-[min(100%,300px)]",
    placement === "home-top" &&
      viewport === "narrow" &&
      "mx-auto w-fit max-w-[min(100%,300px)]",
    (placement === "content-bottom" || placement === "article-top") &&
      "mx-auto w-fit max-w-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      className={asideClass}
      aria-label={cfg ? `広告（${cfg.labelJa}）` : "広告（読み込み中）"}
      data-ad-placement={placement}
      data-ad-viewport={
        viewport === "unknown" ? "pending" : narrow ? "mobile" : "desktop"
      }
      style={{ minHeight: minH }}
    >
      <span className="sr-only">
        Advertisement{cfg ? ` — ${cfg.labelJa}` : ""}
      </span>
      <div
        ref={wrapRef}
        className="m-0 block w-full max-w-full shrink-0 overflow-hidden p-0"
        style={{
          maxWidth: maxWrap,
          lineHeight: 0,
          minHeight: viewport === "unknown" ? 250 : undefined,
        }}
      />
    </aside>
  );
}
