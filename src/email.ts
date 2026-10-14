import type { Env } from "./env";
import type { Lang } from "./i18n";
import { APP_NAME } from "./config";
import { esc } from "./http";

/**
 * Account emails. Providers, in order: Cloudflare Email Service binding (EMAIL), Resend (RESEND_API_KEY).
 * Without a provider the email is not sent and the link is logged, which is fine for local development
 * and for single-admin self-hosting where registration is closed.
 */
export function emailConfigured(env: Env): boolean {
  return Boolean(env.EMAIL_FROM && (env.EMAIL || env.RESEND_API_KEY));
}

export async function sendEmail(env: Env, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const from = env.EMAIL_FROM || "";
  if (env.EMAIL && from) {
    await env.EMAIL.send({ from: parseFrom(from), to, subject, html, text });
    return true;
  }
  if (env.RESEND_API_KEY && from) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!r.ok) throw new Error(`Resend HTTP ${r.status}`);
    return true;
  }
  console.log(`[email not configured] to=${to} subject=${subject}\n${text}`);
  return false;
}

function parseFrom(from: string): { email: string; name?: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
}

const COPY = {
  verify: {
    en: { subject: `Confirm your ${APP_NAME} email`, title: "Confirm your email", body: "Click the button to confirm your email address and choose your password. The link is valid for 24 hours.", cta: "Confirm & set password" },
    tr: { subject: `${APP_NAME} e-posta adresinizi doğrulayın`, title: "E-postanızı doğrulayın", body: "E-posta adresinizi doğrulamak ve parolanızı belirlemek için düğmeye tıklayın. Bağlantı 24 saat geçerlidir.", cta: "Doğrula ve parola belirle" },
  },
  exists: {
    en: { subject: `Your ${APP_NAME} account`, title: "You already have an account", body: "Someone (hopefully you) tried to sign up with this address, but it already has an account. Sign in, or use \"Forgot password\" if you need a new one.", cta: "Sign in" },
    tr: { subject: `${APP_NAME} hesabınız`, title: "Zaten bir hesabınız var", body: "Birisi (umarız siz) bu adresle kayıt olmaya çalıştı ama adrese ait bir hesap zaten var. Giriş yapın ya da gerekirse \"Parolamı unuttum\"u kullanın.", cta: "Giriş yap" },
  },
  reset: {
    en: { subject: `Reset your ${APP_NAME} password`, title: "Reset your password", body: "Someone asked to reset your password. If it was you, click the button. The link is valid for 1 hour.", cta: "Choose a new password" },
    tr: { subject: `${APP_NAME} parolanızı sıfırlayın`, title: "Parolanızı sıfırlayın", body: "Parolanızı sıfırlama isteği aldık. Siz istediyseniz düğmeye tıklayın. Bağlantı 1 saat geçerlidir.", cta: "Yeni parola belirle" },
  },
  approved: {
    en: { subject: `Your ${APP_NAME} account is ready`, title: "You're in!", body: "Your account has been approved. You can sign in now.", cta: "Sign in" },
    tr: { subject: `${APP_NAME} hesabınız hazır`, title: "Hoş geldiniz!", body: "Hesabınız onaylandı. Artık giriş yapabilirsiniz.", cta: "Giriş yap" },
  },
} as const;

export type EmailKind = keyof typeof COPY;

export function renderEmail(kind: EmailKind, lang: Lang, link: string) {
  const c = COPY[kind][lang];
  const ignore = lang === "tr" ? "Bu e-postayı siz istemediyseniz yok sayabilirsiniz." : "If you didn't request this, you can ignore this email.";
  const html = `<!doctype html><html><body style="margin:0;background:#f7f6f3;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e7e3dd;border-radius:14px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<div style="font-weight:800;font-size:18px;color:#c2410c">${APP_NAME}</div>
<h1 style="font-size:20px;margin:18px 0 8px">${esc(c.title)}</h1>
<p style="font-size:15px;line-height:1.5;color:#44403c">${esc(c.body)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">${esc(c.cta)}</a></p>
<p style="font-size:12px;color:#78716c;word-break:break-all">${esc(link)}</p>
<p style="font-size:12px;color:#a8a29e">${esc(ignore)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${c.title}\n\n${c.body}\n\n${link}\n\n${ignore}`;
  return { subject: c.subject, html, text };
}

export async function sendAccountEmail(env: Env, kind: EmailKind, lang: Lang, to: string, link: string): Promise<boolean> {
  const m = renderEmail(kind, lang, link);
  return sendEmail(env, to, m.subject, m.html, m.text);
}
