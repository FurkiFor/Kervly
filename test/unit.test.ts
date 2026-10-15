import { describe, expect, it } from "vitest";
import { b64, base32Encode, decryptJson, encryptJson, hashPassword, totpAt, verifyPassword, verifyTotp } from "../src/crypto";
import { validateMediaUrl, validatePrefix } from "../src/media";
import { esc, safeNext, zonedToUtc } from "../src/http";
import { validateNewPost } from "../src/db";
import { apiError } from "../src/platforms/types";
import { tiktok } from "../src/platforms/tiktok";
import { AppError, format, localize, renderStored, storeMsg } from "../src/i18n";

const HOSTS = "raw.githubusercontent.com";
const PREFIX = "https://raw.githubusercontent.com/example/videos/main/clips/";
const PREFIXES = [PREFIX];
const env = { MEDIA_ALLOWED_HOSTS: HOSTS };
const brand = { allowed_prefixes: PREFIXES };

describe("crypto", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("AES-GCM round-trips and binds the context", async () => {
    const key = b64(crypto.getRandomValues(new Uint8Array(32)));
    const blob = await encryptJson(key, { a: 1 }, "conn:brand:youtube");
    expect(await decryptJson(key, blob, "conn:brand:youtube")).toEqual({ a: 1 });
    await expect(decryptJson(key, blob, "conn:other:youtube")).rejects.toThrow();
  });
  it("matches the RFC 6238 TOTP test vector", async () => {
    const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
    expect(await totpAt(secret, Math.floor(59 / 30))).toBe("287082");
    expect(await verifyTotp(secret, "287082", 59_000)).toBe(1);
    expect(await verifyTotp(secret, "000000", 59_000)).toBe(null);
  });
});

describe("media allowlist", () => {
  it("accepts an allowlisted URL", () => expect(validateMediaUrl(`${PREFIX}a.mp4`, PREFIXES, HOSTS)).toBe(`${PREFIX}a.mp4`));
  for (const bad of [
    `http://raw.githubusercontent.com/example/videos/main/clips/a.mp4`,
    `${PREFIX}../README.md`,
    `${PREFIX}%2e%2e/x.mp4`,
    `https://raw.githubusercontent.com/someone-else/repo/main/clips/a.mp4`,
    `${PREFIX}a.mp4?x=1`,
    `https://evil.com/${PREFIX}a.mp4`,
    `https://raw.githubusercontent.com.evil.com/example/videos/main/clips/a.mp4`,
    `https://user@raw.githubusercontent.com/example/videos/main/clips/a.mp4`,
    `https://raw.githubusercontent.com:8443/example/videos/main/clips/a.mp4`,
    `${PREFIX}a.exe`,
  ]) {
    it(`rejects ${bad}`, () => expect(() => validateMediaUrl(bad, PREFIXES, HOSTS)).toThrow(AppError));
  }
  it("rejects everything when the allowlist is empty", () => expect(() => validateMediaUrl(`${PREFIX}a.mp4`, [], HOSTS)).toThrow());
});

describe("allowlist prefixes", () => {
  it("accepts a valid prefix", () => expect(validatePrefix(PREFIX, HOSTS)).toBe(PREFIX));
  for (const bad of [
    "https://raw.githubusercontent.com/",
    "https://raw.githubusercontent.com/example/",
    "https://evil.com/a/b/",
    "http://raw.githubusercontent.com/a/b/",
    "https://raw.githubusercontent.com/a/b",
    "https://raw.githubusercontent.com/a/../b/",
    "https://raw.githubusercontent.com:8443/a/b/",
  ]) {
    it(`rejects ${bad}`, () => expect(() => validatePrefix(bad, HOSTS)).toThrow());
  }
});

