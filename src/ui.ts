import { esc } from "./http";
import type { Lang } from "./i18n";
import { APP_NAME, REPO_URL } from "./config";

/** UI strings. Keys used by the browser script are passed to it as JSON. */
const UI = {
  en: {
    login_title: "Sign in",
    login_hint: "Sign in with your password and the 6-digit code from your authenticator app.",
    password: "Password",
    code: "Authenticator code",
    sign_in: "Sign in",
    continue: "Continue",
    setup_title: "First-time setup",
    setup_missing: "Missing secrets:",
    setup_hint:
      "The values below are generated <b>in this browser only</b> and never sent to the server. Add them as <b>Secret</b> variables in the Cloudflare dashboard: Workers &amp; Pages → your worker → Settings → Variables and Secrets. This page disappears once setup is complete.",
    setup_pw: "Admin password (at least 12 characters)",
    setup_pw2: "Repeat password",
    setup_gen: "Generate values",
    setup_short: "The password must be at least 12 characters.",
    setup_mismatch: "Passwords do not match.",
    setup_wait: "Generating…",
    setup_totp: "Add <b>ADMIN_TOTP_SECRET</b> to your authenticator app (Google Authenticator, Authy, 1Password…) with \"enter a setup key\", or use this URI:",
    setup_warn: "Never share these values or commit them to git. They are gone when you close this page.",
    consent_title: "{name} is requesting access",
    consent_pub: "Publisher: <b>{domain}</b>",
    consent_unverified: "This app registered itself; its name is not verified.",
    consent_redirect: "Access will be sent to: <b>{host}</b>",
    consent_loopback: "<b>Access will go to an app on your computer.</b> Only continue if you just started signing in from it.",
    consent_scope: "Grants: scheduling, listing, cancelling and retrying posts. Platform passwords and tokens are never shared.",
    allow: "Allow",
    deny: "Deny",
    logout: "Sign out",
    accounts: "Accounts",
    mcp_url: "MCP URL (add it to Claude as a custom connector):",
    new_post: "New post",
    video_url: "Video URL (.mp4 from the brand's allowlist)",
    publish_time: "Publish time",
    title_lbl: "Title (YouTube, max 100)",
    caption: "Description",
    tags: "Tags (comma separated)",
    schedule: "Schedule",
    posts: "Posts",
    all_statuses: "All statuses",
    all_platforms: "All platforms",
    th_time: "Time",
    th_platform: "Platform",
    th_content: "Content",
    th_status: "Status",
    th_source: "Source",
    brands: "Brands",
    new_brand: "New brand",
    brand_id: "Id (lowercase letters, digits, dashes)",
    brand_name: "Name",
    brand_prefixes: "Video allowlist (one prefix per line, ending with \"/\"; allowed hosts:",
    brand_limit: "Daily limit per platform",
    brand_tz: "Time zone",
    save: "Save",
    delete_brand: "Delete brand",
    brands_hint: "Each brand has its own YouTube, Instagram and TikTok accounts. The allowlist can only be changed here, never through MCP.",
    activity: "Recent activity",
    privacy: "Privacy",
    terms: "Terms",
    source_code: "Source code",
    // used by the browser script
    s_scheduled: "Scheduled",
    s_publishing: "Uploading",
    s_processing: "Processing",
    s_published: "Live",
    s_error: "Error",
    s_cancelled: "Cancelled",
    connected: "Connected",
    not_connected: "Not connected",
    token: "Token",
    keys_missing: "App keys are not configured (Cloudflare secrets).",
    connect: "Connect",
    reconnect: "Reconnect",
    remove: "Remove",
    cancel: "Cancel",
    retry: "Retry",
    open: "Open",
    no_posts: "No posts",
    no_brands: "No brands yet. Add one below.",
    empty: "empty",
    per_day: "/day",
    edit: "Edit",
    edit_brand: "Edit brand: ",
    confirm_cancel: "Cancel this post?",
    confirm_disconnect: "Remove the {x} connection?",
    confirm_delete_brand: "Delete brand {x}?",
    cancelled: "Cancelled",
    requeued: "Queued again",
    removed: "Removed",
    brand_deleted: "Brand deleted",
    brand_saved: "Brand saved",
    scheduled_n: "{n} post(s) scheduled",
    connected_x: "{x} connected",
    session_over: "Session expired",
    no_brand_opt: "No brands",
  },
  tr: {
    login_title: "Giriş",
    login_hint: "Parolanız ve doğrulama uygulamasındaki 6 haneli kodla giriş yapın.",
    password: "Parola",
    code: "Doğrulama kodu",
    sign_in: "Giriş yap",
    continue: "Devam",
    setup_title: "İlk kurulum",
    setup_missing: "Eksik gizli değerler:",
    setup_hint:
      "Aşağıdaki değerler <b>sadece bu tarayıcıda</b> üretilir; sunucuya gönderilmez. Cloudflare panelinde Workers &amp; Pages → worker'ınız → Settings → Variables and Secrets bölümüne <b>Secret</b> türünde ekleyin. Kurulum bitince bu sayfa kapanır.",
    setup_pw: "Yönetici parolası (en az 12 karakter)",
    setup_pw2: "Parola tekrar",
    setup_gen: "Değerleri üret",
    setup_short: "Parola en az 12 karakter olmalı.",
    setup_mismatch: "Parolalar aynı değil.",
    setup_wait: "Üretiliyor…",
    setup_totp: "Doğrulama uygulamanıza (Google Authenticator, Authy, 1Password…) <b>ADMIN_TOTP_SECRET</b> değerini \"kurulum anahtarı gir\" ile ekleyin ya da bu adresi kullanın:",
    setup_warn: "Bu değerleri kimseyle paylaşmayın, git'e koymayın. Sayfayı kapatınca kaybolurlar.",
    consent_title: "{name} erişim istiyor",
    consent_pub: "Yayıncı: <b>{domain}</b>",
    consent_unverified: "Bu uygulama kendini kaydetti; adı doğrulanmadı.",
    consent_redirect: "Erişim şu adrese gönderilecek: <b>{host}</b>",
    consent_loopback: "<b>Erişim bilgisayarınızdaki bir uygulamaya gidecek.</b> Sadece girişi siz başlattıysanız devam edin.",
    consent_scope: "Verilecek yetki: gönderileri planlama, listeleme, iptal ve yeniden deneme. Platform şifreleri ve tokenları paylaşılmaz.",
    allow: "İzin ver",
    deny: "Reddet",
    logout: "Çıkış",
    accounts: "Hesaplar",
    mcp_url: "MCP adresi (Claude'a özel bağlantı olarak ekleyin):",
    new_post: "Yeni gönderi",
    video_url: "Video adresi (markanın izin listesinden .mp4)",
    publish_time: "Yayın zamanı",
    title_lbl: "Başlık (YouTube, en fazla 100)",
    caption: "Açıklama",
    tags: "Etiketler (virgülle)",
    schedule: "Planla",
    posts: "Gönderiler",
    all_statuses: "Tüm durumlar",
    all_platforms: "Tüm platformlar",
    th_time: "Zaman",
    th_platform: "Platform",
    th_content: "İçerik",
    th_status: "Durum",
    th_source: "Kaynak",
    brands: "Markalar",
    new_brand: "Yeni marka",
    brand_id: "Kimlik (küçük harf, rakam, tire)",
    brand_name: "Ad",
    brand_prefixes: "Video izin listesi (her satıra bir önek, \"/\" ile bitmeli; izinli alan adları:",
    brand_limit: "Platform başına günlük sınır",
    brand_tz: "Saat dilimi",
    save: "Kaydet",
    delete_brand: "Markayı sil",
    brands_hint: "Her markanın kendi YouTube, Instagram ve TikTok hesapları vardır. İzin listesi sadece buradan değişir; MCP değiştiremez.",
    activity: "Son işlemler",
    privacy: "Gizlilik",
    terms: "Koşullar",
    source_code: "Kaynak kod",
    s_scheduled: "Planlandı",
    s_publishing: "Yükleniyor",
    s_processing: "İşleniyor",
    s_published: "Yayında",
    s_error: "Hata",
    s_cancelled: "İptal",
    connected: "Bağlı",
    not_connected: "Bağlı değil",
    token: "Token",
    keys_missing: "Uygulama anahtarları tanımlı değil (Cloudflare secret).",
    connect: "Bağla",
    reconnect: "Yeniden bağla",
    remove: "Kaldır",
    cancel: "İptal",
    retry: "Tekrar",
    open: "Aç",
    no_posts: "Gönderi yok",
    no_brands: "Henüz marka yok. Aşağıdan ekleyin.",
    empty: "boş",
    per_day: "/gün",
    edit: "Düzenle",
    edit_brand: "Markayı düzenle: ",
    confirm_cancel: "Gönderi iptal edilsin mi?",
    confirm_disconnect: "{x} bağlantısı kaldırılsın mı?",
    confirm_delete_brand: "{x} markası silinsin mi?",
    cancelled: "İptal edildi",
    requeued: "Yeniden kuyruğa alındı",
    removed: "Kaldırıldı",
    brand_deleted: "Marka silindi",
    brand_saved: "Marka kaydedildi",
    scheduled_n: "{n} gönderi planlandı",
    connected_x: "{x} bağlandı",
    session_over: "Oturum bitti",
    no_brand_opt: "Marka yok",
  },
} satisfies Record<Lang, Record<string, string>>;

