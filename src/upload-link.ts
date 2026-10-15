import type { Env } from "./env";
import { audit } from "./db";
import { getBrandRow } from "./brands";
import { json } from "./http";
import { AppError, format, localize, type Lang } from "./i18n";
import { requireMp4, uploadToStorage, verifyUploadSig } from "./storage";

/** PUT a video to a signed link created by the MCP tool create_upload_link; Kervly commits it to the brand's GitHub folder. */
export async function handleUploadLink(req: Request, env: Env, url: URL, lang: Lang): Promise<Response> {
  const m = /^\/upload\/([a-z0-9-]{2,32})\/([A-Za-z0-9][A-Za-z0-9._-]{0,120}\.mp4)$/.exec(url.pathname);
  if (!m || req.method !== "PUT") return new Response(null, { status: m ? 405 : 404, headers: m ? { Allow: "PUT" } : {} });
  const [, brandId, fileName] = m;
  const fail = (key: "s.link_invalid" | string, status: number) => json({ error: format(lang, key as never) }, status);
  if (!(await verifyUploadSig(env, brandId, fileName, url.searchParams.get("e"), url.searchParams.get("s")))) return fail("s.link_invalid", 403);
  try {
    const row = await getBrandRow(env, brandId);
    const size = Number(req.headers.get("Content-Length") || 0);
    if (!req.body) throw new AppError("err.bad_body");
    const file = await uploadToStorage(env, row, fileName, await requireMp4(req.body), size, "upload-link");
    await audit(env, "mcp:upload-link", "media.upload", `${row.id}/${file.name} ${(size / 1048576).toFixed(1)}MB`, { user: row.owner_id, brand: row.id });
    return json(file);
  } catch (e) {
    return json({ error: localize(e, lang) }, e instanceof AppError ? 400 : 500);
  }
}
