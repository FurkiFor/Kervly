import { AppError } from "./i18n";

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

function allowedHosts(hostsCsv: string): string[] {
  return hostsCsv
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

const BAD_SEQUENCES = /%2e|%2f|%5c|\.\.|\\/i;

/**
 * Validates a brand allowlist prefix: https, allowed host, no credentials/port/query,
 * ends with "/" and is at least two folders deep (so a whole host can never be allowed).
 */
export function validatePrefix(raw: string, hostsCsv: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new AppError("p.invalid", { value: raw.slice(0, 100) });
  }
  if (u.protocol !== "https:") throw new AppError("p.https");
  if (u.username || u.password || u.search || u.hash || u.port) throw new AppError("p.parts");
  if (!allowedHosts(hostsCsv).includes(u.hostname.toLowerCase())) throw new AppError("p.host", { hosts: hostsCsv });
  if (BAD_SEQUENCES.test(raw)) throw new AppError("p.bad_chars");
  if (!u.pathname.endsWith("/")) throw new AppError("p.slash");
  if (u.pathname.split("/").filter(Boolean).length < 2) throw new AppError("p.depth");
  if (!/^[A-Za-z0-9._\-/]+$/.test(u.pathname)) throw new AppError("p.bad_chars");
  return u.toString();
}

/** A video URL must start with one of the brand's allowlist prefixes. Nothing else is accepted. */
export function validateMediaUrl(raw: string, prefixes: string[], hostsCsv: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AppError("m.invalid_url");
  }
  if (u.protocol !== "https:") throw new AppError("m.https");
  if (u.username || u.password || u.search || u.hash || u.port) throw new AppError("m.url_parts");
  if (BAD_SEQUENCES.test(raw)) throw new AppError("m.bad_chars");
  if (!/^[A-Za-z0-9._\-/]+\.mp4$/.test(u.pathname)) throw new AppError("m.mp4_only");
  if (!allowedHosts(hostsCsv).includes(u.hostname.toLowerCase())) throw new AppError("m.host");
  const normalized = u.toString();
  if (!prefixes.length) throw new AppError("m.empty_allowlist");
  if (!prefixes.some((p) => p.endsWith("/") && normalized.startsWith(p))) throw new AppError("m.not_allowed");
  return normalized;
}

/** Checks that the video is reachable and not too large (redirects are not followed). */
export async function probeMedia(url: string): Promise<{ size: number }> {
  const r = await fetch(url, { method: "HEAD", redirect: "manual" });
  if (r.status !== 200) throw new AppError("m.unreachable", { status: r.status });
  const size = Number(r.headers.get("Content-Length") || 0);
  if (!size) throw new AppError("m.size_unknown");
  if (size > MAX_VIDEO_BYTES) throw new AppError("m.too_big");
  return { size };
}

/** Opens the video as a stream so it can be piped to a platform without buffering it in memory. */
export async function openMedia(url: string): Promise<{ body: ReadableStream; size: number }> {
  const r = await fetch(url, { redirect: "manual" });
  if (r.status !== 200 || !r.body) throw new AppError("m.download", { status: r.status });
  const size = Number(r.headers.get("Content-Length") || 0);
  if (!size) throw new AppError("m.size_unknown");
  if (size > MAX_VIDEO_BYTES) throw new AppError("m.too_big");
  return { body: r.body, size };
}
