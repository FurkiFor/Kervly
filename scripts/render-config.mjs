#!/usr/bin/env node
// Writes wrangler.deploy.json = wrangler.jsonc + your deployment values from environment variables.
// Keeps personal resource ids out of the repository. Usage: node scripts/render-config.mjs
import { readFileSync, writeFileSync } from "node:fs";

/** Removes // and /* *\/ comments outside of strings, then trailing commas. */
function parseJsonc(text) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") out += text[++i];
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const env = process.env;
const cfg = parseJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
delete cfg.$schema;

function need(name, re) {
  const v = (env[name] || "").trim();
  if (!re.test(v)) {
    console.error(`::error::${name} is missing or invalid. Set it as a GitHub repository variable (Settings → Secrets and variables → Actions → Variables).`);
    process.exit(1);
  }
  return v;
}

cfg.name = (env.WORKER_NAME || cfg.name).trim();
if (!/^[a-z0-9-]{1,63}$/.test(cfg.name)) throw new Error("WORKER_NAME is invalid");
cfg.d1_databases[0].database_id = need("D1_DATABASE_ID", /^[0-9a-f-]{36}$/);
if (env.D1_DATABASE_NAME) cfg.d1_databases[0].database_name = env.D1_DATABASE_NAME.trim();
cfg.kv_namespaces.find((k) => k.binding === "OAUTH_KV").id = need("KV_OAUTH_ID", /^[0-9a-f]{32}$/);
cfg.kv_namespaces.find((k) => k.binding === "SESSIONS").id = need("KV_SESSIONS_ID", /^[0-9a-f]{32}$/);

// Optional custom domain, e.g. app.example.com (the zone must be on Cloudflare)
if (env.CUSTOM_DOMAIN) {
  const d = env.CUSTOM_DOMAIN.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) throw new Error("CUSTOM_DOMAIN is invalid");
  cfg.routes = [{ pattern: d, custom_domain: true }];
}

// Optional overrides for non-secret settings
for (const k of Object.keys(cfg.vars)) {
  if (env[k] !== undefined && env[k] !== "") cfg.vars[k] = String(env[k]).trim();
}

writeFileSync(new URL("../wrangler.deploy.json", import.meta.url), JSON.stringify(cfg, null, 2) + "\n");
console.log(`wrangler.deploy.json written for worker "${cfg.name}"${cfg.routes ? ` on ${cfg.routes[0].pattern}` : ""}`);
