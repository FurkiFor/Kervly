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

describe("account storage", () => {
  const key = b64(new Uint8Array(32).fill(9));
  function fakeEnv() {
    const users: Record<string, Record<string, unknown>> = { u_1: { id: "u_1", email: "a@b.c", storage_repo: null, storage_branch: null, storage_path: null, storage_token_enc: null, storage_private: 0 } };
    const brands: Record<string, Record<string, unknown>> = {
      alpha: { id: "alpha", owner_id: "u_1", storage_repo: null, storage_inherited: 0 },
      custom: { id: "custom", owner_id: "u_1", storage_repo: "me/own", storage_inherited: 0 },
    };
    const env = {
      ENCRYPTION_KEY: key,
      DB: {
        prepare(sql: string) {
          return {
            bind: (...a: unknown[]) => ({
              first: async () => (sql.startsWith("SELECT * FROM users") ? users[a[0] as string] : null),
              all: async () => ({ results: Object.values(brands).filter((b) => b.owner_id === a[0] && (!b.storage_repo || b.storage_inherited === 1)).map((b) => ({ id: b.id })) }),
              run: async () => {
                if (sql.startsWith("UPDATE users SET storage_repo = ?, storage_branch")) {
                  Object.assign(users[a[5] as string], { storage_repo: a[0], storage_branch: a[1], storage_path: a[2], storage_token_enc: a[3], storage_private: a[4] });
                } else if (sql.startsWith("UPDATE brands SET storage_repo = ?")) {
                  Object.assign(brands[a[6] as string], { storage_repo: a[0], storage_branch: a[1], storage_path: a[2], storage_token_enc: a[3], storage_private: a[4], storage_inherited: 1 });
                }
              },
            }),
          };
        },
      },
    };
    return { env: env as never, users, brands };
  }

  it("saves one token and gives every brand without its own storage a folder", async () => {
    const { env, users, brands } = fakeEnv();
    const puts: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        puts.push(String(url));
        return new Response("{}", { status: 201 });
      }
      return Response.json({ private: true, permissions: { push: true } });
    }) as typeof fetch;
    try {
      const { setAccountStorage } = await import("../src/storage");
      const r = await setAccountStorage(env, { id: "u_1" }, { repo: "https://github.com/me/videos", token: "github_pat_abc", path: "clips" });
      expect(r.storage).toMatchObject({ repo: "me/videos", branch: "main", path: "clips", private: true, has_token: true });
      expect(r.linked).toBe(1);
      expect(r.folders).toBe(1);
      expect(brands.alpha).toMatchObject({ storage_repo: "me/videos", storage_path: "clips/alpha", storage_inherited: 1, storage_private: 1 });
      expect(brands.custom.storage_repo).toBe("me/own"); // a brand with its own storage is left alone
      expect(puts).toEqual(["https://api.github.com/repos/me/videos/contents/clips/alpha/.gitkeep"]);
      // the token is stored encrypted, bound to the user, and re-encrypted for the brand
      expect(String(users.u_1.storage_token_enc)).not.toContain("github_pat_abc");
      expect(await decryptJson<string>(key, String(users.u_1.storage_token_enc), "storage-user:u_1")).toBe("github_pat_abc");
      expect(await decryptJson<string>(key, String(brands.alpha.storage_token_enc), "storage:alpha")).toBe("github_pat_abc");
      // keeping the token: leaving it empty reuses the saved one
      const again = await setAccountStorage(env, { id: "u_1" }, { repo: "me/videos", path: "clips" });
      expect(again.storage.repo).toBe("me/videos");
      // a different repository needs a new token
      await expect(setAccountStorage(env, { id: "u_1" }, { repo: "me/other" })).rejects.toBeInstanceOf(AppError);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("names brand folders under an optional base", async () => {
    const { brandFolder } = await import("../src/storage");
    expect(brandFolder("", "alpha")).toBe("alpha");
    expect(brandFolder("clips", "alpha")).toBe("clips/alpha");
  });
});

