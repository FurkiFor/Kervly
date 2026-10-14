import { esc } from "./http";
import type { Lang } from "./i18n";
import type { Actor } from "./env";
import { APP_NAME, APP_VERSION, REPO_URL } from "./config";
import CSS from "./client/app.css.txt";
import DASHBOARD_JS from "./client/dashboard.js.txt";

/** UI strings (server-rendered pages + the dashboard script, which receives them as JSON). */
const UI = {
  en: {
    // auth / setup / consent
    email: "Email",
    forgot: "Forgot password?",
    no_account: "New here?",
    create_account: "Create account",
    have_account: "Already have an account?",
    signup_title: "Create your account",
    signup_hint: "Schedule videos to YouTube, Instagram and TikTok from one place. We'll email you a link to confirm your address and set your password.",
    password_rule: "At least 10 characters.",
    accept_terms: "I accept the {terms} and the {privacy}.",
    forgot_title: "Reset your password",
    forgot_hint: "Enter your email and we'll send you a reset link.",
    send_link: "Send link",
    back_to_login: "Back to sign in",
    reset_title: "Choose a new password",
    new_password: "New password",
    verify_title: "Choose your password",
    verify_hint: "Your email is confirmed once you set a password.",
    signed_in_as: "Signed in as {email}",
    superadmin: "Superadmin",
    nav_account: "Account",
    nav_admin: "Admin",
    upload_video: "Upload",
    uploading: "Uploading {name}… {p}%",
    uploaded: "Uploaded {name}",
    no_storage_upload: "Connect GitHub storage to this brand to upload videos.",
    storage_title: "GitHub storage",
    storage_intro: "Kervly keeps this brand's videos in a folder of a GitHub repository. Uploads are committed there and published from there. Private repositories work too.",
    s_repo: "Repository",
    s_branch: "Branch",
    s_path: "Folder",
    s_token: "Access token",
    s_token_hint: "Fine-grained token with Contents: Read and write on this repository only. Stored encrypted; never shown again.",
    s_token_keep: "A token is saved. Leave empty to keep it.",
    s_howto: "How to create a token",
    s_step1: "GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.",
    s_step2: "Repository access: Only select repositories → choose this repository.",
    s_step3: "Permissions → Repository → Contents: Read and write. Nothing else.",
    s_step4: "Generate, copy the token and paste it here.",
    s_create_token: "Create a token on GitHub",
    s_verify_save: "Verify & save",
    storage: "Storage",
    storage_none: "No storage yet",
    storage_set: "Configure storage",
    storage_private: "private",
    storage_public: "public",
    storage_saved: "Storage verified and saved",
    // account
    account: "Account",
    account_sub: "Your sign-in and security settings.",
    change_password: "Change password",
    current_password: "Current password",
    password_changed: "Password changed. Please sign in again.",
    twofa: "Two-factor authentication",
    twofa_on: "On",
    twofa_off: "Off",
    twofa_hint: "Protect your account with a code from an authenticator app.",
    twofa_enable: "Enable 2FA",
    twofa_disable: "Disable 2FA",
    twofa_scan: "Add this key to your authenticator app, then enter the 6-digit code:",
    twofa_enabled: "Two-factor authentication is on",
    twofa_disabled: "Two-factor authentication is off",
    twofa_managed: "The superadmin's password and 2FA are managed in the server configuration.",
    verify: "Verify",
    // admin
    admin: "Administration",
    admin_sub: "Users, approvals and every brand on this instance.",
    users: "Users",
    th_email: "Email",
    th_status: "Status",
    th_brands: "Brands",
    th_joined: "Joined",
    th_last: "Last sign-in",
    approve: "Approve",
    disable: "Disable",
    enable: "Enable",
    u_unverified: "Unverified",
    u_pending: "Waiting",
    u_active: "Active",
    u_disabled: "Disabled",
    registration: "Registration",
    reg_closed: "Closed",
    reg_approval: "With approval",
    reg_open: "Open",
    email_off: "Email sending is not configured — verification emails are only logged.",
    all_brands: "All brands",
    owner: "Owner",
    st_users: "Users",
    st_pending: "Waiting approval",
    st_brands: "Brands",
    st_scheduled: "Scheduled posts",
    done: "Done",
    login_title: "Sign in",
    login_hint: "Sign in with your email and password. Add the 6-digit code if you use two-factor authentication.",
    password: "Password",
    code: "2FA code (if enabled)",
    sign_in: "Sign in",
    continue: "Continue",
    setup_title: "First-time setup",
    setup_missing: "Missing secrets:",
    setup_hint:
      "These values are generated <b>in this browser only</b> and never sent to the server. Add each of them as a <b>Secret</b> in the Cloudflare dashboard: Workers &amp; Pages → your worker → Settings → Variables and Secrets. This page disappears once setup is complete.",
    setup_pw: "Admin password (at least 12 characters)",
    setup_pw2: "Repeat password",
    setup_gen: "Generate values",
    setup_short: "The password must be at least 12 characters.",
    setup_mismatch: "Passwords do not match.",
    setup_wait: "Generating…",
    setup_totp: "Add <b>ADMIN_TOTP_SECRET</b> to your authenticator app (Google Authenticator, Authy, 1Password…) with \"enter a setup key\", or use this URI:",
    setup_warn: "Never share these values or paste them into chats or git. They are gone when you close this page.",
    consent_title: "{name} wants to connect",
    consent_pub: "Publisher: <b>{domain}</b>",
    consent_unverified: "This app registered itself; its name is not verified.",
    consent_redirect: "Access will be sent to <b>{host}</b>",
    consent_loopback: "<b>Access will go to an app on your computer.</b> Only continue if you just started signing in from it.",
    consent_scope: "It will be able to list brands and schedule, edit, cancel and retry posts. It never sees your passwords or platform tokens.",
    allow: "Allow",
    deny: "Deny",
    privacy: "Privacy",
    terms: "Terms",
    source_code: "Source code",
    // shell
    nav_overview: "Overview",
    nav_posts: "Posts",
    nav_brands: "Brands",
    nav_setup: "Setup",
    nav_activity: "Activity",
    nav_calendar: "Calendar",
    nav_analytics: "Analytics",
    calendar: "Calendar",
    cal_sub: "Everything queued for {brand}. Posts are published automatically at their time. Click a day to see or add posts.",
    cal_today: "Today",
    cal_add: "Add post",
    cal_none: "No posts on this day.",
    cal_full: "Daily limit reached",
    cal_slots: "{n} free",
    cal_more: "+{n} more",
    wd0: "Mon",
    wd1: "Tue",
    wd2: "Wed",
    wd3: "Thu",
    wd4: "Fri",
    wd5: "Sat",
    wd6: "Sun",
    analytics: "Analytics",
    an_sub: "Publishing results for {brand}, based on Kervly's own queue (platform view counts are not included).",
    an_range: "Last {n} days",
    an_published: "Published",
    an_failed: "Failed",
    an_success: "Success rate",
    an_upcoming: "Upcoming",
    an_streak: "Day streak",
    an_avg: "Per active day",
    an_daily: "Posts per day",
    an_platforms: "By platform",
    an_hours: "Publishing hours",
    an_source: "Where posts came from",
    an_src_ui: "Dashboard",
    an_src_mcp: "MCP / Claude",
    an_errors: "Most frequent errors",
    an_no_errors: "No errors in this period.",
    an_no_data: "Nothing published in this period yet.",
    an_times: "{n}×",
    logout: "Sign out",
    brand: "Brand",
    // dashboard
    session_over: "Session expired",
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    never: "never",
    copy: "Copy",
    copied: "Copied",
    confirm: "Confirm",
    close: "Close",
    no_brand_opt: "No brands",
    welcome_title: "Welcome to Kervly",
    welcome_sub: "Start by creating a brand: it holds your accounts, video folder and posting times.",
    no_brands: "No brands yet.",
    new_brand: "New brand",
    new_post: "New post",
    edit_post: "Edit post",
    st_today: "Today",
    st_upcoming: "Upcoming",
    st_published: "Published (7 days)",
    st_errors: "Errors",
    hello: "{brand}",
    sched_ok: "Scheduler running · last run {t}",
    sched_late: "Scheduler hasn't run recently · last run {t}",
    sched_never: "Scheduler hasn't run yet (it starts within 5 minutes of deploying)",
    next_posts: "Next posts",
    no_upcoming: "Nothing scheduled.",
    needs_attention: "Needs attention",
    see_all: "See all",
    checklist: "Setup checklist",
    ck_login: "Admin account with 2FA",
    ck_allowlist: "Connect GitHub storage (or a video folder) for this brand",
    ck_keys: "Add {p} app keys",
    ck_connect: "Connect {p}",
    ck_mcp: "Connect your AI agent (MCP)",
    go: "Go",
    edit: "Edit",
    duplicate: "Duplicate",
    retry: "Retry",
    cancel: "Cancel",
    cancel_post: "Cancel post",
    open: "Open",
    upcoming: "Upcoming",
    past: "Past",
    all: "All",
    all_statuses: "All statuses",
    all_platforms: "All platforms",
    s_scheduled: "Scheduled",
    s_publishing: "Uploading",
    s_processing: "Processing",
    s_published: "Live",
    s_error: "Error",
    s_cancelled: "Cancelled",
    posts: "Posts",
    tz_note: "Times shown in {tz}",
    no_posts: "No posts here.",
    saved: "Saved",
    pick_platform: "Pick at least one platform",
    scheduled_n: "{n} post(s) scheduled",
    brands: "Brands",
    brands_hint: "Each brand has its own accounts, video folder, daily limit and time zone.",
    connected: "Connected",
    not_connected: "Not connected",
    brand_line: "Up to {n} posts per platform per day · {tz}",
    allowlist: "Video folders (allowlist)",
    allowlist_empty: "No folder yet — nothing can be posted",
    edit_brand: "Edit",
    brand_saved: "Brand saved",
    keys_missing_short: "App keys missing",
    ready_to_connect: "Ready to connect",
    reconnect: "Reconnect",
    connect: "Connect",
    remove: "Remove",
    tt_unaudited: "Until TikTok approves your app's audit, videos are posted as \"only me\".",
    redirect_uri: "Redirect URI (paste this into the developer console)",
    secrets_needed: "Cloudflare secrets:",
    open_console: "Developer console",
    setup: "Setup",
    setup_sub: "Everything you need for the platform applications, in one place.",
    mcp_title: "AI agent (MCP)",
    mcp_sub: "Add this URL as a custom connector in Claude or any MCP client that supports OAuth.",
    mcp_s1: "Claude → Settings → Connectors → Add custom connector, paste the URL.",
    mcp_s2: "Click Connect and sign in here with your password and 2FA code.",
    mcp_s3: "Click Allow. Your agent can now list brands and schedule posts.",
    legal_urls: "Privacy policy & terms",
    legal_sub: "Platform app forms ask for these public pages.",
    website: "Website",
    scheduler: "Scheduler",
    scheduler_sub: "Runs every 5 minutes: uploads due posts, tracks processing and refreshes tokens.",
    docs_hint: "Step-by-step instructions for each platform:",
    docs_link: "Self-hosting guide",
    activity: "Activity",
    activity_sub: "Sign-ins, changes and every publishing step.",
    th_time: "Time",
    th_actor: "By",
    th_action: "Action",
    th_detail: "Detail",
    no_activity: "No activity yet.",
    confirm_cancel: "Cancel this post? It won't be published.",
    cancelled: "Post cancelled",
    requeued: "Queued again",
    confirm_disconnect: "Remove the {x} connection? Scheduled posts for it will fail until you reconnect.",
    removed: "Removed",
    confirm_delete_brand: "Delete brand {x}?",
    delete_brand: "Delete brand",
    brand_deleted: "Brand deleted",
    connected_x: "{x} connected",
    // post dialog
    f_platforms: "Platforms",
    f_video: "Video URL",
    f_video_hint: "An .mp4 inside one of the brand's video folders.",
    f_from_folder: "From the brand's folder",
    f_date: "Date",
    f_time: "Time",
    f_title: "Title",
    f_title_note: "The title is used by YouTube; other platforms use the description.",
    f_caption: "Description",
    f_tags: "Tags",
    f_tags_hint: "Comma separated (YouTube)",
    f_advanced: "Platform options",
    f_yt_privacy: "YouTube visibility",
    f_public: "Public",
    f_unlisted: "Unlisted",
    f_private: "Private",
    f_yt_category: "YouTube category",
    f_kids: "Made for kids",
    f_ig_feed: "Also show the Reel in the Instagram feed",
    f_tt_comments: "Allow comments on TikTok",
    save: "Save",
    schedule: "Schedule",
    // brand dialog
    b_id: "Id",
    b_id_hint: "Lowercase letters, digits and dashes. Cannot be changed later.",
    b_name: "Name",
    b_prefixes: "Video folders (one per line, ending with /)",
    b_hosts: "Allowed hosts:",
    b_limit: "Daily limit per platform",
    b_tz: "Time zone",
    b_times: "Default posting times",
    b_times_hint: "e.g. 10:00, 15:00, 18:00 — shown as one-click shortcuts.",
  },
  tr: {
    email: "E-posta",
    forgot: "Parolamı unuttum",
    no_account: "Hesabınız yok mu?",
    create_account: "Hesap oluştur",
    have_account: "Zaten hesabınız var mı?",
    signup_title: "Hesabınızı oluşturun",
    signup_hint: "YouTube, Instagram ve TikTok'a videolarınızı tek yerden planlayın. Adresinizi doğrulamanız ve parolanızı belirlemeniz için size bir bağlantı göndereceğiz.",
    password_rule: "En az 10 karakter.",
    accept_terms: "{terms} ve {privacy} metinlerini kabul ediyorum.",
    forgot_title: "Parolanızı sıfırlayın",
    forgot_hint: "E-posta adresinizi girin; size bir sıfırlama bağlantısı gönderelim.",
    send_link: "Bağlantı gönder",
    back_to_login: "Girişe dön",
    reset_title: "Yeni parola belirleyin",
    new_password: "Yeni parola",
    verify_title: "Parolanızı belirleyin",
    verify_hint: "Parolanızı belirlediğinizde e-postanız doğrulanmış olur.",
    signed_in_as: "{email} olarak giriş yapıldı",
    superadmin: "Süper admin",
    nav_account: "Hesap",
    nav_admin: "Yönetim",
    upload_video: "Yükle",
    uploading: "{name} yükleniyor… %{p}",
    uploaded: "{name} yüklendi",
    no_storage_upload: "Video yüklemek için bu markaya GitHub deposu bağlayın.",
    storage_title: "GitHub deposu",
    storage_intro: "Kervly bu markanın videolarını bir GitHub reposundaki klasörde tutar. Yüklemeler oraya commit'lenir ve yayın oradan yapılır. Gizli repolar da çalışır.",
    s_repo: "Repo",
    s_branch: "Dal",
    s_path: "Klasör",
    s_token: "Erişim token'ı",
    s_token_hint: "Sadece bu repoya Contents: Read and write izni olan fine-grained token. Şifreli saklanır, bir daha gösterilmez.",
    s_token_keep: "Kayıtlı bir token var. Değiştirmeyecekseniz boş bırakın.",
    s_howto: "Token nasıl oluşturulur?",
    s_step1: "GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.",
    s_step2: "Repository access: Only select repositories → bu repoyu seçin.",
    s_step3: "Permissions → Repository → Contents: Read and write. Başka izin vermeyin.",
    s_step4: "Generate'e basın, token'ı kopyalayıp buraya yapıştırın.",
    s_create_token: "GitHub'da token oluştur",
    s_verify_save: "Doğrula ve kaydet",
    storage: "Depo",
    storage_none: "Henüz depo yok",
    storage_set: "Depoyu ayarla",
    storage_private: "gizli",
    storage_public: "herkese açık",
    storage_saved: "Depo doğrulandı ve kaydedildi",
    account: "Hesap",
    account_sub: "Giriş ve güvenlik ayarlarınız.",
    change_password: "Parolayı değiştir",
    current_password: "Mevcut parola",
    password_changed: "Parola değişti. Lütfen yeniden giriş yapın.",
    twofa: "İki adımlı doğrulama",
    twofa_on: "Açık",
    twofa_off: "Kapalı",
    twofa_hint: "Hesabınızı doğrulama uygulamasından gelen bir kodla koruyun.",
    twofa_enable: "2FA'yı aç",
    twofa_disable: "2FA'yı kapat",
    twofa_scan: "Bu anahtarı doğrulama uygulamanıza ekleyin, sonra 6 haneli kodu girin:",
    twofa_enabled: "İki adımlı doğrulama açık",
    twofa_disabled: "İki adımlı doğrulama kapalı",
    twofa_managed: "Süper adminin parolası ve 2FA'sı sunucu ayarlarında yönetilir.",
    verify: "Doğrula",
    admin: "Yönetim",
    admin_sub: "Kullanıcılar, onaylar ve bu kurulumdaki bütün markalar.",
    users: "Kullanıcılar",
    th_email: "E-posta",
    th_status: "Durum",
    th_brands: "Marka",
    th_joined: "Katılma",
    th_last: "Son giriş",
    approve: "Onayla",
    disable: "Engelle",
    enable: "Etkinleştir",
    u_unverified: "Doğrulanmadı",
    u_pending: "Onay bekliyor",
    u_active: "Aktif",
    u_disabled: "Engelli",
    registration: "Kayıt",
    reg_closed: "Kapalı",
    reg_approval: "Onaylı",
    reg_open: "Açık",
    email_off: "E-posta gönderimi ayarlı değil; doğrulama e-postaları sadece loglanıyor.",
    all_brands: "Bütün markalar",
    owner: "Sahibi",
    st_users: "Kullanıcı",
    st_pending: "Onay bekleyen",
    st_brands: "Marka",
    st_scheduled: "Planlı gönderi",
    done: "Tamam",
    login_title: "Giriş",
    login_hint: "E-posta ve parolanızla giriş yapın. İki adımlı doğrulama kullanıyorsanız 6 haneli kodu da girin.",
    password: "Parola",
    code: "2FA kodu (açıksa)",
    sign_in: "Giriş yap",
    continue: "Devam",
    setup_title: "İlk kurulum",
    setup_missing: "Eksik gizli değerler:",
    setup_hint:
      "Bu değerler <b>sadece bu tarayıcıda</b> üretilir; sunucuya gönderilmez. Her birini Cloudflare panelinde Workers &amp; Pages → worker'ınız → Settings → Variables and Secrets bölümüne <b>Secret</b> olarak ekleyin. Kurulum bitince bu sayfa kapanır.",
    setup_pw: "Yönetici parolası (en az 12 karakter)",
    setup_pw2: "Parola tekrar",
    setup_gen: "Değerleri üret",
    setup_short: "Parola en az 12 karakter olmalı.",
    setup_mismatch: "Parolalar aynı değil.",
    setup_wait: "Üretiliyor…",
    setup_totp: "Doğrulama uygulamanıza (Google Authenticator, Authy, 1Password…) <b>ADMIN_TOTP_SECRET</b> değerini \"kurulum anahtarı gir\" ile ekleyin ya da bu adresi kullanın:",
    setup_warn: "Bu değerleri kimseyle paylaşmayın; sohbetlere ya da git'e yapıştırmayın. Sayfayı kapatınca kaybolurlar.",
    consent_title: "{name} bağlanmak istiyor",
    consent_pub: "Yayıncı: <b>{domain}</b>",
    consent_unverified: "Bu uygulama kendini kaydetti; adı doğrulanmadı.",
    consent_redirect: "Erişim <b>{host}</b> adresine gönderilecek",
    consent_loopback: "<b>Erişim bilgisayarınızdaki bir uygulamaya gidecek.</b> Sadece girişi siz başlattıysanız devam edin.",
    consent_scope: "Markaları listeleyebilir, gönderi planlayabilir, düzenleyebilir, iptal edip yeniden deneyebilir. Parolalarınızı ve platform tokenlarınızı asla göremez.",
    allow: "İzin ver",
    deny: "Reddet",
    privacy: "Gizlilik",
    terms: "Koşullar",
    source_code: "Kaynak kod",
    nav_overview: "Genel bakış",
    nav_posts: "Gönderiler",
    nav_brands: "Markalar",
    nav_setup: "Kurulum",
    nav_activity: "Etkinlik",
    nav_calendar: "Takvim",
    nav_analytics: "Analitik",
    calendar: "Takvim",
    cal_sub: "{brand} için sıradaki her şey. Gönderiler saati gelince otomatik yayınlanır. Bir güne tıklayıp gönderileri görebilir veya ekleyebilirsin.",
    cal_today: "Bugün",
    cal_add: "Gönderi ekle",
    cal_none: "Bu günde gönderi yok.",
    cal_full: "Günlük limit doldu",
    cal_slots: "{n} boş",
    cal_more: "+{n} daha",
    wd0: "Pzt",
    wd1: "Sal",
    wd2: "Çar",
    wd3: "Per",
    wd4: "Cum",
    wd5: "Cmt",
    wd6: "Paz",
    analytics: "Analitik",
    an_sub: "{brand} için yayın sonuçları. Kervly'nin kendi kuyruğuna dayanır (platformların izlenme sayıları dahil değildir).",
    an_range: "Son {n} gün",
    an_published: "Yayınlanan",
    an_failed: "Başarısız",
    an_success: "Başarı oranı",
    an_upcoming: "Sıradaki",
    an_streak: "Gün serisi",
    an_avg: "Aktif gün başına",
    an_daily: "Günlük gönderiler",
    an_platforms: "Platforma göre",
    an_hours: "Yayın saatleri",
    an_source: "Gönderiler nereden geldi",
    an_src_ui: "Panel",
    an_src_mcp: "MCP / Claude",
    an_errors: "En sık hatalar",
    an_no_errors: "Bu dönemde hata yok.",
    an_no_data: "Bu dönemde henüz yayınlanan yok.",
    an_times: "{n}×",
    logout: "Çıkış",
    brand: "Marka",
    session_over: "Oturum bitti",
    today: "Bugün",
    tomorrow: "Yarın",
    yesterday: "Dün",
    never: "hiç",
    copy: "Kopyala",
    copied: "Kopyalandı",
    confirm: "Onayla",
    close: "Kapat",
    no_brand_opt: "Marka yok",
    welcome_title: "Kervly'ye hoş geldiniz",
    welcome_sub: "Önce bir marka oluşturun: hesaplarınız, video klasörünüz ve paylaşım saatleriniz markada durur.",
    no_brands: "Henüz marka yok.",
    new_brand: "Yeni marka",
    new_post: "Yeni gönderi",
    edit_post: "Gönderiyi düzenle",
    st_today: "Bugün",
    st_upcoming: "Planlanan",
    st_published: "Yayınlanan (7 gün)",
    st_errors: "Hatalı",
    hello: "{brand}",
    sched_ok: "Zamanlayıcı çalışıyor · son çalışma {t}",
    sched_late: "Zamanlayıcı bir süredir çalışmadı · son çalışma {t}",
    sched_never: "Zamanlayıcı henüz çalışmadı (yayına aldıktan sonra 5 dakika içinde başlar)",
    next_posts: "Sıradaki gönderiler",
    no_upcoming: "Planlanmış gönderi yok.",
    needs_attention: "İlgilenmeniz gerekenler",
    see_all: "Tümünü gör",
    checklist: "Kurulum listesi",
    ck_login: "2FA'lı yönetici hesabı",
    ck_allowlist: "Bu markaya GitHub deposu (ya da video klasörü) bağla",
    ck_keys: "{p} uygulama anahtarlarını ekle",
    ck_connect: "{p} hesabını bağla",
    ck_mcp: "Yapay zekâ ajanını bağla (MCP)",
    go: "Git",
    edit: "Düzenle",
    duplicate: "Kopyasını oluştur",
    retry: "Tekrar dene",
    cancel: "İptal",
    cancel_post: "Gönderiyi iptal et",
    open: "Aç",
    upcoming: "Yaklaşan",
    past: "Geçmiş",
    all: "Tümü",
    all_statuses: "Tüm durumlar",
    all_platforms: "Tüm platformlar",
    s_scheduled: "Planlandı",
    s_publishing: "Yükleniyor",
    s_processing: "İşleniyor",
    s_published: "Yayında",
    s_error: "Hata",
    s_cancelled: "İptal",
    posts: "Gönderiler",
    tz_note: "Saatler {tz} saat dilimine göre",
    no_posts: "Burada gönderi yok.",
    saved: "Kaydedildi",
    pick_platform: "En az bir platform seçin",
    scheduled_n: "{n} gönderi planlandı",
    brands: "Markalar",
    brands_hint: "Her markanın kendi hesapları, video klasörü, günlük sınırı ve saat dilimi vardır.",
    connected: "Bağlı",
    not_connected: "Bağlı değil",
    brand_line: "Platform başına günde en fazla {n} gönderi · {tz}",
    allowlist: "Video klasörleri (izin listesi)",
    allowlist_empty: "Klasör yok — hiçbir şey paylaşılamaz",
    edit_brand: "Düzenle:",
    brand_saved: "Marka kaydedildi",
    keys_missing_short: "Anahtarlar eksik",
    ready_to_connect: "Bağlanmaya hazır",
    reconnect: "Yeniden bağla",
    connect: "Bağla",
    remove: "Kaldır",
    tt_unaudited: "TikTok uygulamanızın denetimi onaylanana kadar videolar \"sadece ben\" olarak paylaşılır.",
    redirect_uri: "Yönlendirme adresi (geliştirici konsoluna yapıştırın)",
    secrets_needed: "Cloudflare secret'ları:",
    open_console: "Geliştirici konsolu",
    setup: "Kurulum",
    setup_sub: "Platform başvuruları için gereken her şey tek yerde.",
    mcp_title: "Yapay zekâ ajanı (MCP)",
    mcp_sub: "Bu adresi Claude'a ya da OAuth destekleyen herhangi bir MCP istemcisine özel bağlantı olarak ekleyin.",
    mcp_s1: "Claude → Ayarlar → Bağlantılar → Özel bağlantı ekle; adresi yapıştırın.",
    mcp_s2: "Bağlan'a basın; burada parola ve 2FA koduyla giriş yapın.",
    mcp_s3: "İzin ver deyin. Ajanınız artık markaları listeleyip gönderi planlayabilir.",
    legal_urls: "Gizlilik politikası ve koşullar",
    legal_sub: "Platform başvuru formları bu herkese açık sayfaları ister.",
    website: "Web sitesi",
    scheduler: "Zamanlayıcı",
    scheduler_sub: "5 dakikada bir çalışır: zamanı gelen gönderileri yükler, işleme durumunu takip eder, tokenları yeniler.",
    docs_hint: "Her platform için adım adım anlatım:",
    docs_link: "Kurulum rehberi",
    activity: "Etkinlik",
    activity_sub: "Girişler, değişiklikler ve her yayın adımı.",
    th_time: "Zaman",
    th_actor: "Kim",
    th_action: "İşlem",
    th_detail: "Ayrıntı",
    no_activity: "Henüz etkinlik yok.",
    confirm_cancel: "Bu gönderi iptal edilsin mi? Yayınlanmayacak.",
    cancelled: "Gönderi iptal edildi",
    requeued: "Yeniden kuyruğa alındı",
    confirm_disconnect: "{x} bağlantısı kaldırılsın mı? Yeniden bağlayana kadar bu hesabın gönderileri hata verir.",
    removed: "Kaldırıldı",
    confirm_delete_brand: "{x} markası silinsin mi?",
    delete_brand: "Markayı sil",
    brand_deleted: "Marka silindi",
    connected_x: "{x} bağlandı",
    f_platforms: "Platformlar",
    f_video: "Video adresi",
    f_video_hint: "Markanın video klasörlerinden birindeki .mp4 dosyası.",
    f_from_folder: "Markanın klasöründen",
    f_date: "Tarih",
    f_time: "Saat",
    f_title: "Başlık",
    f_title_note: "Başlığı YouTube kullanır; diğer platformlar açıklamayı kullanır.",
    f_caption: "Açıklama",
    f_tags: "Etiketler",
    f_tags_hint: "Virgülle ayırın (YouTube)",
    f_advanced: "Platform seçenekleri",
    f_yt_privacy: "YouTube görünürlüğü",
    f_public: "Herkese açık",
    f_unlisted: "Liste dışı",
    f_private: "Özel",
    f_yt_category: "YouTube kategorisi",
    f_kids: "Çocuklara özel",
    f_ig_feed: "Reel'i Instagram akışında da göster",
    f_tt_comments: "TikTok'ta yorumlara izin ver",
    save: "Kaydet",
    schedule: "Planla",
    b_id: "Kimlik",
    b_id_hint: "Küçük harf, rakam ve tire. Sonradan değiştirilemez.",
    b_name: "Ad",
    b_prefixes: "Video klasörleri (her satıra bir tane, / ile bitmeli)",
    b_hosts: "İzinli alan adları:",
    b_limit: "Platform başına günlük sınır",
    b_tz: "Saat dilimi",
    b_times: "Varsayılan paylaşım saatleri",
    b_times_hint: "Örn. 10:00, 15:00, 18:00 — tek tıkla seçilebilir.",
  },
} satisfies Record<Lang, Record<string, string>>;

