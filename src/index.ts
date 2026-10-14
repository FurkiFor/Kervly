import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { ADMIN_USER, type Env } from "./env";
import { app } from "./app";
import { handleMcp } from "./mcp";
import { runScheduled } from "./publisher";
import { APP_NAME } from "./config";

/** /mcp requires an OAuth access token, which is only issued after the admin signs in and approves. */
const mcpApi: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const props = (ctx as unknown as { props?: { userId?: string } }).props;
    if (props?.userId !== ADMIN_USER) return new Response("Forbidden", { status: 403 });
    return handleMcp(request, env);
  },
};

// The RFC 9728 resource identifier depends on the worker's URL, which is known on the first request.
const providers = new Map<string, OAuthProvider<Env>>();

function providerFor(origin: string): OAuthProvider<Env> {
  let p = providers.get(origin);
  if (!p) {
    if (providers.size > 8) providers.clear();
    p = new OAuthProvider<Env>({
      apiRoute: "/mcp",
      apiHandler: mcpApi as never,
      defaultHandler: app as never,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      scopesSupported: ["publish"],
      resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin], resource_name: APP_NAME },
      accessTokenTTL: 3600,
      refreshTokenTTL: 30 * 24 * 3600,
      // Unused client registrations are removed after 90 days
      clientRegistrationTTL: 90 * 24 * 3600,
    });
    providers.set(origin, p);
  }
  return p;
}

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    // HTTPS only (except local development)
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    return providerFor(url.origin).fetch(req, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env));
  },
} satisfies ExportedHandler<Env>;
