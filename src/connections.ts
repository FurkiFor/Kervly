import { PLATFORMS, type Env, type Platform } from "./env";
import { decryptJson, encryptJson } from "./crypto";
import { audit } from "./db";
import { getBrand } from "./brands";
import { AppError, localize } from "./i18n";
import type { ConnectedAccount, PlatformAdapter, TokenSet } from "./platforms/types";
import { youtube } from "./platforms/youtube";
import { instagram } from "./platforms/instagram";
import { tiktok } from "./platforms/tiktok";

export const ADAPTERS: Record<Platform, PlatformAdapter> = { youtube, instagram, tiktok };

interface ConnRow {
  brand_id: string;
  platform: Platform;
  account_id: string | null;
  account_name: string | null;
  enc_tokens: string;
  access_expires_at: number;
  updated_at: number;
}

function key(env: Env): string {
  if (!env.ENCRYPTION_KEY) throw new AppError("c.no_key");
  return env.ENCRYPTION_KEY;
}

/** Ciphertext is bound to brand + platform: copied to another row it will not decrypt. */
const aad = (brandId: string, platform: Platform) => `conn:${brandId}:${platform}`;

export async function saveConnection(env: Env, brandId: string, platform: Platform, acc: ConnectedAccount): Promise<void> {
  await getBrand(env, brandId);
  const blob = await encryptJson(key(env), acc.tokens, aad(brandId, platform));
  await env.DB.prepare(
    `INSERT INTO connections (brand_id, platform, account_id, account_name, enc_tokens, access_expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(brand_id, platform) DO UPDATE SET account_id = excluded.account_id, account_name = excluded.account_name,
       enc_tokens = excluded.enc_tokens, access_expires_at = excluded.access_expires_at, updated_at = excluded.updated_at`,
  )
    .bind(brandId, platform, acc.account_id, acc.account_name, blob, acc.tokens.expires_at, Date.now())
    .run();
}

async function updateTokens(env: Env, brandId: string, platform: Platform, tokens: TokenSet): Promise<void> {
  const blob = await encryptJson(key(env), tokens, aad(brandId, platform));
  await env.DB.prepare("UPDATE connections SET enc_tokens = ?, access_expires_at = ?, updated_at = ? WHERE brand_id = ? AND platform = ?")
    .bind(blob, tokens.expires_at, Date.now(), brandId, platform)
    .run();
}

export async function deleteConnection(env: Env, brandId: string, platform: Platform, actor: string): Promise<void> {
  await env.DB.prepare("DELETE FROM connections WHERE brand_id = ? AND platform = ?").bind(brandId, platform).run();
  await audit(env, actor, "connection.delete", `${brandId}/${platform}`);
}

/** Decrypts a connection and refreshes its token when needed. */
export async function getAccount(env: Env, brandId: string, platform: Platform, now = Date.now()): Promise<ConnectedAccount> {
  const row = await env.DB.prepare("SELECT * FROM connections WHERE brand_id = ? AND platform = ?").bind(brandId, platform).first<ConnRow>();
  if (!row) throw new AppError("c.not_connected", { brand: brandId, platform });
  let tokens = await decryptJson<TokenSet>(key(env), row.enc_tokens, aad(brandId, platform));
  const fresh = await ADAPTERS[platform].refreshIfNeeded(env, tokens, now);
  if (fresh) {
    tokens = fresh;
    await updateTokens(env, brandId, platform, tokens);
    await audit(env, "system", "connection.refresh", `${brandId}/${platform}`);
  }
  return { tokens, account_id: row.account_id ?? "", account_name: row.account_name ?? "" };
}

export interface ConnectionStatus {
  brand: string;
  platform: Platform;
  configured: boolean;
  connected: boolean;
  account_name: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
}

/** Token-free connection summary (optionally for one brand). */
export async function connectionStatus(env: Env, brandId?: string): Promise<ConnectionStatus[]> {
  const brands = brandId
    ? [(await getBrand(env, brandId)).id]
    : (await env.DB.prepare("SELECT id FROM brands ORDER BY created_at").all<{ id: string }>()).results.map((b) => b.id);
  const { results } = await env.DB.prepare("SELECT brand_id, platform, account_name, access_expires_at, updated_at FROM connections").all<ConnRow>();
  return brands.flatMap((b) =>
    PLATFORMS.map((p) => {
      const r = results.find((x) => x.platform === p && x.brand_id === b);
      return {
        brand: b,
        platform: p,
        configured: ADAPTERS[p].configured(env),
        connected: Boolean(r),
        account_name: r?.account_name ?? null,
        token_expires_at: r?.access_expires_at ? new Date(r.access_expires_at).toISOString() : null,
        updated_at: r ? new Date(r.updated_at).toISOString() : null,
      };
    }),
  );
}

/** Cron: refresh tokens before they expire (important for Instagram's 60-day tokens). */
export async function refreshAllConnections(env: Env): Promise<void> {
  const { results } = await env.DB.prepare("SELECT brand_id, platform FROM connections").all<{ brand_id: string; platform: Platform }>();
  for (const r of results) {
    try {
      await getAccount(env, r.brand_id, r.platform);
    } catch (e) {
      await audit(env, "system", "connection.refresh_error", `${r.brand_id}/${r.platform}: ${localize(e, "en").slice(0, 300)}`);
    }
  }
}
