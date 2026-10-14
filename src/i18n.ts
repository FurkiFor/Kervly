/**
 * Internationalisation (English + Turkish).
 *
 * Server code never throws human-readable strings. It throws `AppError(key, params)`; the HTTP/MCP
 * layer renders the message in the caller's language. Errors stored in the database are kept as
 * JSON `{ k, p }` so they can be rendered later in any language.
 */

export type Lang = "en" | "tr";
export const LANGS: Lang[] = ["en", "tr"];

type Params = Record<string, unknown>;
type Dict = Record<string, { en: string; tr: string }>;

const MESSAGES = {
  // generic
  "err.internal": { en: "Server error", tr: "Sunucu hatası" },
  "err.not_found": { en: "Not found", tr: "Bulunamadı" },
  "err.json_expected": { en: "A JSON body is expected", tr: "JSON gövde bekleniyor" },
  "err.too_large": { en: "Request is too large", tr: "İstek çok büyük" },
  "err.bad_body": { en: "Invalid request body", tr: "Geçersiz istek gövdesi" },
  "err.csrf": { en: "CSRF check failed", tr: "CSRF doğrulaması başarısız" },
  "err.login_required": { en: "Sign-in required", tr: "Giriş gerekli" },
  "err.bad_origin": { en: "Invalid origin", tr: "Geçersiz köken" },
  "err.raw": { en: "{text}", tr: "{text}" },

  // validation
  "v.required": { en: "{field} is required", tr: "{field} gerekli" },
  "v.string": { en: "{field} must be text", tr: "{field} metin olmalı" },
  "v.max_len": { en: "{field} can be at most {max} characters", tr: "{field} en fazla {max} karakter olabilir" },
  "v.platform": { en: "platform must be youtube, instagram or tiktok", tr: "platform youtube, instagram ya da tiktok olmalı" },
  "v.platforms_required": { en: "Select at least one platform", tr: "En az bir platform seçin" },
  "v.platforms_dupe": { en: "platforms must not contain duplicates", tr: "platforms tekrar içeremez" },
  "v.yt_title_chars": { en: "YouTube titles cannot contain < or >", tr: "YouTube başlığında < ve > olamaz" },
  "v.tags_list": { en: "tags must be a list of at most 30 items", tr: "tags en fazla 30 öğelik liste olmalı" },
  "v.tags_total": { en: "Tags are too long in total", tr: "Etiketlerin toplam uzunluğu çok fazla" },
  "v.when_required": { en: "publish_at is required (ISO 8601 with time zone)", tr: "publish_at gerekli (ISO 8601, saat dilimiyle)" },
  "v.when_tz": { en: "publish_at must include a time zone, e.g. 2026-10-15T10:00:00+04:00", tr: "publish_at saat dilimi içermeli, ör. 2026-10-15T10:00:00+04:00" },
  "v.when_invalid": { en: "publish_at is not a valid date", tr: "publish_at geçersiz tarih" },
  "v.when_past": { en: "publish_at must be at least 1 minute in the future", tr: "publish_at en az 1 dakika sonrası olmalı" },
  "v.when_far": { en: "publish_at can be at most 60 days in the future", tr: "publish_at en fazla 60 gün sonrası olabilir" },
  "v.local_date": { en: "Date must be in YYYY-MM-DDTHH:mm format", tr: "Tarih biçimi YYYY-MM-DDTHH:mm olmalı" },
  "v.options_object": { en: "options must be an object", tr: "options nesne olmalı" },
  "v.option_unknown": { en: "Unknown option for {platform}: {key}", tr: "{platform} için bilinmeyen seçenek: {key}" },
  "v.option_bool": { en: "{key} must be true/false", tr: "{key} true/false olmalı" },
  "v.option_text": { en: "{key} must be text", tr: "{key} metin olmalı" },
  "v.option_enum": { en: "{key} must be one of: {values}", tr: "{key} şunlardan biri olmalı: {values}" },
  "v.id_required": { en: "id is required", tr: "id gerekli" },
  "v.arguments": { en: "arguments must be an object", tr: "arguments nesne olmalı" },

  // posts
  "post.daily_limit": {
    en: "{brand} / {platform} already has {max} posts that day (daily limit)",
    tr: "{brand} / {platform} için o gün zaten {max} gönderi var (günlük sınır)",
  },
  "post.duplicate": { en: "This video is already scheduled for this brand, platform and time", tr: "Bu video bu markada, bu platformda bu saate zaten planlanmış" },
  "post.not_found": { en: "Post not found", tr: "Gönderi bulunamadı" },
  "post.cannot_cancel": { en: "Post not found or can no longer be cancelled (live or in progress)", tr: "Gönderi bulunamadı ya da artık iptal edilemez (yayında veya işleniyor)" },
  "post.cannot_retry": { en: "Only failed posts can be retried", tr: "Sadece hata durumundaki gönderiler yeniden denenebilir" },
  "post.interrupted": {
    en: "Upload was interrupted. Check whether it was posted on the platform and retry if needed.",
    tr: "Yükleme kesintiye uğradı. Platformda paylaşılıp paylaşılmadığını kontrol edip gerekirse yeniden deneyin.",
  },
  "post.retry_later": { en: "Will retry: {reason}", tr: "Tekrar denenecek: {reason}" },
  "post.poll_retry": { en: "Status check will be retried: {reason}", tr: "Durum sorgusu tekrar denenecek: {reason}" },

  // media
  "m.invalid_url": { en: "Invalid video URL", tr: "Geçersiz video adresi" },
  "m.https": { en: "Video URL must use https", tr: "Video adresi https olmalı" },
  "m.url_parts": { en: "Video URL cannot contain credentials, a port, a query or #", tr: "Video adresinde kullanıcı, port, sorgu ya da # olamaz" },
  "m.bad_chars": { en: "Video URL contains invalid characters", tr: "Video adresinde geçersiz karakter" },
  "m.mp4_only": { en: "Only .mp4 files can be posted", tr: "Sadece .mp4 dosyaları paylaşılabilir" },
  "m.host": { en: "Video host is not allowed", tr: "Video alan adı izinli değil" },
  "m.empty_allowlist": { en: "This brand's video allowlist is empty; add one in the dashboard", tr: "Bu markanın video izin listesi boş; panelden ekleyin" },
  "m.not_allowed": { en: "This video URL is not in the brand's allowlist", tr: "Bu video adresi markanın izin listesinde değil" },
  "m.unreachable": { en: "Video is not reachable (HTTP {status})", tr: "Video erişilemiyor (HTTP {status})" },
  "m.size_unknown": { en: "Could not read the video size", tr: "Video boyutu okunamadı" },
  "m.too_big": { en: "Video is larger than 200 MB", tr: "Video 200 MB'tan büyük" },
  "m.download": { en: "Could not download the video (HTTP {status})", tr: "Video indirilemedi (HTTP {status})" },

  // allowlist prefixes
  "p.invalid": { en: "Invalid prefix: {value}", tr: "Geçersiz önek: {value}" },
  "p.https": { en: "Prefix must use https", tr: "Önek https olmalı" },
  "p.parts": { en: "Prefix cannot contain credentials, a port, a query or #", tr: "Önekte kullanıcı, port, sorgu ya da # olamaz" },
  "p.host": { en: "Prefix host is not allowed (allowed: {hosts})", tr: "Önek alan adı izinli değil (izinli: {hosts})" },
  "p.bad_chars": { en: "Prefix contains invalid characters", tr: "Önekte geçersiz karakter" },
  "p.slash": { en: "Prefix must end with '/'", tr: "Önek '/' ile bitmeli" },
  "p.depth": { en: "Prefix must be at least two folders deep (e.g. owner/repo/)", tr: "Önek en az iki klasör derinliğinde olmalı (ör. kullanıcı/repo/)" },

  // brands
  "b.id_format": { en: "Brand id must be 2-32 chars: lowercase letters, digits, dashes (e.g. mybrand)", tr: "Marka kimliği 2-32 karakter, küçük harf/rakam/tire olmalı (ör. markam)" },
  "b.name_len": { en: "Brand name must be 1-60 characters", tr: "Marka adı 1-60 karakter olmalı" },
  "b.too_many_prefixes": { en: "At most 10 prefixes", tr: "En fazla 10 önek" },
  "b.limit_range": { en: "Daily limit must be between 1 and {max}", tr: "Günlük sınır 1-{max} arası olmalı" },
  "b.tz_invalid": { en: "Invalid time zone (e.g. Europe/Istanbul, Asia/Dubai)", tr: "Geçersiz saat dilimi (ör. Europe/Istanbul, Asia/Dubai)" },
  "b.required": { en: "A valid brand is required", tr: "Geçerli bir marka (brand) gerekli" },
  "b.not_found": { en: "Brand not found: {id}", tr: "Marka bulunamadı: {id}" },
  "b.exists": { en: "This brand id already exists", tr: "Bu marka kimliği zaten var" },
  "b.pending": { en: "The brand has pending posts; cancel them first", tr: "Markanın bekleyen gönderileri var; önce iptal edin" },
  "b.history": {
    en: "The brand has post history and cannot be deleted (records are kept); you can remove its account connections individually",
    tr: "Markanın geçmiş gönderileri olduğu için silinemez (kayıtlar korunur); hesap bağlantılarını ayrı ayrı kaldırabilirsiniz",
  },

  // connections
  "c.no_key": { en: "ENCRYPTION_KEY is not set", tr: "ENCRYPTION_KEY tanımlı değil" },
  "c.not_connected": { en: "{platform} is not connected for brand {brand}; connect it in the dashboard", tr: "{brand} markasında {platform} hesabı bağlı değil; panelden bağlayın" },
  "c.app_keys": { en: "{platform} app keys are not configured", tr: "{platform} uygulama anahtarları tanımlı değil" },
  "c.state": { en: "Connection request is invalid or expired, please try again", tr: "Bağlantı isteği geçersiz ya da süresi doldu, tekrar deneyin" },
  "c.denied": { en: "{platform} connection was declined", tr: "{platform} bağlantısı reddedildi" },
  "c.no_brand": { en: "No brand selected", tr: "Marka seçilmedi" },

  // platform steps (used as @step.* parameters)
  "step.token_exchange": { en: "token exchange", tr: "token alma" },
  "step.token_refresh": { en: "token refresh", tr: "token yenileme" },
  "step.long_lived": { en: "long-lived token", tr: "uzun ömürlü token" },
  "step.account_info": { en: "account info", tr: "hesap bilgisi" },
  "step.upload_init": { en: "upload init", tr: "yükleme başlatma" },
  "step.upload": { en: "video upload", tr: "video yükleme" },
  "step.status": { en: "status check", tr: "durum sorgu" },
  "step.container": { en: "container creation", tr: "container oluşturma" },
  "step.publish": { en: "publishing", tr: "yayınlama" },

  // platform errors
  "pf.http": { en: "{platform} {step} failed (HTTP {status}) {detail}", tr: "{platform} {step} başarısız (HTTP {status}) {detail}" },
  "pf.google_test_mode": {
    en: "{base} — reconnect in the dashboard (apps in Google 'Testing' mode expire tokens after 7 days)",
    tr: "{base} — bağlantıyı panelden yeniden kurun (Google test modundaki uygulamalarda token 7 günde biter)",
  },
  "pf.no_refresh": { en: "Google did not return a refresh token; remove the app's access in your Google account and reconnect", tr: "Google refresh token vermedi; Google hesabınızdan uygulama erişimini kaldırıp tekrar bağlayın" },
  "pf.scope": { en: "The {scope} permission was not granted", tr: "{scope} izni verilmedi" },
  "pf.yt_upload_url": { en: "Could not get a YouTube upload URL", tr: "YouTube yükleme adresi alınamadı" },
  "pf.yt_rejected": { en: "YouTube rejected the video: {reason}", tr: "YouTube videoyu reddetti: {reason}" },
  "pf.no_poll": { en: "This platform has no processing step", tr: "Bu platform için bekleme adımı yok" },
  "pf.ig_failed": { en: "Instagram could not process the video: {status}", tr: "Instagram videoyu işleyemedi: {status}" },
  "pf.ig_timeout": { en: "Instagram processing timed out", tr: "Instagram işleme zaman aşımı" },
  "pf.ig_no_id": { en: "Instagram did not return a media id", tr: "Instagram yayın kimliği dönmedi" },
  "pf.tt_api": { en: "TikTok {step}: {code} {message}", tr: "TikTok {step}: {code} {message}" },
  "pf.tt_unaudited": {
    en: "{base} — until the app passes TikTok's audit only SELF_ONLY posts are allowed (TIKTOK_UNAUDITED=true)",
    tr: "{base} — uygulama TikTok denetiminden geçene kadar sadece SELF_ONLY paylaşılabilir (TIKTOK_UNAUDITED=true)",
  },
  "pf.tt_privacy": { en: "TikTok does not allow privacy level {privacy} (allowed: {allowed})", tr: "TikTok bu gizlilik seçeneğine izin vermiyor: {privacy} (izinli: {allowed})" },
  "pf.tt_too_big": { en: "Videos larger than 64 MB are not supported for TikTok", tr: "TikTok için 64 MB'tan büyük videolar desteklenmiyor" },
  "pf.tt_upload_url": { en: "Invalid TikTok upload URL", tr: "TikTok yükleme adresi geçersiz" },
  "pf.tt_failed": { en: "TikTok publishing failed: {reason}", tr: "TikTok yayını başarısız: {reason}" },
  "pf.tt_timeout": { en: "TikTok processing timed out", tr: "TikTok işleme zaman aşımı" },
  "pf.tt_token": { en: "TikTok token: {error} — reconnect in the dashboard", tr: "TikTok token: {error} — bağlantıyı panelden yeniden kurun" },
  "pf.note_private": {
    en: "Posted as 'only me' because the TikTok app is not audited yet",
    tr: "TikTok uygulaması henüz denetlenmediği için video 'sadece ben' olarak paylaşıldı",
  },

  // login
  "login.limited": { en: "Too many failed attempts. Try again in 15 minutes.", tr: "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin." },
  "login.invalid": { en: "Wrong password or code.", tr: "Parola ya da kod hatalı." },
  "login.not_configured": { en: "Setup is not complete.", tr: "Kurulum tamamlanmamış." },
  "oauth.error": { en: "Authorization error", tr: "Yetkilendirme hatası" },
  "oauth.unverified": { en: "The app could not be verified.", tr: "Uygulama doğrulanamadı." },
} satisfies Dict;

