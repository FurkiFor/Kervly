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

  // accounts
  "err.forbidden": { en: "You don't have access to this", tr: "Buna erişiminiz yok" },
  "u.email_invalid": { en: "Enter a valid email address", tr: "Geçerli bir e-posta adresi girin" },
  "u.password_short": { en: "The password must be at least {min} characters", tr: "Parola en az {min} karakter olmalı" },
  "u.registration_closed": { en: "Registration is closed on this instance", tr: "Bu kurulumda kayıt kapalı" },
  "u.password_env": { en: "This account's password is managed in the server configuration", tr: "Bu hesabın parolası sunucu ayarlarında yönetiliyor" },
  "u.password_wrong": { en: "The current password is wrong", tr: "Mevcut parola hatalı" },
  "u.not_found": { en: "User not found", tr: "Kullanıcı bulunamadı" },
  "u.not_pending": { en: "Only accounts that confirmed their email can be approved", tr: "Sadece e-postasını doğrulamış hesaplar onaylanabilir" },
  "u.cannot_change_admin": { en: "The superadmin cannot be changed here", tr: "Süper admin buradan değiştirilemez" },
  "u.totp_invalid": { en: "That code is not valid. Check your authenticator's time and try again.", tr: "Kod geçersiz. Doğrulama uygulamanızın saatini kontrol edip tekrar deneyin." },
  "u.totp_required_admin": { en: "The superadmin's 2FA is managed in the server configuration", tr: "Süper adminin 2FA'sı sunucu ayarlarında yönetiliyor" },
  "b.limit_brands": { en: "You can have at most {max} brands", tr: "En fazla {max} markanız olabilir" },
  // storage
  "s.repo_invalid": { en: "Repository must look like owner/name", tr: "Repo owner/ad biçiminde olmalı" },
  "s.branch_invalid": { en: "Invalid branch name", tr: "Geçersiz dal adı" },
  "s.path_invalid": { en: "Invalid folder path (letters, digits, - _ . /)", tr: "Geçersiz klasör yolu (harf, rakam, - _ . /)" },
  "s.token_required": { en: "A GitHub token is required", tr: "GitHub token gerekli" },
  "s.token_invalid": { en: "GitHub rejected the token (HTTP {status}). Check that it has access to {repo}.", tr: "GitHub token'ı reddetti (HTTP {status}). {repo} reposuna erişimi olduğundan emin olun." },
  "s.no_write": { en: "The token can read {repo} but cannot write to it. Give it \"Contents: Read and write\" permission.", tr: "Token {repo} reposunu okuyabiliyor ama yazamıyor. \"Contents: Read and write\" izni verin." },
  "s.not_configured": { en: "This brand has no GitHub storage yet", tr: "Bu markanın henüz GitHub deposu yok" },
  "s.file_name": { en: "File name must end with .mp4 and use only letters, digits, - _ .", tr: "Dosya adı .mp4 ile bitmeli; sadece harf, rakam, - _ . kullanın" },
  "s.file_exists": { en: "A file with this name already exists in the folder", tr: "Klasörde bu adla bir dosya zaten var" },
  "s.too_big": { en: "Uploads are limited to {max} MB", tr: "Yükleme sınırı {max} MB" },
  "s.public_url": { en: "PUBLIC_URL must be set to publish to Instagram from private storage", tr: "Gizli depodan Instagram'a paylaşmak için PUBLIC_URL ayarlanmalı" },
  "s.upload_failed": { en: "Upload to GitHub failed (HTTP {status}) {detail}", tr: "GitHub'a yükleme başarısız (HTTP {status}) {detail}" },
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
  "v.month": { en: "month must look like 2026-10", tr: "month 2026-10 biçiminde olmalı" },
  "v.language": { en: "{key} must be a language code such as en, tr, ar or pt-BR", tr: "{key} en, tr, ar veya pt-BR gibi bir dil kodu olmalı" },
  "yt.stats_scope": { en: "This YouTube connection has no permission to read statistics. Reconnect YouTube in Setup and allow \"View your YouTube account\".", tr: "Bu YouTube bağlantısının istatistik okuma izni yok. Kurulum'da YouTube'u yeniden bağla ve \"YouTube hesabını görüntüle\" iznini ver." },
  "yt.no_channel": { en: "No YouTube channel was found for this connection", tr: "Bu bağlantı için YouTube kanalı bulunamadı" },
  "b.pick": { en: "Choose a brand. Available: {brands}", tr: "Bir marka seç. Mevcut: {brands}" },
  "s.not_mp4": { en: "The file is not an MP4 video", tr: "Dosya bir MP4 video değil" },
  "s.source_invalid": { en: "source_url must be a public https link", tr: "source_url herkese açık bir https bağlantısı olmalı" },
  "s.source_failed": { en: "Could not download the video (HTTP {status})", tr: "Video indirilemedi (HTTP {status})" },
  "s.source_no_length": { en: "The download link does not announce the file size (Content-Length). Use create_upload_link instead.", tr: "İndirme bağlantısı dosya boyutunu (Content-Length) bildirmiyor. Bunun yerine create_upload_link kullan." },
  "s.link_invalid": { en: "This upload link is invalid or expired", tr: "Bu yükleme bağlantısı geçersiz veya süresi dolmuş" },
  "post.no_slot": { en: "No free slot in the next 60 days. Raise the daily limit or add posting times for this brand.", tr: "Önümüzdeki 60 günde boş zaman dilimi yok. Günlük limiti artırın veya markaya paylaşım saati ekleyin." },
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
  "post.cannot_edit": { en: "Only scheduled posts can be edited", tr: "Sadece planlanmış gönderiler düzenlenebilir" },
  "b.times": { en: "Default times must be HH:mm values (at most 10)", tr: "Varsayılan saatler SS:dd biçiminde olmalı (en fazla 10)" },
  "gh.list": { en: "Could not list videos from GitHub (HTTP {status})", tr: "GitHub'dan video listesi alınamadı (HTTP {status})" },
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
    en: "{base} — until your TikTok app passes the audit, the posting TikTok account itself must be set to private (TikTok app → Settings and privacy → Privacy → Private account). Posts are sent as SELF_ONLY.",
    tr: "{base} — TikTok uygulaman denetimden geçene kadar paylaşım yapan TikTok hesabının kendisi gizli olmalı (TikTok uygulaması → Ayarlar ve gizlilik → Gizlilik → Gizli hesap). Gönderiler SELF_ONLY olarak gönderilir.",
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
  "login.pending": { en: "Your account is waiting for approval. You'll get an email when it's ready.", tr: "Hesabınız onay bekliyor. Hazır olunca e-posta alacaksınız." },
  "login.unverified": { en: "Please confirm your email first — check your inbox for the link.", tr: "Önce e-postanızı doğrulayın; gelen kutunuzdaki bağlantıya tıklayın." },
  "login.disabled": { en: "This account is disabled.", tr: "Bu hesap devre dışı." },
  "login.code_required": { en: "Enter the 6-digit code from your authenticator app.", tr: "Doğrulama uygulamanızdaki 6 haneli kodu girin." },
  "u.terms_required": { en: "Please accept the terms and privacy policy", tr: "Lütfen koşulları ve gizlilik politikasını kabul edin" },
  "u.check_inbox_title": { en: "Check your inbox", tr: "Gelen kutunuzu kontrol edin" },
  "u.check_inbox": { en: "If the address can be registered, we've sent a confirmation link to it.", tr: "Adres kaydedilebiliyorsa ona bir doğrulama bağlantısı gönderdik." },
  "u.reset_sent": { en: "If an account exists for this address, we've sent a password reset link.", tr: "Bu adrese ait bir hesap varsa parola sıfırlama bağlantısı gönderdik." },
  "u.link_invalid_title": { en: "Link expired", tr: "Bağlantının süresi doldu" },
  "u.link_invalid": { en: "This link is invalid or has already been used. Please request a new one.", tr: "Bu bağlantı geçersiz ya da zaten kullanılmış. Lütfen yenisini isteyin." },
  "u.verified_title": { en: "Email confirmed", tr: "E-posta doğrulandı" },
  "u.verified_active": { en: "Your account is ready. You can sign in now.", tr: "Hesabınız hazır. Şimdi giriş yapabilirsiniz." },
  "u.verified_pending": { en: "Thanks! Your account is now waiting for approval. We'll email you when it's ready.", tr: "Teşekkürler! Hesabınız şimdi onay bekliyor. Hazır olunca size e-posta göndereceğiz." },
  "u.password_mismatch": { en: "The passwords don't match", tr: "Parolalar aynı değil" },
  "u.reset_done_title": { en: "Password changed", tr: "Parola değiştirildi" },
  "u.reset_done": { en: "Your password has been changed and other sessions were signed out.", tr: "Parolanız değiştirildi ve diğer oturumlar kapatıldı." },
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
