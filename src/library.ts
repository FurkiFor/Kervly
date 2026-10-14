import type { Env } from "./env";
import { toBrand, type BrandRow } from "./brands";
import { listStorage } from "./storage";
import { AppError } from "./i18n";

export interface MediaItem {
  name: string;
  url: string;
  size: number;
}

/**
 * Lists the .mp4 files in a brand's allowlisted folders, for the video picker in the dashboard.
 * Supported for prefixes on raw.githubusercontent.com (public repos), using GitHub's contents API.
 * Results are cached for 2 minutes. Set the optional GITHUB_TOKEN secret (read-only) to raise
 * GitHub's rate limit. Other hosts simply return no suggestions.
 */
export async function listBrandMedia(env: Env, row: BrandRow): Promise<MediaItem[]> {
  const brand = toBrand(row);
  const out: MediaItem[] = await listStorage(env, row);
  for (const prefix of brand.media_prefixes) {
    const u = new URL(prefix);
    if (u.hostname !== "raw.githubusercontent.com") continue;
    const [owner, repo, ref, ...rest] = u.pathname.split("/").filter(Boolean);
    if (!owner || !repo || !ref) continue;
    const path = rest.join("/");
    const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(ref)}`;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "kervly" };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const r = await fetch(api, { headers, cf: { cacheTtl: 120, cacheEverything: true } } as RequestInit);
    if (!r.ok) {
      if (!out.length) throw new AppError("gh.list", { status: r.status });
      continue;
    }
    const items = (await r.json()) as { type: string; name: string; size: number }[];
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if (it.type === "file" && /^[A-Za-z0-9._-]+\.mp4$/.test(it.name)) out.push({ name: it.name, url: prefix + it.name, size: it.size });
    }
  }
  // Newest-looking names first (v015 before v014…)
  return out.sort((a, b) => b.name.localeCompare(a.name, "en", { numeric: true })).slice(0, 300);
}
