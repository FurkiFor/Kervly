import { randomToken } from "./crypto";
import { AppError } from "./i18n";

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function securityHeaders(nonce: string, extraFormAction = ""): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "img-src 'self' data:",
      "connect-src 'self'",
      `form-action 'self'${extraFormAction ? " " + extraFormAction : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'none'",
    ].join("; "),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    // "same-origin" keeps the Origin header on same-origin form posts (needed for the origin check)
    "Referrer-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
  };
}

export function newNonce(): string {
  return randomToken(16);
}

export function html(body: string, nonce: string, init: ResponseInit & { formAction?: string } = {}): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(securityHeaders(nonce, init.formAction))) headers.set(k, v);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { status: init.status ?? 200, headers });
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
}

export function redirect(location: string, headers: Record<string, string> | Headers = {}): Response {
  const h = new Headers(headers);
  h.set("Location", location);
  h.set("Cache-Control", "no-store");
  return new Response(null, { status: 302, headers: h });
}

/** Local wall-clock time ("YYYY-MM-DDTHH:mm") in a time zone → UTC milliseconds. */
export function zonedToUtc(local: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new AppError("v.local_date");
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offset = (ms: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(new Date(ms))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  const t = guess - offset(guess);
  return guess - offset(t);
}

/** Only same-origin relative paths are allowed as a post-login redirect (no open redirect). */
export function safeNext(next: string | null): string {
  if (!next || next.length > 2000) return "/";
  // Control characters (tab, CR, LF…) are stripped by browsers and could turn "/\t/x" into "//x"
  if (/[\u0000-\u001F\u007F\\]/.test(next)) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  const base = "https://x.invalid";
  let u: URL;
  try {
    u = new URL(next, base);
  } catch {
    return "/";
  }
  return u.origin === base ? u.pathname + u.search : "/";
}