export type MsgKey = keyof typeof MESSAGES;

/** Serialized, language-independent message. Params may contain nested messages. */
export interface Msg {
  k: string;
  p?: Params;
}

export class AppError extends Error {
  constructor(public key: MsgKey, public params: Params = {}) {
    super(format("en", key, params));
  }
  toMsg(): Msg {
    return { k: this.key, p: serializeParams(this.params) };
  }
}

function serializeParams(p: Params): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(p)) out[k] = v instanceof AppError ? v.toMsg() : v;
  return out;
}

function isMsg(v: unknown): v is Msg {
  return typeof v === "object" && v !== null && typeof (v as Msg).k === "string";
}

export function format(lang: Lang, key: string, params: Params = {}): string {
  const entry = (MESSAGES as Dict)[key];
  if (!entry) return key;
  return entry[lang].replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined || v === null) return "";
    if (v instanceof AppError) return format(lang, v.key, v.params);
    if (isMsg(v)) return format(lang, v.k, v.p);
    if (typeof v === "string" && v.startsWith("@")) return format(lang, v.slice(1));
    return String(v);
  }).trim();
}

/** Converts any thrown value to a language-independent message. */
export function toMsg(e: unknown): Msg {
  if (e instanceof AppError) return e.toMsg();
  return { k: "err.raw", p: { text: String((e as Error)?.message ?? e).slice(0, 500) } };
}