type UiKey = keyof (typeof UI)["en"];
const t = (lang: Lang, k: UiKey, vars: Record<string, string> = {}) =>
  UI[lang][k].replace(/\{(\w+)\}/g, (_, n: string) => vars[n] ?? "");

/** JSON for a <script> block (never lets "</script>" through). */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--fg:#14171f;--muted:#5d6472;--line:#e3e6eb;--accent:#b45309;--accent-fg:#fff;--err:#b42318;--ok:#067647;--warn:#b54708;--chip:#eef1f4}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--fg:#e8eaee;--muted:#9aa3b2;--line:#2a2f3a;--accent:#f59e0b;--accent-fg:#1c1206;--err:#f97066;--ok:#47cd89;--warn:#fdb022;--chip:#222733}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:2}
header h1{font-size:17px;margin:0;letter-spacing:.01em}main{max-width:1100px;margin:0 auto;padding:20px 16px 60px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:18px}
.card h2{font-size:16px;margin:0 0 12px}.muted{color:var(--muted)}.small{font-size:13px}
label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
input,textarea,select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit}
textarea{min-height:90px;resize:vertical}
button,.btn{display:inline-block;padding:9px 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-fg);font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
button.ghost,.btn.ghost{background:transparent;color:var(--fg);border-color:var(--line)}button.danger{background:transparent;color:var(--err);border-color:var(--err)}
button:disabled{opacity:.5;cursor:default}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.row select{width:auto}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--chip);font-size:12px;font-weight:600}
.s-published{color:var(--ok)}.s-error{color:var(--err)}.s-processing,.s-publishing{color:var(--warn)}.s-cancelled{color:var(--muted)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px}
th{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.tablewrap{overflow-x:auto}.err{color:var(--err)}.ok{color:var(--ok)}
.center{max-width:420px;margin:8vh auto;padding:0 16px}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-all}
.checks{display:flex;gap:16px;flex-wrap:wrap}.checks label{display:flex;gap:6px;align-items:center;color:var(--fg);margin:0}.checks input{width:auto}
#toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:10px 16px;border-radius:8px;display:none;max-width:90vw}
.hidden{display:none}.nowrap{white-space:nowrap}.m0{margin:0}.between{justify-content:space-between}.brandsel{width:auto;min-width:160px}
.subform{border-top:1px solid var(--line);margin-top:14px;padding-top:6px}.subform h3{font-size:15px;margin:10px 0 0}
.lang a{color:var(--muted);text-decoration:none;font-size:13px;margin-left:6px}.lang a.on{color:var(--fg);font-weight:700}
.logo{display:inline-flex;align-items:center;gap:8px}.logo b{color:var(--accent)}
@media (max-width:640px){td.hide-sm,th.hide-sm{display:none}header{padding:10px 12px;flex-wrap:wrap}header .row{gap:6px}.brandsel{min-width:120px}}
`;

const LOGO = `<span class="logo" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18"/><path d="M5 17v-3a3 3 0 0 1 3-3h1l2-3h2l1 3h2a3 3 0 0 1 3 3v3"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg></span>`;

