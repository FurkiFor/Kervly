# Kervly'yi kendi hesabınızda çalıştırma

Her şey Cloudflare'in ücretsiz planında çalışır. Rehberde `<URL>`, Kervly adresinizdir. Bu ya
`https://<worker>.<alt-alan>.workers.dev` olur ya da `CUSTOM_DOMAIN` verdiyseniz kendi alan adınız.

[English](SELF_HOSTING.md)

## 1. Cloudflare kaynakları

Bir D1 veritabanı ve iki KV alanı oluşturun. En kolayı panelden: *Storage & Databases → D1* ve *KV*. Komut satırından da yapabilirsiniz:

```bash
npx wrangler d1 create kervly-db
npx wrangler kv namespace create kervly-oauth
npx wrangler kv namespace create kervly-sessions
```

Üç kimliği (id) not edin.

## 2. GitHub ayarları

Repoyu kendi hesabınıza fork'layın ya da kopyalayın. Sonra *Settings → Secrets and variables → Actions* bölümünü açın.

**Secrets (gizli)**

| Ad | Değer |
|---|---|
| `CLOUDFLARE_API_TOKEN` | *My Profile → API Tokens → Create Custom Token*. Account izinleri: `Workers Scripts: Edit`, `D1: Edit`, `Workers KV Storage: Edit`. Kendi alan adınızı kullanacaksanız ayrıca `Zone: Workers Routes: Edit` ve `DNS: Edit`. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare ana sayfasında sağdaki *Account ID* |

**Variables (değişkenler)**

