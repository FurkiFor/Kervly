# Kervly

**YouTube Shorts, Instagram Reels ve TikTok için kendi sunucunda çalışan video planlayıcı — MCP sunucusuyla birlikte.**
Çok markalı, varsayılan olarak güvenli ve Cloudflare Workers'ta ücretsiz çalışır.

[English](README.md) · [Kurulum rehberi](docs/SELF_HOSTING.tr.md) · [Güvenlik](SECURITY.md) · [kervly.app](https://kervly.app)

> Videolarını tüm platformlara, zamanında taşıyan kervan.

```
Yapay zekâ ajanın (Claude…) ──MCP: schedule_post──▶ /mcp ──┐
Panel (tarayıcı)            ──/api (oturum + CSRF)──────▶ ├─▶ D1 kuyruğu
                                                          │
Cron (5 dk) ──▶ zamanı gelen gönderi ──▶ .mp4 izinli adresten akışla ──▶ YouTube / Instagram / TikTok
```

## Neden
Ücretli planlayıcılar aylık gönderi sayısını sınırlıyor. Kervly, Cloudflare'in ücretsiz planında çalışan, size ait küçük bir
uygulama. Platformların resmî API'leriyle doğrudan konuşur; yapay zekâ ajanınız onu MCP ile yönetebilir.

## Özellikler
- **Markalar**: her markanın kendi YouTube, Instagram ve TikTok hesapları, video izin listesi, günlük sınırı ve saat dilimi.
- **Panel**: marka yönetimi, hesap bağlama, planlama, gönderi listesi (iptal/yeniden dene), işlem kaydı. Türkçe ve İngilizce.
- **MCP sunucusu** (`/mcp`, Streamable HTTP + OAuth 2.1): `list_brands`, `schedule_post`, `list_posts`, `get_post`,
  `cancel_post`, `retry_post`, `connection_status`, `recent_activity`.
- **Yayıncı**: YouTube resumable yükleme, Instagram Reels, TikTok Direct Post. Videolar belleğe alınmadan akışla aktarılır.
  Instagram ve TikTok işleme durumu takip edilir, tokenlar süresi dolmadan yenilenir.

## Güvenlik
- **Giriş:** tek yönetici; parola (PBKDF2) **ve zorunlu 2FA (TOTP)**. Hatalı denemeler IP başına sınırlı, TOTP kodu tekrar kullanılamaz.
- **Oturum ve CSRF:** HttpOnly/Secure `__Host-` çerez; her yazma isteğinde CSRF başlığı ve köken kontrolü.
- **MCP:** OAuth 2.1 (PKCE). Token sadece yönetici giriş yapıp onay verince üretilir.
- **Platform tokenları:** AES-256-GCM ile şifreli ve marka+platforma bağlı; hiçbir yanıtta ya da logda görünmez.
- **En az yetki:** her platformdan sadece yükleme izni istenir.
- **Video izin listesi:** marka sadece kendi izin listesindeki `.mp4`'leri paylaşabilir. MCP bu listeyi değiştiremez.
- **Sınırlar:** günlük sınır var, çift yayın engelli.
- **Tarayıcı:** sıkı CSP.
- **Gizli değerler:** repoda hiçbir gizli değer yok. CI, geçmişi gitleaks ile tarar.

Ayrıntılı tablo: [README.md](README.md#security).

## Hızlı başlangıç
**[docs/SELF_HOSTING.tr.md](docs/SELF_HOSTING.tr.md)**

## Kervly Cloud
Kendiniz kurmak istemiyor musunuz? Barındırılan sürüm yakında **[kervly.app](https://kervly.app)** adresinde.

## Lisans
[AGPL-3.0](LICENSE). Kervly'yi özgürce kullanabilir, değiştirebilir ve kendi sunucunuzda çalıştırabilirsiniz. Değiştirilmiş
bir sürümü ağ üzerinden hizmet olarak sunarsanız değişikliklerinizi aynı lisansla yayınlamanız gerekir.
