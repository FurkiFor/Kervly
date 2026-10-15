import { PLATFORMS, type Actor, type Env } from "./env";
import { audit, cancelPost, createPost, editPost, getPostFor, listPosts, parseWhen, recentAudit, retryPost, toView, type NewPostInput } from "./db";
import { connectionStatus } from "./connections";
import { getBrand, getBrandRow, listBrands, resolveBrandId } from "./brands";
import { youtubeStats } from "./youtube-stats";
import { youtubeInsights, youtubeVideos } from "./youtube-insights";
import { FILE_RE, downloadVideo, requireMp4, sanitizeFileName, signedUploadUrl, storagePrefix, uploadToStorage, UPLOAD_LINK_TTL_MS, MAX_UPLOAD_MB } from "./storage";
import { analytics, calendar, nextSlots, suggestSlots } from "./insights";
import { AppError, localize, parseLang, type Lang } from "./i18n";
import { APP_NAME, APP_VERSION } from "./config";

/** MCP over Streamable HTTP (stateless, JSON responses), protected by OAuth at /mcp. */

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const brandProp = { type: "string", description: "Brand id (see list_brands), e.g. mybrand. Optional when you have only one brand." };

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
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_youtube_stats",
    title: "YouTube channel statistics",
    description:
      "Live statistics of the brand's connected YouTube channel (subscribers, total views, video count) plus views, likes and comments of the videos Kervly published. Needs the read-only permission: if it is missing, reconnect YouTube in the dashboard Setup.",
    inputSchema: { type: "object", properties: { brand: brandProp }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_youtube_videos",
    title: "YouTube videos with details",
    description:
      "The channel's latest uploads with everything YouTube knows: title, full description, tags, hashtags, category, duration, whether it is a Short, privacy, language, publish time, views, likes, comments, engagement rate and views per day. Use it to study what works and to write better titles, descriptions and tags. Needs the YouTube read-only permission.",
    inputSchema: {
      type: "object",
      properties: {
        brand: brandProp,
        limit: { type: "integer", minimum: 1, maximum: 50, description: "How many videos (default 20)" },
        sort: { type: "string", enum: ["recent", "views", "likes", "comments", "engagement"], description: "Default recent" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_youtube_insights",
    title: "YouTube insights",
    description:
      "Analysis of the brand's YouTube channel: channel totals, averages (views, likes, engagement, duration, title length, tags), best and worst videos, which weekday / hour / duration / title length / tags perform best, plus YouTube Analytics for the period (daily views, watch minutes, subscribers gained, traffic sources, top countries, average view duration per video) when that permission and API are available.",
    inputSchema: {
      type: "object",
      properties: { brand: brandProp, days: { type: "integer", enum: [7, 28, 90], description: "Analytics period, default 28" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_analytics",
    title: "Publishing analytics",
    description:
      "Publishing statistics for a brand over the last 7, 30 or 90 days: published/failed counts, success rate, per-platform and per-source split, busiest hours, daily series, posting streak and the most frequent errors. Based on Kervly's own queue; for YouTube views, likes and subscribers use get_youtube_stats.",
    inputSchema: {
      type: "object",
      properties: { brand: brandProp, days: { type: "integer", enum: [7, 30, 90], description: "Default 30" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "upload_video",
    title: "Upload a video to the brand's GitHub folder",
    description:
      `Kervly downloads the video from a public https link and commits it to the brand's GitHub storage folder (the brand needs GitHub storage in the dashboard). The link must announce the file size and the file must be an MP4 of at most ${MAX_UPLOAD_MB} MB. Returns the media_url to use with schedule_post. If the video only exists on your side, use create_upload_link instead.`,
    inputSchema: {
      type: "object",
      properties: {
        brand: brandProp,
        source_url: { type: "string", description: "Public https link to the .mp4" },
        file_name: { type: "string", description: "File name in the repository (letters, digits, - _ .). Defaults to the name in the link; .mp4 is added." },
      },
      required: ["source_url"],
      additionalProperties: false,
    },
  },
  {
    name: "create_upload_link",
    title: "Create a link to upload a video",
    description:
      `Returns a one-time style upload link (valid ${UPLOAD_LINK_TTL_MS / 60000} minutes) for a video you have as a file: send it with an HTTP PUT (for example curl -X PUT --data-binary @video.mp4 "<upload_url>") and Kervly commits it to the brand's GitHub storage folder. MP4 only, at most ${MAX_UPLOAD_MB} MB. The result includes the media_url to use with schedule_post once the upload has finished.`,
    inputSchema: {
      type: "object",
      properties: {
        brand: brandProp,
        file_name: { type: "string", description: "File name in the repository (letters, digits, - _ .). .mp4 is added." },
      },
      required: ["file_name"],
      additionalProperties: false,
    },
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
            "Per-platform options keyed by platform: {youtube:{privacy: public|unlisted|private, category: e.g. EDUCATION|ENTERTAINMENT|PEOPLE_BLOGS|MUSIC|GAMING|SCIENCE_TECH|NEWS_POLITICS|HOWTO_STYLE…, madeForKids, notifySubscribers, language (e.g. en, tr, ar), audioLanguage, license: youtube|creativeCommon, embeddable, publicStatsViewable, aiGenerated (disclose realistic AI-generated content)}, instagram:{shareToFeed}, tiktok:{privacy,disableComment,disableDuet,disableStitch}}",
        },
      },
      required: ["platforms", "media_url"],
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

export async function callTool(env: Env, actor: Actor, name: string, args: Args, lang: Lang, origin = ""): Promise<unknown> {
  switch (name) {
    case "list_brands":
      return { brands: (await listBrands(env, actor)).map(({ storage, ...b }) => ({ ...b, storage: storage ? { repo: storage.repo, folder: storage.path, prefix: storage.prefix } : null })) };
    case "schedule_post": {
      const brandId = await resolveBrandId(env, actor, args.brand);
      const platforms = args.platforms;
      if (!Array.isArray(platforms) || platforms.length === 0) throw new AppError("v.platforms_required");
      if (new Set(platforms).size !== platforms.length) throw new AppError("v.platforms_dupe");
      const allOpts = (args.options ?? {}) as Record<string, unknown>;
      if (typeof allOpts !== "object" || Array.isArray(allOpts)) throw new AppError("v.options_object");
      // No time given: take the next free default slot of the brand's calendar (never "right now")
      let publishAt = args.publish_at;
      if (publishAt === undefined || publishAt === null || publishAt === "") {
        const brand = await getBrand(env, brandId, actor);
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
          created.push(await createPost(env, actor, brandId, input, "mcp", lang));
        } catch (e) {
          errors.push({ platform, error: localize(e, lang) });
        }
      }
      if (!created.length) throw new Error(errors.map((e) => `${e.platform}: ${e.error}`).join("; "));
      return { created, errors };
    }
    case "upload_video": {
      const row = await getBrandRow(env, await resolveBrandId(env, actor, args.brand), actor);
      if (typeof args.source_url !== "string" || !args.source_url) throw new AppError("s.source_invalid");
      const name = sanitizeFileName(typeof args.file_name === "string" && args.file_name ? args.file_name : args.source_url);
      const { body, size } = await downloadVideo(args.source_url);
      const file = await uploadToStorage(env, row, name, await requireMp4(body), size, actor.email);
      await audit(env, `mcp:${actor.email}`, "media.upload", `${row.id}/${file.name} ${(size / 1048576).toFixed(1)}MB (mcp)`, { user: actor.id, brand: row.id });
      return { brand: row.id, ...file, path: `${row.storage_path ? row.storage_path + "/" : ""}${file.name}`, committed_to: row.storage_repo, media_url: file.url };
    }
    case "create_upload_link": {
      const row = await getBrandRow(env, await resolveBrandId(env, actor, args.brand), actor);
      const prefix = storagePrefix(row);
      if (!prefix || !row.storage_token_enc) throw new AppError("s.not_configured");
      const name = sanitizeFileName(String(args.file_name ?? ""));
      if (!FILE_RE.test(name)) throw new AppError("s.file_name");
      const url = await signedUploadUrl(env, env.PUBLIC_URL || origin, row.id, name);
      return {
        brand: row.id,
        method: "PUT",
        upload_url: url,
        expires_in_minutes: UPLOAD_LINK_TTL_MS / 60000,
        max_mb: MAX_UPLOAD_MB,
        content_type: "video/mp4",
        curl: `curl -X PUT -H "Content-Type: video/mp4" --data-binary @${name} "${url}"`,
        media_url: prefix + name,
        note: "media_url works with schedule_post after the upload has succeeded.",
      };
    }
    case "get_calendar":
      return calendar(env, actor, await resolveBrandId(env, actor, args.brand), args.month as string | undefined, lang);
    case "suggest_slots":
      return suggestSlots(env, actor, await resolveBrandId(env, actor, args.brand), args.platforms as never, Number(args.count) || 5);
    case "get_analytics":
      return analytics(env, actor, await resolveBrandId(env, actor, args.brand), args.days, lang);
    case "get_youtube_videos":
      return youtubeVideos(env, actor, await resolveBrandId(env, actor, args.brand), { limit: Number(args.limit) || undefined, sort: args.sort as string | undefined, descriptionMax: 2000 });
    case "get_youtube_insights": {
      const r = await youtubeInsights(env, actor, await resolveBrandId(env, actor, args.brand), args.days, lang);
      // Details of single videos come from get_youtube_videos; keep this answer compact
      return { ...r, videos: r.videos.map((v) => ({ id: v.id, title: v.title, published_at: v.published_at, duration_seconds: v.duration_seconds, views: v.views, likes: v.likes, comments: v.comments, engagement_rate: v.engagement_rate })) };
    }
    case "get_youtube_stats":
      return youtubeStats(env, actor, await resolveBrandId(env, actor, args.brand));
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

async function dispatch(env: Env, actor: Actor, req: RpcRequest, lang: Lang, origin: string) {
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
          "(5) To get a video into the brand's GitHub storage: upload_video (Kervly downloads it from a public https link) or create_upload_link (you PUT the file yourself), then use the returned media_url in schedule_post. (6) Check list_posts with status=error for failures, retry_post to retry, get_analytics for publishing results, get_youtube_stats for channel totals, get_youtube_videos for per-video details (description, tags, views) and get_youtube_insights for what performs best. (7) The brand parameter can be left out when the user has only one brand.",
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
        const out = await callTool(env, actor, name, args, lang, origin);
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
    return Response.json(rpcResult(req.id, await dispatch(env, actor, req, lang, new URL(request.url).origin)));
  } catch (e) {
    if (e instanceof RpcError) return Response.json(rpcError(req.id, e.code, e.message));
    console.error("mcp error", e);
    return Response.json(rpcError(req.id, -32603, "Internal error"));
  }
}