describe("helpers", () => {
  it("converts zoned local time to UTC", () => {
    expect(new Date(zonedToUtc("2026-10-15T10:00", "Asia/Dubai")).toISOString()).toBe("2026-10-15T06:00:00.000Z");
    expect(new Date(zonedToUtc("2026-07-01T10:00", "Europe/Istanbul")).toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(new Date(zonedToUtc("2026-07-01T10:00", "America/New_York")).toISOString()).toBe("2026-07-01T14:00:00.000Z");
  });
  it("blocks open redirects", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/\t/evil.com")).toBe("/");
    expect(safeNext("/\n/evil.com")).toBe("/");
    expect(safeNext("/authorize?x=1")).toBe("/authorize?x=1");
  });
  it("escapes HTML", () => expect(esc(`<script>"'&`)).toBe("&#60;script&#62;&#34;&#39;&#38;"));
});

describe("i18n", () => {
  it("renders the same error in both languages", () => {
    const e = new AppError("post.daily_limit", { brand: "Demo", platform: "youtube", max: 3 });
    expect(localize(e, "en")).toBe("Demo / youtube already has 3 posts that day (daily limit)");
    expect(localize(e, "tr")).toBe("Demo / youtube için o gün zaten 3 gönderi var (günlük sınır)");
  });
  it("stores and re-renders nested messages", () => {
    const stored = storeMsg(new AppError("post.retry_later", { reason: new AppError("m.unreachable", { status: 503 }) }));
    expect(renderStored(stored, "tr")).toBe("Tekrar denenecek: Video erişilemiyor (HTTP 503)");
    expect(renderStored(stored, "en")).toBe("Will retry: Video is not reachable (HTTP 503)");
  });
  it("translates step parameters", () => {
    expect(format("tr", "pf.http", { platform: "YouTube", step: "@step.upload", status: 500, detail: "" })).toBe("YouTube video yükleme başarısız (HTTP 500)");
  });
  it("keeps plain stored text", () => expect(renderStored("plain", "en")).toBe("plain"));
});

describe("post validation", () => {
  const base = { platform: "youtube", media_url: `${PREFIX}a.mp4`, title: "Title", publish_at: new Date(Date.now() + 3600_000).toISOString() };
  it("accepts a valid post", () => expect(validateNewPost(base, brand, env).platform).toBe("youtube"));
  it("requires a time zone", () => expect(() => validateNewPost({ ...base, publish_at: "2026-10-15T10:00:00" }, brand, env)).toThrow());
  it("rejects the past", () => expect(() => validateNewPost({ ...base, publish_at: "2020-01-01T00:00:00Z" }, brand, env)).toThrow());
  it("rejects unknown options", () => expect(() => validateNewPost({ ...base, options: { hack: true } }, brand, env)).toThrow());
  it("rejects invalid enum values", () => expect(() => validateNewPost({ ...base, options: { privacy: "x" } }, brand, env)).toThrow());
  it("rejects unknown platforms", () => expect(() => validateNewPost({ ...base, platform: "facebook" }, brand, env)).toThrow());
  it("limits YouTube titles to 100 chars", () => expect(() => validateNewPost({ ...base, title: "a".repeat(101) }, brand, env)).toThrow());
});

import { base64Stream, parseStorageInput, signedMediaUrl, verifyMediaSig } from "../src/storage";
import { normalizeEmail } from "../src/users";