describe("youtube options", () => {
  const brand = { allowed_prefixes: ["https://raw.githubusercontent.com/o/r/main/v/"] };
  const env = { MEDIA_ALLOWED_HOSTS: "raw.githubusercontent.com" };
  const base = { platform: "youtube", media_url: "https://raw.githubusercontent.com/o/r/main/v/a.mp4", title: "T", publish_at: new Date(Date.now() + 3600_000).toISOString() };

  it("accepts the extra upload options", () => {
    const p = validateNewPost(
      { ...base, options: { language: "tr", audioLanguage: "ar", license: "creativeCommon", embeddable: false, publicStatsViewable: false, aiGenerated: true, category: "SCIENCE_TECH" } },
      brand,
      env,
    );
    expect(p.options).toMatchObject({ language: "tr", license: "creativeCommon", embeddable: false, aiGenerated: true, category: "SCIENCE_TECH" });
  });
  it("rejects a bad language code, license or category", () => {
    expect(() => validateNewPost({ ...base, options: { language: "turkish!" } }, brand, env)).toThrow(AppError);
    expect(() => validateNewPost({ ...base, options: { license: "gpl" } }, brand, env)).toThrow(AppError);
    expect(() => validateNewPost({ ...base, options: { category: "NOPE" } }, brand, env)).toThrow(AppError);
  });

  it("sends the options to YouTube", async () => {
    const { youtube } = await import("../src/platforms/youtube");
    let sent: { snippet: Record<string, unknown>; status: Record<string, unknown> } | null = null;
    // Workers-only class: a plain TransformStream is enough here
    (globalThis as Record<string, unknown>).FixedLengthStream = class {
      constructor() {
        return new TransformStream();
      }
    };
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        sent = JSON.parse(String(init.body));
        return new Response(null, { status: 200, headers: { Location: "https://www.googleapis.com/upload/x" } });
      }
      await new Response(init?.body as ReadableStream).arrayBuffer(); // drain the upload stream
      return Response.json({ id: "vid123" });
    }) as typeof fetch;
    try {
      const post = {
        options: JSON.stringify({ language: "tr", audioLanguage: "tr", license: "creativeCommon", embeddable: false, publicStatsViewable: true, aiGenerated: true, category: "MUSIC", privacy: "unlisted" }),
        title: "T", caption: "C", tags: "[]", media_url: "u",
        media_open: async () => ({ body: new Response("x").body!, size: 1 }),
      } as never;
      const r = await youtube.start({} as never, post, { tokens: { access_token: "a", expires_at: 0 }, account_id: "", account_name: "" });
      expect(r).toMatchObject({ state: "published", external_id: "vid123" });
      expect(sent!.snippet).toMatchObject({ defaultLanguage: "tr", defaultAudioLanguage: "tr", categoryId: "10" });
      expect(sent!.status).toMatchObject({ privacyStatus: "unlisted", license: "creativeCommon", embeddable: false, publicStatsViewable: true, containsSyntheticMedia: true });
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("asks for the read-only permission when connecting", () => {
    const url = new URL(youtube_authUrl());
    expect(url.searchParams.get("scope")).toContain("youtube.upload");
    expect(url.searchParams.get("scope")).toContain("youtube.readonly");
  });
});

import { youtube as ytAdapter } from "../src/platforms/youtube";
function youtube_authUrl() {
  return ytAdapter.authUrl({ GOOGLE_CLIENT_ID: "id" } as never, "https://x/cb", "st", "ch");
}

