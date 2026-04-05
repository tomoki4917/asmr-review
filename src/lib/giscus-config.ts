export type GiscusPublicConfig = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
};

function fromEnv(): Partial<GiscusPublicConfig> {
  return {
    repo: process.env.NEXT_PUBLIC_GISCUS_REPO?.trim() ?? "",
    repoId: process.env.NEXT_PUBLIC_GISCUS_REPO_ID?.trim() ?? "",
    category: process.env.NEXT_PUBLIC_GISCUS_CATEGORY?.trim() ?? "",
    categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID?.trim() ?? "",
  };
}

function isComplete(c: Partial<GiscusPublicConfig>): c is GiscusPublicConfig {
  return Boolean(
    c.repo &&
      c.repoId &&
      c.category &&
      c.categoryId
  );
}

/**
 * クライアント: 本番で `public/giscus-config.json` を置くと、再ビルドなしで上書き可能。
 * env がすべて揃んでいれば env を優先。
 */
export async function resolveGiscusConfig(): Promise<GiscusPublicConfig | null> {
  const e = fromEnv();
  if (isComplete(e)) return e;

  try {
    const res = await fetch("/giscus-config.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const merged: Partial<GiscusPublicConfig> = {
      repo: typeof data.repo === "string" ? data.repo.trim() : "",
      repoId: typeof data.repoId === "string" ? data.repoId.trim() : "",
      category:
        typeof data.category === "string" ? data.category.trim() : "",
      categoryId:
        typeof data.categoryId === "string" ? data.categoryId.trim() : "",
    };
    return isComplete(merged) ? merged : null;
  } catch {
    return null;
  }
}

/** `owner/repo` → GitHub Discussions のベース URL */
export function githubDiscussionsUrl(repo: string): string | null {
  const parts = repo.trim().split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  return `https://github.com/${owner}/${name}/discussions`;
}