function langSwitch(lang: Lang): string {
  return `<span class="lang"><a href="?lang=en" class="${lang === "en" ? "on" : ""}">EN</a><a href="?lang=tr" class="${lang === "tr" ? "on" : ""}">TR</a></span>`;
}

export function layout(lang: Lang, title: string, body: string, nonce: string, script = ""): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)} · ${APP_NAME}</title><style nonce="${nonce}">${CSS}</style></head>
<body>${body}${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;
}

export function loginPage(lang: Lang, nonce: string, next: string, error = ""): string {
  return layout(
    lang,
    t(lang, "login_title"),
    `<div class="center"><div class="card"><div class="row between"><h2 class="m0">${LOGO} ${APP_NAME}</h2>${langSwitch(lang)}</div>
<p class="muted small">${t(lang, "login_hint")}</p>
${error ? `<p class="err">${esc(error)}</p>` : ""}
<form method="post" action="/login">
<input type="hidden" name="next" value="${esc(next)}">
<label for="p">${t(lang, "password")}</label><input id="p" name="password" type="password" autocomplete="current-password" required maxlength="256">
<label for="c">${t(lang, "code")}</label><input id="c" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required maxlength="6">
<p><button type="submit">${t(lang, "sign_in")}</button></p></form></div></div>`,
    nonce,
  );
}