describe("youtube stats", () => {
  it("combines channel and video statistics", async () => {
    const key = b64(new Uint8Array(32).fill(5));
    const enc = await encryptJson(key, { access_token: "tok", refresh_token: "r", expires_at: Date.now() + 3600_000, scope: "x youtube.readonly" }, "conn:demo:youtube");
    const env = {
      ENCRYPTION_KEY: key,
      DB: {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => (sql.includes("FROM brands") ? { id: "demo", name: "Demo", media_prefixes: "[]", max_posts_per_day: 3, timezone: "UTC", default_times: "[]", owner_id: "u1" } : { brand_id: "demo", platform: "youtube", account_id: "UC1", account_name: "My Channel", enc_tokens: enc, access_expires_at: 0, updated_at: 0 }),
            all: async () => ({ results: [{ id: "p_1", title: "First", external_id: "v1", publish_at: 1_700_000_000_000 }, { id: "p_2", title: "Second", external_id: "v2", publish_at: 1_700_100_000_000 }] }),
            run: async () => ({}),
          }),
        }),
      },
    };
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("/channels")) {
        return Response.json({ items: [{ id: "UC1", snippet: { title: "My Channel", customUrl: "@mine" }, statistics: { subscriberCount: "1200", viewCount: "98765", videoCount: "40" } }] });
      }
      return Response.json({ items: [{ id: "v1", statistics: { viewCount: "100", likeCount: "10", commentCount: "2" } }, { id: "v2", statistics: { viewCount: "50", likeCount: "5" } }] });
    }) as typeof fetch;
    try {
      const { youtubeStats } = await import("../src/youtube-stats");
      const r = await youtubeStats(env as never, { id: "u1", email: "a@b.c", role: "user" } as never, "demo");
      expect(r.channel).toMatchObject({ id: "UC1", title: "My Channel", handle: "@mine", subscribers: 1200, views: 98765, videos: 40 });
      expect(r.kervly_videos).toEqual({ count: 2, views: 150, likes: 15, comments: 2 });
      expect(r.videos[0]).toMatchObject({ video_id: "v1", views: 100, url: "https://www.youtube.com/shorts/v1" });
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("youtube insights", () => {
  it("parses ISO durations", async () => {
    const { isoSeconds } = await import("../src/youtube-insights");
    expect(isoSeconds("PT45S")).toBe(45);
    expect(isoSeconds("PT1M30S")).toBe(90);
    expect(isoSeconds("PT1H2M3S")).toBe(3723);
    expect(isoSeconds(undefined)).toBe(0);
  });

  async function setup(scope: string) {
    const key = b64(new Uint8Array(32).fill(6));
    const enc = await encryptJson(key, { access_token: "tok", refresh_token: "r", expires_at: Date.now() + 3600_000, scope }, "conn:demo:youtube");
    return {
      ENCRYPTION_KEY: key,
      DB: {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => (sql.includes("FROM brands") ? { id: "demo", name: "Demo", media_prefixes: "[]", max_posts_per_day: 3, timezone: "UTC", default_times: "[]", owner_id: "u1" } : { brand_id: "demo", platform: "youtube", account_id: "UC1", account_name: "Ch", enc_tokens: enc, access_expires_at: 0, updated_at: 0 }),
            all: async () => ({ results: [{ id: "p_9", external_id: "v1" }] }),
            run: async () => ({}),
          }),
        }),
      },
    };
  }
  const video = (id: string, title: string, views: string, likes: string, comments: string, dur: string, tags: string[], at: string, desc = "") => ({
    id,
    snippet: { title, description: desc, tags, categoryId: "27", publishedAt: at, defaultAudioLanguage: "ar" },
    statistics: { viewCount: views, likeCount: likes, commentCount: comments },
    contentDetails: { duration: dur },
    status: { privacyStatus: "public" },
  });
  function mockYoutube(analytics: "ok" | "disabled") {
    return (async (url: string) => {
      const u = String(url);
      if (u.includes("/channels")) return Response.json({ items: [{ id: "UC1", snippet: { title: "Ch", customUrl: "@ch" }, statistics: { subscriberCount: "500", viewCount: "9000", videoCount: "3" }, contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] });
      if (u.includes("/playlistItems")) return Response.json({ items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }, { contentDetails: { videoId: "v3" } }] });
      if (u.includes("/videos")) {
        return Response.json({
          items: [
            video("v1", "Surah Fatiha #quran", "1000", "100", "10", "PT30S", ["quran", "recitation"], "2026-10-05T09:00:00Z", "Beautiful #quran recitation #islam"), // Monday 09 UTC
            video("v2", "Another one", "200", "10", "0", "PT45S", ["quran"], "2026-10-06T15:00:00Z"),
            video("v3", "Long lecture about patience", "50", "1", "0", "PT10M", [], "2026-10-07T15:00:00Z"),
          ],
        });
      }
      if (u.includes("youtubeanalytics")) {
        if (analytics === "disabled") return new Response('{"error":{"errors":[{"reason":"accessNotConfigured"}]}}', { status: 403 });
        if (u.includes("dimensions=day")) return Response.json({ rows: [["2026-10-10", 100, 50, 3, 1, 5, 1, 2], ["2026-10-11", 300, 150, 2, 0, 9, 0, 1]] });
        if (u.includes("insightTrafficSourceType")) return Response.json({ rows: [["SHORTS", 380, 190], ["YT_SEARCH", 20, 10]] });
        if (u.includes("dimensions=country")) return Response.json({ rows: [["TR", 250], ["SA", 150]] });
        return Response.json({ rows: [["v1", 300, 22.4, 74.6]] });
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
  }

  it("computes summary, patterns and analytics", async () => {
    const { youtubeInsights } = await import("../src/youtube-insights");
    const orig = globalThis.fetch;
    globalThis.fetch = mockYoutube("ok");
    try {
      const r = await youtubeInsights(await setup("a youtube.readonly yt-analytics.readonly") as never, { id: "u1", email: "a", role: "user" } as never, "demo", 28);
      expect(r.summary).toMatchObject({ analyzed_videos: 3, total_views: 1250, median_views: 200, shorts: 2, kervly_published: 1 });
      expect(r.summary.best[0]).toMatchObject({ id: "v1", views: 1000 });
      expect(r.summary.worst[0]).toMatchObject({ id: "v3" });
      expect(r.videos[0]).toMatchObject({ is_short: true, hashtags: ["#quran", "#islam"], category: "EDUCATION", language: "ar", engagement_rate: 11 });
      expect(r.patterns.by_weekday[0]).toMatchObject({ videos: 1, avg_views: 1000 }); // Monday
      expect(r.patterns.top_tags[0]).toMatchObject({ tag: "quran", videos: 2, avg_views: 600 });
      expect(r.patterns.by_duration.find((b) => b.label === "16–30 s")).toMatchObject({ videos: 1, avg_views: 1000 });
      expect(r.analytics).toMatchObject({ available: true });
      if (r.analytics.available) {
        expect(r.analytics.totals).toMatchObject({ views: 400, subscribers_gained: 5, subscribers_lost: 1, avg_view_seconds: 30 });
        expect(r.analytics.traffic_sources[0]).toMatchObject({ source: "SHORTS", views: 380 });
        expect(r.analytics.retention[0]).toMatchObject({ video_id: "v1", title: "Surah Fatiha #quran", avg_view_percentage: 74.6 });
      }
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("degrades when Analytics is unavailable and when the permission is missing", async () => {
    const { youtubeInsights, youtubeVideos } = await import("../src/youtube-insights");
    const orig = globalThis.fetch;
    globalThis.fetch = mockYoutube("disabled");
    try {
      const actor = { id: "u1", email: "a", role: "user" } as never;
      const r = await youtubeInsights(await setup("a youtube.readonly yt-analytics.readonly") as never, actor, "demo", 28);
      expect(r.analytics).toEqual({ available: false, reason: "api_disabled" });
      const noScope = await youtubeInsights(await setup("a youtube.readonly") as never, actor, "demo", 28);
      expect(noScope.analytics).toEqual({ available: false, reason: "scope" });
      await expect(youtubeVideos(await setup("a youtube.upload") as never, actor, "demo")).rejects.toBeInstanceOf(AppError);
      const list = await youtubeVideos(await setup("a youtube.readonly") as never, actor, "demo", { sort: "views", limit: 2, descriptionMax: 10 });
      expect(list.videos.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
      expect(list.videos[0].description.length).toBeLessThanOrEqual(10);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("video upload helpers", () => {
  it("sanitizes file names", async () => {
    const { sanitizeFileName } = await import("../src/storage");
    expect(sanitizeFileName("https://x.com/a/My Video (1).MOV?token=1")).toBe("My-Video-1.mp4");
    expect(sanitizeFileName("clip.mp4")).toBe("clip.mp4");
    expect(sanitizeFileName("###", "fallback")).toBe("fallback.mp4");
  });

  it("only lets MP4 data through", async () => {
    const { requireMp4 } = await import("../src/storage");
    const stream = (bytes: number[][]) => new ReadableStream<Uint8Array>({ start: (c) => (bytes.forEach((b) => c.enqueue(new Uint8Array(b))), c.close()) });
    const ftyp = [0, 0, 0, 24, 102, 116, 121, 112]; // size + "ftyp"
    const ok = await requireMp4(stream([ftyp.slice(0, 5), [...ftyp.slice(5), 1, 2, 3, 4, 5], [9, 9]]));
    const out = new Uint8Array(await new Response(ok).arrayBuffer());
    expect([...out]).toEqual([...ftyp, 1, 2, 3, 4, 5, 9, 9]); // nothing lost or reordered
    await expect(requireMp4(stream([[60, 104, 116, 109, 108, 62, 60, 47, 104, 116, 109, 108, 62]]))).rejects.toBeInstanceOf(AppError);
    await expect(requireMp4(stream([[1, 2, 3]]))).rejects.toBeInstanceOf(AppError);
  });

  it("refuses unsafe download links and missing sizes", async () => {
    const { downloadVideo } = await import("../src/storage");
    for (const u of ["http://example.com/a.mp4", "https://localhost/a.mp4", "https://127.0.0.1/a.mp4", "https://user:pw@example.com/a.mp4", "https://[::1]/a.mp4", "nope"]) {
      await expect(downloadVideo(u)).rejects.toBeInstanceOf(AppError);
    }
    const orig = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response(new Uint8Array(10), { status: 200 })) as typeof fetch;
      await expect(downloadVideo("https://example.com/a.mp4")).rejects.toBeInstanceOf(AppError); // no Content-Length
      globalThis.fetch = (async () => new Response("x", { status: 200, headers: { "Content-Length": String(999 * 1024 * 1024) } })) as typeof fetch;
      await expect(downloadVideo("https://example.com/a.mp4")).rejects.toBeInstanceOf(AppError); // too big
      globalThis.fetch = (async () => new Response("x", { status: 200, headers: { "Content-Length": "1", "Content-Type": "video/mp4" } })) as typeof fetch;
      expect((await downloadVideo("https://example.com/a.mp4")).size).toBe(1);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("signs upload links for one brand and file", async () => {
    const { signedUploadUrl, verifyUploadSig } = await import("../src/storage");
    const env = { ENCRYPTION_KEY: b64(new Uint8Array(32).fill(3)) } as never;
    const u = new URL(await signedUploadUrl(env, "https://k.app", "demo", "a.mp4"));
    expect(u.pathname).toBe("/upload/demo/a.mp4");
    const e = u.searchParams.get("e"), s = u.searchParams.get("s");
    expect(await verifyUploadSig(env, "demo", "a.mp4", e, s)).toBe(true);
    expect(await verifyUploadSig(env, "other", "a.mp4", e, s)).toBe(false);
    expect(await verifyUploadSig(env, "demo", "b.mp4", e, s)).toBe(false);
    expect(await verifyUploadSig(env, "demo", "a.mp4", String(Date.now() - 1000), s)).toBe(false);
  });
});

describe("signed upload link route", () => {
  it("commits an MP4 to the brand's GitHub folder, and refuses everything else", async () => {
    const key = b64(new Uint8Array(32).fill(4));
    const { encryptStorageToken, signedUploadUrl } = await import("../src/storage");
    const { handleUploadLink } = await import("../src/upload-link");
    const tokenEnc = await encryptStorageToken({ ENCRYPTION_KEY: key } as never, "demo", "github_pat_x");
    const row = { id: "demo", name: "Demo", media_prefixes: "[]", max_posts_per_day: 3, timezone: "UTC", default_times: "[]", owner_id: "u1", storage_repo: "me/videos", storage_branch: "main", storage_path: "demo", storage_token_enc: tokenEnc, storage_private: 0 };
    const audits: string[][] = [];
    const env = {
      ENCRYPTION_KEY: key,
      DB: {
        prepare: (sql: string) => ({
          bind: (...a: unknown[]) => ({
            first: async () => (sql.includes("FROM brands") ? row : null),
            all: async () => ({ results: [] }),
            run: async () => (sql.includes("audit_log") ? audits.push(a.map(String)) : {}),
          }),
        }),
      },
    } as never;
    const url = await signedUploadUrl(env, "https://k.app", "demo", "clip.mp4");
    const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 1, 2, 3, 4, 5, 6, 7, 8]);
    const put = (u: string, body: BodyInit, headers: Record<string, string> = {}) => { const req = new Request(u, { method: "PUT", body, headers: { "Content-Length": String((body as Uint8Array).length), ...headers } }); return handleUploadLink(req, env, new URL(u), "en"); }

    const orig = globalThis.fetch;
    const calls: { url: string; method: string }[] = [];
    (globalThis as Record<string, unknown>).FixedLengthStream = class {
      constructor() {
        return new TransformStream();
      }
    };
    globalThis.fetch = (async (u: string, init?: RequestInit) => {
      calls.push({ url: String(u), method: init?.method ?? "GET" });
      if (init?.method === "HEAD") return new Response(null, { status: 404 });
      if (init?.method === "PUT") {
        const body = await new Response(init.body as ReadableStream).text();
        expect(JSON.parse(body)).toMatchObject({ branch: "main", content: btoa(String.fromCharCode(...mp4)) });
        return new Response("{}", { status: 201 });
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    try {
      const ok = await put(url, mp4);
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ name: "clip.mp4", url: "https://raw.githubusercontent.com/me/videos/main/demo/clip.mp4" });
      expect(calls.some((c) => c.method === "PUT" && c.url === "https://api.github.com/repos/me/videos/contents/demo/clip.mp4")).toBe(true);
      expect(audits.some((a) => a.includes("media.upload"))).toBe(true);

      // wrong signature, other file name, expired link
      expect((await put(url.replace(/s=[^&]+/, "s=AAAA"), mp4)).status).toBe(403);
      expect((await put(url.replace("clip.mp4", "other.mp4"), mp4)).status).toBe(403);
      expect((await put(url.replace(/e=\d+/, "e=1"), mp4)).status).toBe(403);
      // not an MP4
      const html = new TextEncoder().encode("<html>not a video</html>");
      expect((await put(url, html)).status).toBe(400);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
