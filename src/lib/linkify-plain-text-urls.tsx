import type { ReactNode } from "react";

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/**
 * 作品感想など平文中の http(s) URL を外部リンク化する。
 */
export function linkifyPlainTextUrls(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    let href = match[0];
    // 文末の句読点・閉じ括弧を URL から外す
    href = href.replace(/[。、．，,)\]]+$/u, "");
    nodes.push(
      <a
        key={`url-${match.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sky-300 underline decoration-sky-400/60 underline-offset-2 hover:text-sky-200"
      >
        {href}
      </a>
    );
    last = match.index + href.length;
    if (match[0].length > href.length) {
      nodes.push(match[0].slice(href.length));
      last = match.index + match[0].length;
    }
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes.length ? nodes : [text];
}