| Ad | Zorunlu | Örnek |
|---|---|---|
| `D1_DATABASE_ID` | evet | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `KV_OAUTH_ID` | evet | 32 karakter |
| `KV_SESSIONS_ID` | evet | 32 karakter |
| `D1_DATABASE_NAME` | adı `kervly-db` değilse | `kervly-db` |
| `WORKER_NAME` | hayır | `kervly` |
| `CUSTOM_DOMAIN` | hayır | `app.ornek.com` (alan adı Cloudflare'de olmalı) |
| `DEFAULT_TIMEZONE` | hayır | `Europe/Istanbul` |
| `DEFAULT_LANG` / `MCP_LANG` | hayır | `tr` ya da `en` |
| `MEDIA_ALLOWED_HOSTS` | hayır | `raw.githubusercontent.com` |
| `TIKTOK_UNAUDITED` | hayır | TikTok denetimi bitene kadar `true` |

Bunlar gizli değil, ama repoda tutulmadıkları için fork'unuzda kişisel kimlik kalmaz.

## 3. Yayına alma

*Actions → Deploy → Run workflow*. Bundan sonra `main`'e yapılan her push otomatik yayına çıkar ve veritabanı migrasyonlarını uygular.
`D1_DATABASE_ID` tanımlanmadan iş akışı hiçbir şey yapmaz.

## 4. Yönetici hesabı (parola + 2FA)

1. `<URL>` adresini açın; `/setup` sayfasına yönlenirsiniz.
2. En az 12 karakterlik bir parola girip **Değerleri üret**'e basın. Değerler sadece tarayıcınızda üretilir.
3. Dört değeri Cloudflare'de *Workers & Pages → worker'ınız → Settings → Variables and Secrets* bölümüne **Secret** olarak ekleyin.
   Bunlar `ADMIN_PASSWORD_HASH`, `ADMIN_TOTP_SECRET`, `ENCRYPTION_KEY` ve `CONSENT_SECRET`.
4. `ADMIN_TOTP_SECRET` değerini telefonunuzdaki doğrulama uygulamasına ekleyin.
5. `<URL>` adresinde parola ve 6 haneli kodla giriş yapın.

> `ENCRYPTION_KEY` değişirse kayıtlı platform bağlantıları açılamaz; hesapları yeniden bağlamanız gerekir.

## 5. Markalar

Panelde *Markalar → Yeni marka* bölümünü açın. Kimlik, ad ve **video izin listesi** girin. İzin listesi, videolarınızın
bulunduğu klasördür; örneğin `https://raw.githubusercontent.com/siz/videolar/main/klipler/`. Ardından günlük sınırı ve saat
dilimini ayarlayın. Kervly sadece bu öneklerin altındaki `.mp4` dosyalarını paylaşır.

Her platform için **bir kez** uygulama açarsınız (aşağıda). Sonra her marka kendi hesabını panelden **Bağla** ile bağlar.

## 6. YouTube

1. [Google Cloud Console](https://console.cloud.google.com/)'da proje açın ve **YouTube Data API v3**'ü etkinleştirin.
2. *Google Auth Platform* bölümünde:
   - *Audience*: *External* seçin.
   - *Data access*: `.../auth/youtube.upload` kapsamını ekleyin.
   - *Test users*: kendinizi ekleyin.
   - Ardından **Publish app → In production** yapın; test modunda refresh token 7 günde biter.
3. *Clients → Create client → Web application* oluşturun. *Authorized redirect URI*: `<URL>/connect/youtube/callback`
4. Cloudflare secret olarak `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` ekleyin.
5. Panel → marka seçin → YouTube → **Bağla**. Birden fazla kanalınız varsa Google ekranında doğru kanalı seçin.
6. Google, doğrulanmamış projelerden yüklenen videoları **özel** tutabilir. İlk video özel kalırsa
   *YouTube API Services – Audit and Quota Extension Form*'u doldurun (ücretsiz).

## 7. Instagram (Reels)

Önkoşul: Instagram hesabı **profesyonel** olmalı (İşletme ya da İçerik Üreticisi).

1. [Meta for Developers](https://developers.facebook.com/)'ta *Create App* deyin. Kullanım alanı olarak **Instagram'da mesajlaşma ve içerik yönetimi**'ni seçin.
2. *API setup with Instagram login* bölümünde:
   - Instagram hesabınızı ekleyin. Gerekirse *App roles → Instagram Tester* üzerinden davet edin; daveti Instagram'da *Ayarlar → Uygulamalar ve web siteleri* altından kabul edin.
   - *Business login settings → OAuth redirect URIs*: `<URL>/connect/instagram/callback`
   - Cloudflare secret olarak `INSTAGRAM_APP_ID` ve `INSTAGRAM_APP_SECRET` ekleyin.
3. *App settings → Basic*: Privacy Policy URL `<URL>/privacy`, Terms URL `<URL>/terms`.
4. *Development* modunda, uygulamada rolü olan hesaplar paylaşım yapabilir. Kendi markalarınız için bu yeterli.
5. Panel → marka seçin → Instagram → **Bağla**. Başka bir markanın hesabını bağlamadan önce Instagram'a o hesapla girin.

## 8. TikTok

1. [TikTok for Developers](https://developers.tiktok.com/)'da *Manage apps → Connect an app*.
2. Uygulama bilgileri: Terms URL `<URL>/terms`, Privacy URL `<URL>/privacy`, platform *Web*, web sitesi `<URL>`.
3. **Login Kit** ve **Content Posting API** ürünlerini ekleyin, **Direct Post**'u açın.
4. Login Kit redirect URI: `<URL>/connect/tiktok/callback`. Kapsamlar: `user.info.basic`, `video.publish`.
5. İncelemeye gönderin. Cloudflare secret olarak `TIKTOK_CLIENT_KEY` ve `TIKTOK_CLIENT_SECRET` ekleyin.
6. Panel → marka seçin → TikTok → **Bağla**.
7. **Denetim:** Content Posting API denetimi onaylanana kadar TikTok sadece gizli (`SELF_ONLY`) paylaşıma izin verir.
   `TIKTOK_UNAUDITED=true` iken Kervly bunu zorunlu kılar. Onaydan sonra değişkeni `false` yapın.

## 9. Yapay zekâ ajanını bağlama (MCP)

Claude'da *Settings → Connectors → Add custom connector* deyin ve URL olarak `<URL>/mcp` girin. **Connect**'e basın, parola ve
2FA koduyla giriş yapın, onay ekranında **İzin ver** deyin. OAuth destekleyen diğer MCP istemcileri de aynı şekilde bağlanır.

Örnek istek: *"Kervly markalarımı listele, sonra https://…/klip.mp4 videosunu yarın İstanbul saatiyle 10:00'da YouTube ve TikTok'a planla."*

## Sorun giderme
- **"Uygulama anahtarları tanımlı değil"**: platformun client id ya da secret'ı eksik.
- **YouTube "token yenileme başarısız"**: Google uygulaması hâlâ test modunda. *In production* yapıp yeniden bağlayın.
- **"Yükleme kesintiye uğradı"**: platformda video çıkmış mı bakın; çıkmadıysa **Tekrar**'a basın.
- **Secret değişikliği**: Cloudflare'de secret eklemek Worker'ı hemen yeni sürüme geçirir; yeniden yayına almaya gerek yok.