export function messagePage(lang: Lang, nonce: string, title: string, text: string, link = "/"): string {
  return layout(
    lang,
    title,
    `<div class="center"><div class="card"><h2>${esc(title)}</h2><p>${esc(text)}</p><p><a href="${esc(link)}">${t(lang, "continue")}</a></p></div></div>`,
    nonce,
  );
}

/** First-time setup: secrets are generated in the browser, nothing is sent to the server. */
export function setupPage(lang: Lang, nonce: string, missing: string[]): string {
  const T = { short: t(lang, "setup_short"), mismatch: t(lang, "setup_mismatch"), wait: t(lang, "setup_wait") };
  const script = `
const T=${scriptJson(T)};
const $=id=>document.getElementById(id);
const b64=u=>btoa(String.fromCharCode(...u));
const rnd=n=>{const u=new Uint8Array(n);crypto.getRandomValues(u);return u};
const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32(u){let bits=0,v=0,o="";for(const b of u){v=(v<<8)|b;bits+=8;while(bits>=5){o+=B32[(v>>>(bits-5))&31];bits-=5}}if(bits>0)o+=B32[(v<<(5-bits))&31];return o}
$("gen").onclick=async()=>{
 const pw=$("pw").value,pw2=$("pw2").value;
 if(pw.length<12){$("msg").textContent=T.short;return}
 if(pw!==pw2){$("msg").textContent=T.mismatch;return}
 $("msg").textContent=T.wait;
 const salt=rnd(16);const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveBits"]);
 const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:100000},key,256));
 const totp=b32(rnd(20));
 const vals={ADMIN_PASSWORD_HASH:"pbkdf2$100000$"+b64(salt)+"$"+b64(bits),ADMIN_TOTP_SECRET:totp,ENCRYPTION_KEY:b64(rnd(32)),CONSENT_SECRET:b64(rnd(32))};
 const out=$("out");out.textContent="";
 for(const [k,v] of Object.entries(vals)){const l=document.createElement("label");l.textContent=k;const i=document.createElement("input");i.readOnly=true;i.className="mono";i.value=v;out.append(l,i)}
 $("otp").textContent="otpauth://totp/${APP_NAME}:admin?secret="+totp+"&issuer=${APP_NAME}";
 $("res").classList.remove("hidden");$("msg").textContent="";$("pw").value="";$("pw2").value="";
};`;
  return layout(
    lang,
    t(lang, "setup_title"),
    `<main><div class="card"><div class="row between"><h2 class="m0">${LOGO} ${APP_NAME} · ${t(lang, "setup_title")}</h2>${langSwitch(lang)}</div>
<p>${t(lang, "setup_missing")} <code>${missing.map(esc).join(", ")}</code></p>
<p class="muted small">${t(lang, "setup_hint")}</p>
<label for="pw">${t(lang, "setup_pw")}</label><input id="pw" type="password" autocomplete="new-password">
<label for="pw2">${t(lang, "setup_pw2")}</label><input id="pw2" type="password" autocomplete="new-password">
<p><button id="gen" type="button">${t(lang, "setup_gen")}</button> <span id="msg" class="err"></span></p>
<div id="res" class="hidden"><div id="out"></div>
<p class="small">${t(lang, "setup_totp")}</p>
<p class="mono" id="otp"></p>
<p class="small err">${t(lang, "setup_warn")}</p></div>
</div></main>`,
    nonce,
    script,
  );
}

export function consentPage(
  lang: Lang,
  nonce: string,
  d: { clientName: string; clientDomain?: string; redirectHost: string; redirectIsLoopback: boolean; scope: string[] },
  handle: string,
): string {
  return layout(
    lang,
    t(lang, "allow"),
    `<div class="center"><div class="card"><h2>${t(lang, "consent_title", { name: esc(d.clientName) })}</h2>
<p>${d.clientDomain ? t(lang, "consent_pub", { domain: esc(d.clientDomain) }) : t(lang, "consent_unverified")}</p>
<p>${t(lang, "consent_redirect", { host: esc(d.redirectHost) })}</p>
${d.redirectIsLoopback ? `<p class="err">${t(lang, "consent_loopback")}</p>` : ""}
<p class="small muted">${t(lang, "consent_scope")}</p>
<form method="post" action="/authorize"><input type="hidden" name="handle" value="${esc(handle)}">
${d.scope.map((s) => `<input type="hidden" name="scope" value="${esc(s)}">`).join("")}
<div class="row"><button name="decision" value="approve">${t(lang, "allow")}</button><button class="ghost" name="decision" value="deny">${t(lang, "deny")}</button></div></form>
</div></div>`,
    nonce,
  );
}