describe("storage", () => {
  it("streams base64 identically to a one-shot encode, for any chunking", async () => {
    for (const size of [0, 1, 2, 3, 100, 65537, 300001]) {
      const data = crypto.getRandomValues(new Uint8Array(size > 65536 ? 65536 : size));
      const big = new Uint8Array(size);
      for (let i = 0; i < size; i += data.length || 1) big.set(data.subarray(0, Math.min(data.length, size - i)), i);
      let pos = 0;
      const src = new ReadableStream<Uint8Array>({
        pull(c) {
          if (pos >= size) return c.close();
          const n = 1 + Math.floor(Math.random() * 7000);
          c.enqueue(big.slice(pos, pos + n));
          pos += n;
        },
      });
      const out = await new Response(src.pipeThrough(base64Stream())).text();
      expect(out).toBe(Buffer.from(big).toString("base64"));
    }
  });
  it("validates storage input", () => {
    expect(parseStorageInput({ repo: "https://github.com/me/videos.git", path: "/clips/" })).toEqual({ repo: "me/videos", branch: "main", path: "clips", token: undefined });
    for (const bad of [{ repo: "nope" }, { repo: "a/b", path: "../x" }, { repo: "a/b", branch: "a..b" }, { repo: "a/b", token: "bad token!" }]) {
      expect(() => parseStorageInput(bad as Record<string, unknown>)).toThrow();
    }
  });
  it("signs and verifies media links", async () => {
    const env = { ENCRYPTION_KEY: b64(crypto.getRandomValues(new Uint8Array(32))) } as never;
    const url = new URL(await signedMediaUrl(env, "https://app.example.com", "p_abcdefgh"));
    expect(url.pathname).toBe("/m/p_abcdefgh.mp4");
    expect(await verifyMediaSig(env, "p_abcdefgh", url.searchParams.get("e"), url.searchParams.get("s"))).toBe(true);
    expect(await verifyMediaSig(env, "p_other000", url.searchParams.get("e"), url.searchParams.get("s"))).toBe(false);
    expect(await verifyMediaSig(env, "p_abcdefgh", String(Date.now() - 1), url.searchParams.get("s"))).toBe(false);
  });
});

describe("accounts", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
    for (const bad of ["", "a", "a@b", "a b@c.com", "<x>@y.com"]) expect(() => normalizeEmail(bad)).toThrow();
  });
});

describe("platform errors", () => {
  it("keeps an API error code but hides tokens", async () => {
    const r = new Response('{"error":{"code":"spam_risk","message":"x"},"access_token":"SECRET123","refresh_token":"R-1"}', { status: 403 });
    const e = await apiError("TikTok", "upload_init", r);
    const detail = String((e as unknown as { params: Record<string, unknown> }).params.detail);
    expect(detail).toContain("spam_risk");
    expect(detail).not.toContain("SECRET123");
    expect(detail).not.toContain("R-1");
  });
  it("hides OAuth codes in form bodies", async () => {
    const e = await apiError("TikTok", "token_exchange", new Response("grant_type=x&code=abc123&state=s", { status: 400 }));
    expect(String((e as unknown as { params: Record<string, unknown> }).params.detail)).not.toContain("abc123");
  });
  it("maps TikTok's unaudited 403 to a helpful message", async () => {
    const orig = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("creator_info")) return Response.json({ data: { privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok", message: "" } });
      return Response.json({ error: { code: "unaudited_client_can_only_post_to_private_accounts", message: "Please review our integration guidelines" } }, { status: 403 });
    }) as typeof fetch;
    try {
      const post = { options: "{}", caption: "c", title: "t", media_url: "u", media_open: async () => ({ body: new Response("x").body!, size: 1 }) } as never;
      const err = await tiktok.start({ TIKTOK_UNAUDITED: "true" } as never, post, { tokens: { access_token: "a" } } as never).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(localize(err, "en")).toContain("must be set to private");
      expect(localize(err, "tr")).toContain("Gizli hesap");
    } finally {
      globalThis.fetch = orig;
    }
    expect(calls.length).toBe(2);
  });
});

describe("totp clock tolerance", () => {
  it("accepts up to 60 s of drift but not more", async () => {
    const secret = base32Encode(new Uint8Array(20).fill(7));
    const now = 1_700_000_000_000;
    const counter = Math.floor(now / 1000 / 30);
    expect(await verifyTotp(secret, await totpAt(secret, counter + 2), now)).toBe(counter + 2);
    expect(await verifyTotp(secret, await totpAt(secret, counter - 2), now)).toBe(counter - 2);
    expect(await verifyTotp(secret, await totpAt(secret, counter + 3), now)).toBeNull();
  });
});