type UiKey = keyof (typeof UI)["en"];
const t = (lang: Lang, k: UiKey, vars: Record<string, string> = {}) => UI[lang][k].replace(/\{(\w+)\}/g, (_, n: string) => vars[n] ?? "");

/** Simple stroke icons (decorative, aria-hidden). */
const I = (d: string) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  brand: I('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  setup: I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  activity: I('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  copy: I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  retry: I('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  x: I('<path d="M18 6 6 18M6 6l12 12"/>'),
  external: I('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  check: I('<path d="M20 6 9 17l-5-5"/>'),
  alert: I('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  chart: I('<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>'),
  calendar: I('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  shield: I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  upload: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>'),
  github: I('<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.3 6.4-1.5 6.4-6.9a5.4 5.4 0 0 0-1.5-3.7 5 5 0 0 0-.1-3.7s-1.2-.3-3.9 1.5a13.4 13.4 0 0 0-7 0C6.3 1.8 5.1 2.1 5.1 2.1a5 5 0 0 0-.1 3.7 5.4 5.4 0 0 0-1.5 3.7c0 5.4 3.3 6.6 6.4 6.9a3.4 3.4 0 0 0-.9 2.6V22"/>'),
  lock: I('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
};
const MARK = I('<path d="M3 17h18"/><path d="M5 17v-3a3 3 0 0 1 3-3h1l2-3h2l1 3h2a3 3 0 0 1 3 3v3"/><circle cx="8" cy="19.5" r="1.5"/><circle cx="16" cy="19.5" r="1.5"/>');
const LOGO = `<span class="logo"><span class="mark">${MARK}</span>${APP_NAME}</span>`;

/** JSON for a <script type="application/json"> block (never lets "</script>" through). */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

function langSwitch(lang: Lang): string {
  return `<span class="lang"><a href="?lang=en" class="${lang === "en" ? "on" : ""}">EN</a><a href="?lang=tr" class="${lang === "tr" ? "on" : ""}">TR</a></span>`;
}

export function layout(lang: Lang, title: string, body: string, nonce: string, script = ""): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark"><title>${esc(title)} · ${APP_NAME}</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#c2410c"/><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16h16M6 16v-2.5a2.5 2.5 0 0 1 2.5-2.5h1l1.6-2.5h1.8l1 2.5h1.6a2.5 2.5 0 0 1 2.5 2.5V16"/></g></svg>`)}">
<style nonce="${nonce}">${CSS}</style></head><body>${body}${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;
}

function authCard(lang: Lang, inner: string): string {
  return `<div class="auth"><div class="card"><div class="row between">${LOGO}${langSwitch(lang)}</div>${inner}</div></div>`;
}

export function loginPage(lang: Lang, nonce: string, next: string, canSignup: boolean, error = "", email = ""): string {
  return layout(
    lang,
    t(lang, "login_title"),
    authCard(
      lang,
      `<h1>${t(lang, "login_title")}</h1><p class="muted small">${t(lang, "login_hint")}</p>
${error ? `<p class="notice err">${esc(error)}</p>` : ""}
<form method="post" action="/login" class="stack-sm">
<input type="hidden" name="next" value="${esc(next)}">
<div class="field"><label class="lbl" for="e">${t(lang, "email")}</label><input id="e" name="email" type="text" autocomplete="username" required maxlength="254" value="${esc(email)}" autofocus></div>
<div class="field"><div class="row between"><label class="lbl" for="p">${t(lang, "password")}</label><a class="tiny" href="/forgot">${t(lang, "forgot")}</a></div><input id="p" name="password" type="password" autocomplete="current-password" required maxlength="256"></div>
<div class="field"><label class="lbl" for="c">${t(lang, "code")}</label><input id="c" name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" maxlength="6" placeholder="123456"></div>
<button type="submit" class="btn w100">${t(lang, "sign_in")}</button></form>
${canSignup ? `<p class="small muted center-text">${t(lang, "no_account")} <a href="/signup">${t(lang, "create_account")}</a></p>` : ""}`,
    ),
    nonce,
  );
}

/** Sign-up, forgot-password and reset-password forms. */
export function authFormPage(lang: Lang, nonce: string, kind: "signup" | "forgot" | "reset" | "verify", error = "", token = ""): string {
  const L = (k: UiKey) => t(lang, k);
  const err = error ? `<p class="notice err">${esc(error)}</p>` : "";
  let inner = "";
  if (kind === "signup") {
    inner = `<h1>${L("signup_title")}</h1><p class="muted small">${L("signup_hint")}</p>${err}
<form method="post" action="/signup" class="stack-sm">
<div class="field"><label class="lbl" for="e">${L("email")}</label><input id="e" name="email" type="email" autocomplete="email" required maxlength="254" autofocus></div>
<label class="row small"><input type="checkbox" name="terms" required> <span>${t(lang, "accept_terms", { terms: `<a href="/terms" target="_blank">${L("terms")}</a>`, privacy: `<a href="/privacy" target="_blank">${L("privacy")}</a>` })}</span></label>
<button type="submit" class="btn w100">${L("create_account")}</button></form>
<p class="small muted center-text">${L("have_account")} <a href="/login">${L("sign_in")}</a></p>`;
  } else if (kind === "forgot") {
    inner = `<h1>${L("forgot_title")}</h1><p class="muted small">${L("forgot_hint")}</p>${err}
<form method="post" action="/forgot" class="stack-sm">
<div class="field"><label class="lbl" for="e">${L("email")}</label><input id="e" name="email" type="email" autocomplete="email" required maxlength="254" autofocus></div>
<button type="submit" class="btn w100">${L("send_link")}</button></form>
<p class="small muted center-text"><a href="/login">${L("back_to_login")}</a></p>`;
  } else {
    const verify = kind === "verify";
    inner = `<h1>${verify ? L("verify_title") : L("reset_title")}</h1>${verify ? `<p class="muted small">${L("verify_hint")}</p>` : ""}${err}
<form method="post" action="${verify ? "/verify" : "/reset"}" class="stack-sm"><input type="hidden" name="token" value="${esc(token)}">
<div class="field"><label class="lbl" for="p">${L("new_password")}</label><input id="p" name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="256" autofocus><div class="hint tiny faint">${L("password_rule")}</div></div>
<div class="field"><label class="lbl" for="p2">${L("setup_pw2")}</label><input id="p2" name="password2" type="password" autocomplete="new-password" required minlength="10" maxlength="256"></div>
<button type="submit" class="btn w100">${L("save")}</button></form>`;
  }
  return layout(lang, kind === "signup" ? L("signup_title") : kind === "forgot" ? L("forgot_title") : kind === "verify" ? L("verify_title") : L("reset_title"), authCard(lang, inner), nonce);
}

export function messagePage(lang: Lang, nonce: string, title: string, text: string, link = "/"): string {
  return layout(lang, title, authCard(lang, `<h1>${esc(title)}</h1><p>${esc(text)}</p><p><a class="btn ghost" href="${esc(link)}">${t(lang, "continue")}</a></p>`), nonce);
}

/** First-time setup: secrets are generated in the browser, nothing is sent to the server. */
export function setupPage(lang: Lang, nonce: string, missing: string[]): string {
  const T = { short: t(lang, "setup_short"), mismatch: t(lang, "setup_mismatch"), wait: t(lang, "setup_wait"), copy: t(lang, "copy") };
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
 for(const [k,v] of Object.entries(vals)){const l=document.createElement("label");l.className="lbl";l.textContent=k;const row=document.createElement("div");row.className="copy";const c=document.createElement("code");c.textContent=v;const b=document.createElement("button");b.type="button";b.className="btn ghost sm";b.textContent=T.copy;b.onclick=()=>navigator.clipboard.writeText(v);row.append(c,b);const f=document.createElement("div");f.className="field";f.append(l,row);out.append(f)}
 $("otp").textContent="otpauth://totp/${APP_NAME}:admin?secret="+totp+"&issuer=${APP_NAME}";
 $("res").classList.remove("hidden");$("msg").textContent="";$("pw").value="";$("pw2").value="";
};`;
  return layout(
    lang,
    t(lang, "setup_title"),
    `<div class="auth"><div class="card wide"><div class="row between">${LOGO}${langSwitch(lang)}</div>
<h1>${t(lang, "setup_title")}</h1>
<p class="small">${t(lang, "setup_missing")} <span class="mono">${missing.map(esc).join(", ")}</span></p>
<p class="muted small">${t(lang, "setup_hint")}</p>
<div class="field"><label class="lbl" for="pw">${t(lang, "setup_pw")}</label><input id="pw" type="password" autocomplete="new-password"></div>
<div class="field"><label class="lbl" for="pw2">${t(lang, "setup_pw2")}</label><input id="pw2" type="password" autocomplete="new-password"></div>
<div class="row"><button id="gen" type="button" class="btn">${t(lang, "setup_gen")}</button><span id="msg" class="small warn-text"></span></div>
<div id="res" class="hidden stack-sm"><div id="out"></div>
<p class="small">${t(lang, "setup_totp")}</p><p class="mono" id="otp"></p>
<p class="badge warn">${t(lang, "setup_warn")}</p></div></div></div>`,
    nonce,
    script,
  );
}

export function consentPage(
  lang: Lang,
  nonce: string,
  d: { clientName: string; clientDomain?: string; redirectHost: string; redirectIsLoopback: boolean; scope: string[] },
  handle: string,
  email = "",
): string {
  return layout(
    lang,
    t(lang, "allow"),
    authCard(
      lang,
      `<h1>${t(lang, "consent_title", { name: esc(d.clientName) })}</h1>
<p class="small">${d.clientDomain ? t(lang, "consent_pub", { domain: esc(d.clientDomain) }) : t(lang, "consent_unverified")}</p>
<p class="small">${t(lang, "consent_redirect", { host: esc(d.redirectHost) })}</p>
${d.redirectIsLoopback ? `<p class="small warn-text">${t(lang, "consent_loopback")}</p>` : ""}
<p class="small muted">${t(lang, "consent_scope")}</p>
${email ? `<p class="tiny faint">${t(lang, "signed_in_as", { email: esc(email) })}</p>` : ""}
<form method="post" action="/authorize"><input type="hidden" name="handle" value="${esc(handle)}">
${d.scope.map((s) => `<input type="hidden" name="scope" value="${esc(s)}">`).join("")}
<div class="row"><button class="btn" name="decision" value="approve">${t(lang, "allow")}</button><button class="btn ghost" name="decision" value="deny">${t(lang, "deny")}</button></div></form>`,
    ),
    nonce,
  );
}

const LEGAL = {
  en: {
    privacy: `<h1>Privacy Policy</h1>
<p>This ${APP_NAME} instance is used by its operator to publish their own videos to their own YouTube, Instagram and TikTok accounts at scheduled times.</p>
<p><b>Data collected:</b> the access tokens issued by the platforms and the account name. Tokens are encrypted with AES-256-GCM and used only to upload videos. No viewer data, messages or other personal data are collected.</p>
<p><b>Sharing:</b> data is never shared with or sold to third parties.</p>
<p><b>Deletion:</b> a connection can be removed at any time from the dashboard or from the platform's app settings; its tokens are deleted when it is removed.</p>
<p><b>Contact:</b> the operator of this instance.</p>`,
    terms: `<h1>Terms of Service</h1>
<p>${APP_NAME} is a tool that lets the operator publish their own content to their own social media accounts at scheduled times.</p>
<p>The operator is responsible for the content published. Each platform's (YouTube, Instagram, TikTok) own terms apply.</p>
<p>The service is provided as is, without any guarantee of uninterrupted operation.</p>`,
  },
  tr: {
    privacy: `<h1>Gizlilik Politikası</h1>
<p>Bu ${APP_NAME} kurulumu, işletmecisinin kendi videolarını kendi YouTube, Instagram ve TikTok hesaplarına planlı olarak yüklemesi için kullanılır.</p>
<p><b>Toplanan veriler:</b> Platformların verdiği erişim tokenları ve hesap adı. Tokenlar AES-256-GCM ile şifrelenir ve yalnızca video yüklemek için kullanılır. İzleyici verisi, mesaj ya da başka kişisel veri toplanmaz.</p>
<p><b>Paylaşım:</b> Veriler üçüncü taraflarla paylaşılmaz, satılmaz.</p>
<p><b>Silme:</b> Bağlantı panelden ya da platformun uygulama ayarlarından istenildiği an kaldırılabilir; kaldırıldığında tokenlar silinir.</p>
<p><b>İletişim:</b> Bu kurulumun işletmecisi.</p>`,
    terms: `<h1>Kullanım Koşulları</h1>
<p>${APP_NAME}, işletmecinin kendi içeriğini kendi sosyal medya hesaplarında planlı olarak yayınlamasını sağlayan bir araçtır.</p>
<p>Yayınlanan içerikten işletmeci sorumludur. Her platformun (YouTube, Instagram, TikTok) kendi kullanım koşulları geçerlidir.</p>
<p>Hizmet olduğu gibi sunulur; kesintisiz çalışma garantisi verilmez.</p>`,
  },
};

export function legalPage(lang: Lang, nonce: string, kind: "privacy" | "terms"): string {
  return layout(lang, t(lang, kind), `<div class="auth"><div class="card stack wider"><div class="row between">${LOGO}${langSwitch(lang)}</div>${LEGAL[lang][kind]}</div></div>`, nonce);
}

/** The dashboard shell. Views are rendered by src/client/dashboard.js.txt. */
export function dashboardPage(lang: Lang, nonce: string, defaultTz: string, actor: Actor): string {
  const L = (k: UiKey) => t(lang, k);
  const nav = (
    [
      ["overview", "home", "nav_overview"],
      ["posts", "list", "nav_posts"],
      ["calendar", "calendar", "nav_calendar"],
      ["analytics", "chart", "nav_analytics"],
      ["brands", "brand", "nav_brands"],
      ["setup", "setup", "nav_setup"],
      ["activity", "activity", "nav_activity"],
      ["account", "user", "nav_account"],
      ...(actor.role === "superadmin" ? ([["admin", "shield", "nav_admin"]] as const) : []),
    ] as const
  ).map(
    ([id, icon, label]) =>
      `<a href="#/${id}" data-nav="${id}">${ICONS[icon]}<span>${L(label)}</span>${id === "overview" ? `<span class="count err-count hidden"></span>` : ""}</a>`,
  );
  const boot = { T: UI[lang], lang, defaultTz, repoUrl: REPO_URL, icons: ICONS, user: { email: actor.email, role: actor.role } };
  const opt = (v: string, label: string) => `<option value="${v}">${label}</option>`;
  const pfToggle = (p: string, name: string) =>
    `<label class="ptoggle"><input type="checkbox" name="pf" value="${p}"><span class="pf ${p}">${{ youtube: "YT", instagram: "IG", tiktok: "TT" }[p]}</span>${name}</label>`;

  const body = `
<div class="shell">
  <aside class="side">
    ${LOGO}
    <div><label class="lbl" for="brand-side">${L("brand")}</label><select id="brand-side" class="brand-select" aria-label="${L("brand")}"></select></div>
    <nav class="nav">${nav.join("")}</nav>
    <div class="side-foot">
      <div class="me"><div class="small ellipsis">${esc(actor.email)}</div>${actor.role === "superadmin" ? `<span class="badge info">${L("superadmin")}</span>` : ""}</div>
      <div class="row between">${langSwitch(lang)}<button class="btn ghost sm" data-act="logout">${ICONS.logout}${L("logout")}</button></div>
      <div class="tiny faint">${APP_NAME} ${APP_VERSION} · <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${L("source_code")}</a> · <a href="/privacy">${L("privacy")}</a></div>
    </div>
  </aside>
  <header class="topbar">${LOGO}<select class="brand-select select-inline right" aria-label="${L("brand")}"></select><a class="btn ghost icon" href="#/account" aria-label="${L("nav_account")}">${ICONS.user}</a><button class="btn ghost icon" data-act="logout" aria-label="${L("logout")}">${ICONS.logout}</button></header>
  <main class="main" id="view" aria-live="polite"></main>
  <nav class="tabbar">${nav.join("")}</nav>
</div>

<dialog id="dlg-post"><form id="post-form" novalidate>
  <div class="dlg-head"><h2 id="post-title"></h2><button type="button" class="btn ghost icon right" data-close="1" aria-label="${L("close")}">${ICONS.x}</button></div>
  <div class="dlg-body">
    <div class="field"><span class="lbl">${L("f_platforms")}</span><div class="ptoggles">${pfToggle("youtube", "YouTube")}${pfToggle("instagram", "Instagram")}${pfToggle("tiktok", "TikTok")}</div></div>
    <div class="field"><label class="lbl" for="f-media">${L("f_video")}</label><input id="f-media" name="media_url" required inputmode="url" placeholder="https://raw.githubusercontent.com/owner/repo/main/videos/clip.mp4">
      <div class="row between mt8"><span class="hint tiny faint">${L("f_video_hint")}</span><label class="btn ghost sm" id="upload-btn">${ICONS.upload}<span>${L("upload_video")}</span><input type="file" id="upload-file" accept="video/mp4" class="hidden"></label></div>
      <div id="upload-status" class="tiny muted hidden"></div><div id="lib" class="lib hidden"></div></div>
    <div class="grid g2">
      <div class="field"><label class="lbl" for="f-date">${L("f_date")}</label><input id="f-date" name="date" type="date" required><div class="chips mt8" id="date-chips"></div></div>
      <div class="field"><label class="lbl" for="f-time">${L("f_time")} · <span id="post-tz"></span></label><input id="f-time" name="time" type="time" required><div class="chips mt8" id="time-chips"></div></div>
    </div>
    <div class="field"><label class="lbl" for="f-title">${L("f_title")}</label><input id="f-title" name="title" maxlength="150"><div class="row between"><span id="yt-title-note" class="tiny faint hidden">${L("f_title_note")}</span><span class="counter right" id="cnt-title"></span></div></div>
    <div class="field"><label class="lbl" for="f-caption">${L("f_caption")}</label><textarea id="f-caption" name="caption" maxlength="2200"></textarea><div class="counter" id="cnt-caption"></div></div>
    <div class="field" data-pf-section="youtube"><label class="lbl" for="f-tags">${L("f_tags")}</label><input id="f-tags" name="tags" placeholder="${L("f_tags_hint")}"></div>
    <details class="adv"><summary>${L("f_advanced")}</summary><div class="stack-sm mt12">
      <div class="grid g2" data-pf-section="youtube">
        <div><label class="lbl" for="f-ytp">${L("f_yt_privacy")}</label><select id="f-ytp" name="yt_privacy">${opt("public", L("f_public"))}${opt("unlisted", L("f_unlisted"))}${opt("private", L("f_private"))}</select></div>
        <div><label class="lbl" for="f-ytc">${L("f_yt_category")}</label><select id="f-ytc" name="yt_category">${["PEOPLE_BLOGS", "EDUCATION", "ENTERTAINMENT", "HOWTO_STYLE", "FILM_ANIMATION", "NONPROFITS_ACTIVISM"].map((c) => opt(c, c.replace("_", " & ").replace("PEOPLE & BLOGS", "People & Blogs").toLowerCase().replace(/(^|\s|&\s)\w/g, (m) => m.toUpperCase()))).join("")}</select></div>
        <label class="row small"><input type="checkbox" name="yt_kids"> ${L("f_kids")}</label>
      </div>
      <label class="row small" data-pf-section="instagram"><input type="checkbox" name="ig_feed" checked> ${L("f_ig_feed")}</label>
      <label class="row small" data-pf-section="tiktok"><input type="checkbox" name="tt_comments" checked> ${L("f_tt_comments")}</label>
    </div></details>
  </div>
  <div class="dlg-foot"><button type="button" class="btn ghost" data-close="1">${L("cancel")}</button><button type="submit" class="btn" id="post-save">${L("save")}</button></div>
</form></dialog>

<dialog id="dlg-brand"><form id="brand-form" novalidate>
  <div class="dlg-head"><h2 id="brand-title"></h2><button type="button" class="btn ghost icon right" data-close="1" aria-label="${L("close")}">${ICONS.x}</button></div>
  <div class="dlg-body">
    <div class="grid g2">
      <div class="field"><label class="lbl" for="b-id">${L("b_id")}</label><input id="b-id" name="bid" required pattern="[a-z0-9][a-z0-9-]{1,31}" placeholder="mybrand"><div class="hint tiny faint">${L("b_id_hint")}</div></div>
      <div class="field"><label class="lbl" for="b-name">${L("b_name")}</label><input id="b-name" name="bname" required maxlength="60"></div>
    </div>
    <div class="field"><label class="lbl" for="b-prefixes">${L("b_prefixes")}</label><textarea id="b-prefixes" name="prefixes" class="mono" placeholder="https://raw.githubusercontent.com/owner/repo/main/videos/"></textarea><div class="hint tiny faint">${L("b_hosts")} <span id="hosts" class="mono"></span></div></div>
    <div class="grid g2">
      <div class="field"><label class="lbl" for="b-tz">${L("b_tz")}</label><select id="b-tz" name="tz"></select></div>
      <div class="field"><label class="lbl" for="b-limit">${L("b_limit")}</label><input id="b-limit" name="limit" type="number" min="1" max="10" value="3"></div>
    </div>
    <div class="field"><label class="lbl" for="b-times">${L("b_times")}</label><input id="b-times" name="times" placeholder="10:00, 15:00, 18:00"><div class="hint tiny faint">${L("b_times_hint")}</div></div>
  </div>
  <div class="dlg-foot"><button type="button" class="btn danger hidden" id="brand-del">${L("delete_brand")}</button><span class="grow"></span><button type="button" class="btn ghost" data-close="1">${L("cancel")}</button><button type="submit" class="btn">${L("save")}</button></div>
</form></dialog>

<dialog id="dlg-storage"><form id="storage-form" novalidate>
  <div class="dlg-head"><h2>${ICONS.github} ${L("storage_title")}</h2><button type="button" class="btn ghost icon right" data-close="1" aria-label="${L("close")}">${ICONS.x}</button></div>
  <div class="dlg-body">
    <p class="small muted">${L("storage_intro")}</p>
    <div class="grid g2">
      <div class="field"><label class="lbl" for="s-repo">${L("s_repo")}</label><input id="s-repo" name="repo" required placeholder="owner/my-videos"></div>
      <div class="field"><label class="lbl" for="s-branch">${L("s_branch")}</label><input id="s-branch" name="branch" placeholder="main"></div>
    </div>
    <div class="field"><label class="lbl" for="s-path">${L("s_path")}</label><input id="s-path" name="path" placeholder="videos"></div>
    <div class="field"><label class="lbl" for="s-token">${L("s_token")}</label><input id="s-token" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
      <div class="hint tiny faint" id="s-token-hint">${L("s_token_hint")}</div></div>
    <details class="adv"><summary>${L("s_howto")}</summary><ol class="steps small mt8">
      <li>${L("s_step1")}</li><li>${L("s_step2")}</li><li>${L("s_step3")}</li><li>${L("s_step4")}</li></ol>
      <a class="btn ghost sm" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">${ICONS.external}${L("s_create_token")}</a></details>
  </div>
  <div class="dlg-foot"><button type="button" class="btn danger hidden" id="storage-del">${L("remove")}</button><span class="grow"></span><button type="button" class="btn ghost" data-close="1">${L("cancel")}</button><button type="submit" class="btn" id="storage-save">${L("s_verify_save")}</button></div>
</form></dialog>

<dialog id="dlg-confirm"><form method="dialog">
  <div class="dlg-body"><p id="cf-text"></p></div>
  <div class="dlg-foot"><button class="btn ghost" value="no">${L("close")}</button><button id="cf-ok" class="btn" value="ok"></button></div>
</form></dialog>

<div id="toast" role="status"></div>
<script type="application/json" id="boot">${scriptJson(boot)}</script>`;
  return layout(lang, L("nav_overview"), body, nonce, DASHBOARD_JS);
}