const LEGAL = {
  en: {
    privacy: `<h2>Privacy Policy</h2>
<p>This ${APP_NAME} instance is used by its operator to publish their own videos to their own YouTube, Instagram and TikTok accounts at scheduled times.</p>
<p><b>Data collected:</b> the access tokens issued by the platforms and the account name. Tokens are encrypted with AES-256-GCM and used only to upload videos. No viewer data, messages or other personal data are collected.</p>
<p><b>Sharing:</b> data is never shared with or sold to third parties.</p>
<p><b>Deletion:</b> a connection can be removed at any time from the dashboard or from the platform's app settings; its tokens are deleted when it is removed.</p>
<p><b>Contact:</b> the operator of this instance.</p>`,
    terms: `<h2>Terms of Service</h2>
<p>${APP_NAME} is a tool that lets the operator publish their own content to their own social media accounts at scheduled times.</p>
<p>The operator is responsible for the content published. Each platform's (YouTube, Instagram, TikTok) own terms apply.</p>
<p>The service is provided as is, without any guarantee of uninterrupted operation.</p>`,
  },
  tr: {
    privacy: `<h2>Gizlilik Politikası</h2>
<p>Bu ${APP_NAME} kurulumu, işletmecisinin kendi videolarını kendi YouTube, Instagram ve TikTok hesaplarına planlı olarak yüklemesi için kullanılır.</p>
<p><b>Toplanan veriler:</b> Platformların verdiği erişim tokenları ve hesap adı. Tokenlar AES-256-GCM ile şifrelenir ve yalnızca video yüklemek için kullanılır. İzleyici verisi, mesaj ya da başka kişisel veri toplanmaz.</p>
<p><b>Paylaşım:</b> Veriler üçüncü taraflarla paylaşılmaz, satılmaz.</p>
<p><b>Silme:</b> Bağlantı panelden ya da platformun uygulama ayarlarından istenildiği an kaldırılabilir; kaldırıldığında tokenlar silinir.</p>
<p><b>İletişim:</b> Bu kurulumun işletmecisi.</p>`,
    terms: `<h2>Kullanım Koşulları</h2>
<p>${APP_NAME}, işletmecinin kendi içeriğini kendi sosyal medya hesaplarında planlı olarak yayınlamasını sağlayan bir araçtır.</p>
<p>Yayınlanan içerikten işletmeci sorumludur. Her platformun (YouTube, Instagram, TikTok) kendi kullanım koşulları geçerlidir.</p>
<p>Hizmet olduğu gibi sunulur; kesintisiz çalışma garantisi verilmez.</p>`,
  },
};

export function legalPage(lang: Lang, nonce: string, kind: "privacy" | "terms"): string {
  return layout(
    lang,
    t(lang, kind),
    `<main><div class="card"><div class="row between"><span>${LOGO} <b>${APP_NAME}</b></span>${langSwitch(lang)}</div>${LEGAL[lang][kind]}</div></main>`,
    nonce,
  );
}