/** Renders any thrown value in the given language. */
export function localize(e: unknown, lang: Lang): string {
  const m = toMsg(e);
  return format(lang, m.k, m.p);
}

/** Renders a message stored in the database (JSON or plain text). */
export function renderStored(stored: string | null, lang: Lang): string | null {
  if (!stored) return null;
  if (stored.startsWith("{")) {
    try {
      const m = JSON.parse(stored) as Msg;
      if (isMsg(m)) return format(lang, m.k, m.p);
    } catch {
      /* fall through */
    }
  }
  return stored;
}

export function storeMsg(e: unknown): string {
  return JSON.stringify(toMsg(e)).slice(0, 2000);
}

export function parseLang(v: string | null | undefined): Lang | null {
  return v === "en" || v === "tr" ? v : null;
}

/** Language for a browser request: ?lang= → cookie → Accept-Language → fallback. */
export function langFromRequest(req: Request, fallback: Lang = "en"): Lang {
  const url = new URL(req.url);
  const q = parseLang(url.searchParams.get("lang"));
  if (q) return q;
  const cookie = /(?:^|;\s*)lang=(en|tr)/.exec(req.headers.get("Cookie") || "");
  if (cookie) return cookie[1] as Lang;
  const al = (req.headers.get("Accept-Language") || "").toLowerCase();
  if (al.startsWith("tr")) return "tr";
  if (al.startsWith("en")) return "en";
  return fallback;
}
