import { PLATFORMS, type Actor, type Env } from "./env";
import { cancelPost, createPost, editPost, getPostFor, listPosts, parseWhen, recentAudit, retryPost, toView, type NewPostInput } from "./db";
import { connectionStatus } from "./connections";
import { getBrand, listBrands } from "./brands";
import { analytics, calendar, nextSlots, suggestSlots } from "./insights";
import { AppError, localize, parseLang, type Lang } from "./i18n";
import { APP_NAME, APP_VERSION } from "./config";

/** MCP over Streamable HTTP (stateless, JSON responses), protected by OAuth at /mcp. */

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const brandProp = { type: "string", description: "Brand id (see list_brands), e.g. mybrand" };

const postProps = {
  media_url: { type: "string", description: "Public .mp4 URL that starts with one of the brand's allowlisted prefixes" },
  title: { type: "string", description: "Title (YouTube title, max 100 chars). Not used by Instagram." },
  caption: { type: "string", description: "Description / post text (max 2200 chars)" },
  tags: { type: "array", items: { type: "string" }, description: "YouTube tags" },
  publish_at: { type: "string", description: "Publish time, ISO 8601 with a time zone, e.g. 2026-10-15T10:00:00+04:00. Must be at least a minute ahead and within 60 days." },
};

export const TOOLS = [
  {
    name: "list_brands",
    title: "List brands",
    description: "Lists brands with their video allowlists, daily limits and time zones. Brands can only be created or edited in the dashboard.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_calendar",
    title: "Get the calendar",
    description:
      "Month view of a brand's calendar in the brand's time zone: every post per day, how many are queued per platform and how many slots are left before the daily limit. Check it before scheduling.",
    inputSchema: {
      type: "object",
      properties: { brand: brandProp, month: { type: "string", description: "YYYY-MM, defaults to the current month in the brand's time zone" } },
      required: ["brand"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "suggest_slots",
    title: "Suggest free slots",
    description: "Returns the next free calendar slots (the brand's default posting times, below the daily limit) so you can pick publish_at values without clashes.",
    inputSchema: {
      type: "object",
      properties: {
        brand: brandProp,
        platforms: { type: "array", items: { type: "string", enum: [...PLATFORMS] }, description: "Defaults to all platforms; a slot is only free if it is free on each of them" },
        count: { type: "integer", minimum: 1, maximum: 20, description: "How many slots (default 5)" },
      },
      required: ["brand"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_analytics",
    title: "Publishing analytics",
    description:
      "Publishing statistics for a brand over the last 7, 30 or 90 days: published/failed counts, success rate, per-platform and per-source split, busiest hours, daily series, posting streak and the most frequent errors. Based on Kervly's own queue, not on platform view counts.",
    inputSchema: {
      type: "object",
      properties: { brand: brandProp, days: { type: "integer", enum: [7, 30, 90], description: "Default 30" } },
      required: ["brand"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "schedule_post",
    title: "Schedule a post",
    description:
      "Puts a video into the brand's calendar for one or more platforms. Nothing is published immediately: the scheduler publishes it at publish_at. If publish_at is omitted, the next free default posting time of the brand is used. One post is created per platform.",
    inputSchema: {
      type: "object",
      properties: {
        brand: brandProp,
        platforms: { type: "array", items: { type: "string", enum: [...PLATFORMS] }, minItems: 1, maxItems: 3 },
        ...postProps,
        options: {
          type: "object",
          description:
            "Per-platform options keyed by platform: {youtube:{privacy,category,madeForKids,notifySubscribers}, instagram:{shareToFeed}, tiktok:{privacy,disableComment,disableDuet,disableStitch}}",
        },
      },
      required: ["brand", "platforms", "media_url"],
      additionalProperties: false,
    },
  },
  {
    name: "list_posts",
    title: "List posts",
    description: "Lists scheduled and published posts. Use status=error to find failures.",
    inputSchema: {
      type: "object",
      properties: {
        brand: brandProp,
        status: { type: "string", enum: ["scheduled", "publishing", "processing", "published", "error", "cancelled"] },
        platform: { type: "string", enum: [...PLATFORMS] },
        from: { type: "string", description: "ISO 8601 start (publish_at)" },
        to: { type: "string", description: "ISO 8601 end (publish_at)" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_post",
    title: "Get a post",
    description: "Returns the status and result of a single post.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "update_post",
    title: "Update a post",
    description: "Changes a scheduled post: publish time, video, title, caption, tags or options. Only fields you pass are changed.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, ...postProps, options: { type: "object" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_post",
    title: "Cancel a post",
    description: "Cancels a post that has not been published yet (scheduled or error).",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    annotations: { destructiveHint: true },
  },
  {
    name: "retry_post",
    title: "Retry a post",
    description: "Re-queues a failed post (default: in 1 minute).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, publish_at: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "connection_status",
    title: "Account connections",
    description: "Shows which YouTube, Instagram and TikTok accounts are connected per brand (never includes tokens).",
    inputSchema: { type: "object", properties: { brand: brandProp }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "recent_activity",
    title: "Recent activity",
    description: "Lists recent entries from the audit log.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 200 } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
] as const;

type Args = Record<string, unknown>;

function asId(v: unknown): string {
  if (typeof v !== "string" || !v) throw new AppError("v.id_required");
  return v;
}

export async function callTool(env: Env, actor: Actor, name: string, args: Args, lang: Lang): Promise<unknown> {
  switch (name) {
    case "list_brands":
      return { brands: (await listBrands(env, actor)).map(({ storage, ...b }) => ({ ...b, storage: storage ? { repo: storage.repo, folder: storage.path, prefix: storage.prefix } : null })) };
    case "schedule_post": {
      const platforms = args.platforms;
      if (!Array.isArray(platforms) || platforms.length === 0) throw new AppError("v.platforms_required");
      if (new Set(platforms).size !== platforms.length) throw new AppError("v.platforms_dupe");
      const allOpts = (args.options ?? {}) as Record<string, unknown>;
      if (typeof allOpts !== "object" || Array.isArray(allOpts)) throw new AppError("v.options_object");
      // No time given: take the next free default slot of the brand's calendar (never "right now")
      let publishAt = args.publish_at;
      if (publishAt === undefined || publishAt === null || publishAt === "") {
        const brand = await getBrand(env, args.brand, actor);
        const [slot] = await nextSlots(env, brand, platforms as never, 1);
        if (!slot) throw new AppError("post.no_slot");
        publishAt = slot.publish_at;
      }
      const created = [];
      const errors = [];
      for (const platform of platforms) {
        const input: NewPostInput = {
          platform,
          media_url: args.media_url,
          title: args.title,
          caption: args.caption,
          tags: platform === "youtube" ? args.tags : undefined,
          publish_at: publishAt,
          options: allOpts[platform as string],
        };
        try {
          created.push(await createPost(env, actor, args.brand, input, "mcp", lang));
        } catch (e) {
          errors.push({ platform, error: localize(e, lang) });
        }
      }
      if (!created.length) throw new Error(errors.map((e) => `${e.platform}: ${e.error}`).join("; "));
      return { created, errors };
    }
    case "get_calendar":
      return calendar(env, actor, String(args.brand ?? ""), args.month as string | undefined, lang);
    case "suggest_slots":
      return suggestSlots(env, actor, String(args.brand ?? ""), args.platforms as never, Number(args.count) || 5);
    case "get_analytics":
      return analytics(env, actor, String(args.brand ?? ""), args.days, lang);
    case "list_posts":
      return {
        posts: await listPosts(
          env,
          actor,
          {
            brand: args.brand as string | undefined,
            status: args.status as string | undefined,
            platform: args.platform as string | undefined,
            from: args.from !== undefined ? parseWhen(args.from) : undefined,
            to: args.to !== undefined ? parseWhen(args.to) : undefined,
            limit: args.limit as number | undefined,
          },
          lang,
        ),
      };
    case "get_post": {
      return toView(await getPostFor(env, asId(args.id), actor), lang);
    }
    case "update_post": {
      const { id, ...rest } = args;
      return editPost(env, actor, asId(id), rest, "mcp", lang);
    }
    case "cancel_post":
      return cancelPost(env, actor, asId(args.id), "mcp", lang);
    case "retry_post":
      return retryPost(env, actor, asId(args.id), "mcp", lang, args.publish_at !== undefined ? parseWhen(args.publish_at) : undefined);
    case "connection_status":
      return { connections: await connectionStatus(env, actor, args.brand as string | undefined) };
    case "recent_activity":
      return { activity: await recentAudit(env, actor, lang, Number(args.limit) || 30) };
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function dispatch(env: Env, actor: Actor, req: RpcRequest, lang: Lang) {
  const params = req.params ?? {};
  switch (req.method) {
    case "initialize": {
      const asked = String(params.protocolVersion ?? "");
      return {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: APP_NAME.toLowerCase(), title: APP_NAME, version: APP_VERSION },
        instructions:
          `${APP_NAME}: multi-brand video publishing queue for YouTube Shorts, Instagram Reels and TikTok. ` +
          "Rules: (1) Call list_brands first. (2) Nothing sent over MCP is published immediately: every post goes into the brand's calendar and the scheduler (runs every 5 minutes) publishes it at publish_at. " +
          "(3) Look at get_calendar or suggest_slots before scheduling; respect each brand's daily limit and default posting times. If you omit publish_at, the next free default slot is used. " +
          "(4) Always give publish_at as ISO 8601 with a time zone, at least a minute ahead and at most 60 days out. " +
          "(5) Check list_posts with status=error for failures, retry_post to retry, get_analytics for results.",
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Args;
      if (typeof args !== "object" || Array.isArray(args)) throw new RpcError(-32602, "arguments must be an object");
      try {
        const out = await callTool(env, actor, name, args, lang);
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out as Record<string, unknown>, isError: false };
      } catch (e) {
        if (e instanceof RpcError) throw e;
        return { content: [{ type: "text", text: `Error: ${localize(e, lang)}` }], isError: true };
      }
    }
    default:
      throw new RpcError(-32601, `Method not supported: ${req.method}`);
  }
}

export async function handleMcp(request: Request, env: Env, actor: Actor): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const lang = parseLang(env.MCP_LANG) ?? "en";
  if (Number(request.headers.get("Content-Length") || 0) > 256 * 1024) return Response.json(rpcError(null, -32600, "Request too large"), { status: 413 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Invalid JSON"), { status: 400 });
  }
  if (Array.isArray(body)) return Response.json(rpcError(null, -32600, "Batch requests are not supported"), { status: 400 });
  const req = body as RpcRequest;
  if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") return Response.json(rpcError(null, -32600, "Invalid request"), { status: 400 });
  // Notifications and responses: accept without a body
  if (req.id === undefined) return new Response(null, { status: 202 });
  try {
    return Response.json(rpcResult(req.id, await dispatch(env, actor, req, lang)));
  } catch (e) {
    if (e instanceof RpcError) return Response.json(rpcError(req.id, e.code, e.message));
    console.error("mcp error", e);
    return Response.json(rpcError(req.id, -32603, "Internal error"));
  }
}