export function dashboardPage(lang: Lang, nonce: string, defaultTz: string): string {
  const T = UI[lang];
  const script = `
const T=${scriptJson(T)};
const tr=(k,v={})=>T[k].replace(/\\{(\\w+)\\}/g,(_,n)=>v[n]??"");
const $=s=>document.querySelector(s);
let CSRF="",BRANDS=[],BRAND="";
const e=s=>String(s??"").replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";");
function toast(t){const x=$("#toast");x.textContent=t;x.style.display="block";clearTimeout(x._t);x._t=setTimeout(()=>x.style.display="none",5000)}
async function api(path,opts={}){
  const r=await fetch(path,{...opts,headers:{"Content-Type":"application/json","X-CSRF-Token":CSRF,...(opts.headers||{})},credentials:"same-origin"});
  if(r.status===401){location.href="/login";throw new Error(T.session_over)}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||("HTTP "+r.status));
  return j;
}
const NAMES={youtube:"YouTube",instagram:"Instagram",tiktok:"TikTok"};
const cur=()=>BRANDS.find(b=>b.id===BRAND);
function remember(){try{localStorage.setItem("brand",BRAND)}catch{}}
async function loadBrands(select){
  const r=await api("/api/brands");BRANDS=r.brands;$("#hosts").textContent=r.hosts;
  let saved="";try{saved=localStorage.getItem("brand")||""}catch{}
  BRAND=select||(BRANDS.some(b=>b.id===BRAND)?BRAND:(BRANDS.some(b=>b.id===saved)?saved:(BRANDS[0]?.id||"")));
  $("#brand").innerHTML=BRANDS.length?BRANDS.map(b=>'<option value="'+e(b.id)+'"'+(b.id===BRAND?" selected":"")+'>'+e(b.name)+'</option>').join(""):'<option value="">'+e(T.no_brand_opt)+'</option>';
  $("#brands").innerHTML=BRANDS.length?BRANDS.map(b=>'<tr><td><b>'+e(b.name)+'</b><div class="small muted mono">'+e(b.id)+'</div></td><td class="small mono">'+b.media_prefixes.map(e).join("<br>")+(b.media_prefixes.length?'':'<span class="err">'+e(T.empty)+'</span>')+'</td><td class="small">'+b.max_posts_per_day+e(T.per_day)+'<br>'+e(b.timezone)+'</td><td><button class="ghost" data-edit="'+e(b.id)+'">'+e(T.edit)+'</button></td></tr>').join(""):'<tr><td class="muted">'+e(T.no_brands)+'</td></tr>';
  document.querySelectorAll(".needs-brand").forEach(x=>x.classList.toggle("hidden",!BRANDS.length));
  remember();
  if(cur()){$("#tzlbl").textContent=cur().timezone;$("#curname").textContent=cur().name}
}
async function loadConns(){
  if(!BRAND)return;
  const {connections}=await api("/api/connections?brand="+encodeURIComponent(BRAND));
  $("#conns").innerHTML=connections.map(c=>'<div class="card m0"><div class="row between"><b>'+NAMES[c.platform]+'</b>'+
   (c.connected?'<span class="chip ok">'+e(T.connected)+'</span>':'<span class="chip">'+e(T.not_connected)+'</span>')+'</div>'+
   (c.connected?'<p class="small muted">'+e(c.account_name)+'<br>'+e(T.token)+': '+(c.token_expires_at?e(new Date(c.token_expires_at).toLocaleString()):"-")+'</p>':'')+
   (!c.configured?'<p class="small err">'+e(T.keys_missing)+'</p>':
     '<div class="row"><a class="btn '+(c.connected?'ghost':'')+'" href="/connect/'+c.platform+'?brand='+encodeURIComponent(BRAND)+'">'+e(c.connected?T.reconnect:T.connect)+'</a>'+
     (c.connected?'<button class="danger" data-disc="'+c.platform+'">'+e(T.remove)+'</button>':'')+'</div>')+'</div>').join("");
}
async function loadPosts(){
  if(!BRAND){$("#posts").innerHTML="";return}
  const q=new URLSearchParams({brand:BRAND});const s=$("#fs").value,p=$("#fp").value;if(s)q.set("status",s);if(p)q.set("platform",p);
  const {posts}=await api("/api/posts?"+q);
  $("#posts").innerHTML=posts.length?posts.map(x=>'<tr><td>'+e(x.publish_at_local)+'</td><td>'+NAMES[x.platform]+'</td><td><div>'+e(x.title||x.caption.slice(0,60))+'</div><div class="small muted mono">'+e(x.media_url.split("/").pop())+'</div>'+
   (x.error?'<div class="small '+(x.status==="error"?"err":"muted")+'">'+e(x.error)+'</div>':'')+'</td><td><span class="chip s-'+x.status+'">'+e(T["s_"+x.status])+'</span>'+
   (x.result_url&&x.result_url.startsWith("https://")?'<div class="small"><a href="'+e(x.result_url)+'" target="_blank" rel="noopener noreferrer">'+e(T.open)+'</a></div>':'')+'</td><td class="hide-sm small muted">'+e(x.source)+'</td><td>'+
   (["scheduled","error"].includes(x.status)?'<button class="ghost" data-cancel="'+x.id+'">'+e(T.cancel)+'</button> ':'')+(x.status==="error"?'<button class="ghost" data-retry="'+x.id+'">'+e(T.retry)+'</button>':'')+'</td></tr>').join(""):'<tr><td colspan="6" class="muted">'+e(T.no_posts)+'</td></tr>';
}
async function loadActivity(){
  const {activity}=await api("/api/activity");
  $("#act").innerHTML=activity.map(a=>'<tr><td class="small nowrap">'+e(a.time)+'</td><td class="small">'+e(a.actor)+'</td><td class="small">'+e(a.action)+'</td><td class="small mono">'+e(a.detail)+'</td></tr>').join("");
}
function editBrand(b){
  const f=$("#bform");f.dataset.mode=b?"edit":"new";f.bid.value=b?.id||"";f.bid.disabled=!!b;f.bname.value=b?.name||"";
  f.prefixes.value=(b?.media_prefixes||[]).join("\\n");f.limit.value=b?.max_posts_per_day||3;f.tz.value=b?.timezone||${scriptJson(defaultTz)};
  $("#bformtitle").textContent=b?T.edit_brand+b.name:T.new_brand;$("#bdel").classList.toggle("hidden",!b);
}
async function refreshAll(){await loadConns();await loadPosts();loadActivity()}
document.addEventListener("click",async ev=>{
  const t=ev.target;if(!(t instanceof HTMLElement))return;
  try{
    if(t.dataset.cancel){if(!confirm(T.confirm_cancel))return;await api("/api/posts/"+t.dataset.cancel+"/cancel",{method:"POST"});toast(T.cancelled);loadPosts()}
    if(t.dataset.retry){await api("/api/posts/"+t.dataset.retry+"/retry",{method:"POST"});toast(T.requeued);loadPosts()}
    if(t.dataset.disc){if(!confirm(tr("confirm_disconnect",{x:cur().name+" / "+NAMES[t.dataset.disc]})))return;await api("/api/connections/"+encodeURIComponent(BRAND)+"/"+t.dataset.disc+"/delete",{method:"POST"});toast(T.removed);loadConns()}
    if(t.dataset.edit){editBrand(BRANDS.find(b=>b.id===t.dataset.edit));$("#bform").scrollIntoView({behavior:"smooth",block:"center"})}
    if(t.id==="bnew")editBrand(null);
    if(t.id==="bdel"){const id=$("#bform").bid.value;if(!confirm(tr("confirm_delete_brand",{x:id})))return;await api("/api/brands/"+encodeURIComponent(id)+"/delete",{method:"POST"});toast(T.brand_deleted);editBrand(null);await loadBrands();refreshAll()}
  }catch(err){toast(err.message)}
});
$("#bform").addEventListener("submit",async ev=>{
  ev.preventDefault();const f=ev.target;
  const body={name:f.bname.value,media_prefixes:f.prefixes.value.split("\\n").map(x=>x.trim()).filter(Boolean),max_posts_per_day:Number(f.limit.value),timezone:f.tz.value.trim()};
  try{
    let b;
    if(f.dataset.mode==="edit")b=await api("/api/brands/"+encodeURIComponent(f.bid.value),{method:"POST",body:JSON.stringify(body)});
    else b=await api("/api/brands",{method:"POST",body:JSON.stringify({id:f.bid.value.trim(),...body})});
    toast(T.brand_saved);await loadBrands(b.id);editBrand(cur());refreshAll();
  }catch(err){toast(err.message)}
});
$("#form").addEventListener("submit",async ev=>{
  ev.preventDefault();const f=ev.target;const btn=f.querySelector("button[type=submit]");btn.disabled=true;
  try{
    const platforms=[...f.querySelectorAll("input[name=pf]:checked")].map(x=>x.value);
    const body={brand:BRAND,platforms,media_url:f.media_url.value.trim(),title:f.title.value,caption:f.caption.value,
      tags:f.tags.value.split(",").map(s=>s.trim()).filter(Boolean),publish_at_local:f.when.value};
    const r=await api("/api/posts",{method:"POST",body:JSON.stringify(body)});
    toast(tr("scheduled_n",{n:r.created.length})+(r.errors.length?" · "+r.errors.map(x=>x.platform+": "+x.error).join("; "):""));
    loadPosts();
  }catch(err){toast(err.message)}finally{btn.disabled=false}
});
$("#brand").onchange=async ev=>{BRAND=ev.target.value;remember();await loadBrands(BRAND);refreshAll()};
$("#fs").onchange=loadPosts;$("#fp").onchange=loadPosts;
$("#logout").onclick=async()=>{await fetch("/logout",{method:"POST",headers:{"X-CSRF-Token":CSRF}});location.href="/login"};
(async()=>{const me=await api("/api/me");CSRF=me.csrf;$("#mcpurl").textContent=location.origin+"/mcp";
 const p=new URLSearchParams(location.search);
 await loadBrands(p.get("brand")||undefined);editBrand(null);
 if(p.get("connected"))toast(tr("connected_x",{x:NAMES[p.get("connected")]||""}));if(p.get("error"))toast(p.get("error"));
 history.replaceState(null,"","/");refreshAll();})().catch(err=>toast(err.message));
`;
  const L = (k: UiKey) => t(lang, k);
  return layout(
    lang,
    L("posts"),
    `<header><h1>${LOGO} ${APP_NAME}</h1><div class="row"><select id="brand" aria-label="Brand" class="brandsel"></select>${langSwitch(lang)}<button class="ghost" id="logout">${L("logout")}</button></div></header><main>
<div class="card needs-brand"><h2>${L("accounts")} · <span id="curname"></span></h2><div class="grid" id="conns"></div>
<p class="small muted">${L("mcp_url")} <code id="mcpurl"></code></p></div>
<div class="card needs-brand"><h2>${L("new_post")}</h2><form id="form">
<div class="checks"><label><input type="checkbox" name="pf" value="youtube" checked> YouTube</label><label><input type="checkbox" name="pf" value="instagram"> Instagram</label><label><input type="checkbox" name="pf" value="tiktok"> TikTok</label></div>
<div class="grid"><div><label for="mu">${L("video_url")}</label><input id="mu" name="media_url" required placeholder="https://raw.githubusercontent.com/owner/repo/main/videos/clip.mp4"></div>
<div><label for="wh">${L("publish_time")} (<span id="tzlbl">${esc(defaultTz)}</span>)</label><input id="wh" name="when" type="datetime-local" required></div></div>
<label for="ti">${L("title_lbl")}</label><input id="ti" name="title" maxlength="100">
<label for="ca">${L("caption")}</label><textarea id="ca" name="caption" maxlength="2200"></textarea>
<label for="tg">${L("tags")}</label><input id="tg" name="tags">
<p><button type="submit">${L("schedule")}</button></p></form></div>
<div class="card needs-brand"><div class="row between"><h2>${L("posts")}</h2><div class="row">
<select id="fs"><option value="">${L("all_statuses")}</option>${["scheduled", "processing", "published", "error", "cancelled"].map((s) => `<option value="${s}">${t(lang, ("s_" + s) as UiKey)}</option>`).join("")}</select>
<select id="fp"><option value="">${L("all_platforms")}</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></div></div>
<div class="tablewrap"><table><thead><tr><th>${L("th_time")}</th><th>${L("th_platform")}</th><th>${L("th_content")}</th><th>${L("th_status")}</th><th class="hide-sm">${L("th_source")}</th><th></th></tr></thead><tbody id="posts"></tbody></table></div></div>
<div class="card"><div class="row between"><h2>${L("brands")}</h2><button class="ghost" id="bnew" type="button">${L("new_brand")}</button></div>
<div class="tablewrap"><table><tbody id="brands"></tbody></table></div>
<form id="bform" class="subform"><h3 id="bformtitle">${L("new_brand")}</h3>
<div class="grid"><div><label for="bid">${L("brand_id")}</label><input id="bid" name="bid" required pattern="[a-z0-9][a-z0-9-]{1,31}" placeholder="mybrand"></div>
<div><label for="bname">${L("brand_name")}</label><input id="bname" name="bname" required maxlength="60"></div></div>
<label for="prefixes">${L("brand_prefixes")} <span id="hosts" class="mono"></span>)</label>
<textarea id="prefixes" name="prefixes" class="mono" placeholder="https://raw.githubusercontent.com/owner/repo/main/videos/"></textarea>
<div class="grid"><div><label for="limit">${L("brand_limit")}</label><input id="limit" name="limit" type="number" min="1" max="10" value="3"></div>
<div><label for="tz">${L("brand_tz")}</label><input id="tz" name="tz" value="${esc(defaultTz)}"></div></div>
<p class="row"><button type="submit">${L("save")}</button><button class="danger hidden" id="bdel" type="button">${L("delete_brand")}</button></p></form>
<p class="small muted">${L("brands_hint")}</p></div>
<div class="card"><h2>${L("activity")}</h2><div class="tablewrap"><table><tbody id="act"></tbody></table></div></div>
<p class="small muted"><a href="/privacy">${L("privacy")}</a> · <a href="/terms">${L("terms")}</a> · <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${L("source_code")}</a></p>
</main><div id="toast" role="status"></div>`,
    nonce,
    script,
  );
}
