import type { Env } from "./env";
import { audit, dueCandidates, lockForPoll, lockForPublish, markInterrupted, updatePost, type PostRow } from "./db";
import { ADAPTERS, getAccount, refreshAllConnections } from "./connections";
import { probeMedia } from "./media";
import { AppError, localize, storeMsg } from "./i18n";
import { PlatformError, type StepResult } from "./platforms/types";

const MAX_ATTEMPTS = 3;

function isRetryable(e: unknown): boolean {
  if (e instanceof PlatformError) return e.retryable;
  if (e instanceof AppError) return false;
  return /fetch failed|network|timed? ?out|ECONN/i.test(String((e as Error)?.message ?? e));
}

const logText = (e: unknown) => localize(e, "en").slice(0, 400);

async function applyResult(env: Env, post: PostRow, res: StepResult, keepLockUntil = 0): Promise<void> {
  const note = res.note ? JSON.stringify({ k: res.note }) : null;
  if (res.state === "published") {
    await updatePost(env, post.id, { status: "published", external_id: res.external_id, result_url: res.result_url, error: note, locked_until: 0 });
    await audit(env, "system", "post.published", `${post.id} ${post.brand_id}/${post.platform} ${res.external_id}`);
  } else {
    await updatePost(env, post.id, { status: "processing", remote_ref: res.remote_ref, error: note, locked_until: keepLockUntil });
  }
}

/** Upload stage: scheduled → publishing → (published | processing | scheduled[retry] | error). */
async function publish(env: Env, post: PostRow): Promise<void> {
  let res: StepResult;
  try {
    const account = await getAccount(env, post.brand_id, post.platform);
    await probeMedia(post.media_url);
    res = await ADAPTERS[post.platform].start(env, post, account);
  } catch (e) {
    if (isRetryable(e) && post.attempts < MAX_ATTEMPTS) {
      await updatePost(env, post.id, {
        status: "scheduled",
        error: storeMsg(new AppError("post.retry_later", { reason: e instanceof AppError ? e : String(e) })),
        locked_until: Date.now() + 5 * 60_000,
      });
      await audit(env, "system", "post.retry_later", `${post.id} ${logText(e)}`);
    } else {
      await updatePost(env, post.id, { status: "error", error: storeMsg(e), locked_until: 0 });
      await audit(env, "system", "post.error", `${post.id} ${post.brand_id}/${post.platform} ${logText(e)}`);
    }
    return;
  }
  // The upload is done: from here on no error can send the post back to be uploaded again.
  if (res.state === "published") {
    await applyResult(env, post, res);
    return;
  }
  // Processing: keep the lock, check once after 15 s; on failure the next cron run asks again.
  await applyResult(env, post, res, Date.now() + 60_000);
  await new Promise((r) => setTimeout(r, 15_000));
  await poll(env, { ...post, status: "processing", remote_ref: res.remote_ref });
}

/** Processing stage: processing → (published | processing | error). Never re-uploads. */
async function poll(env: Env, post: PostRow): Promise<void> {
  try {
    const account = await getAccount(env, post.brand_id, post.platform);
    const res = await ADAPTERS[post.platform].poll(env, post, account);
    await applyResult(env, post, res);
  } catch (e) {
    if (isRetryable(e)) {
      await updatePost(env, post.id, { error: storeMsg(new AppError("post.poll_retry", { reason: e instanceof AppError ? e : String(e) })), locked_until: 0 });
    } else {
      await updatePost(env, post.id, { status: "error", error: storeMsg(e), locked_until: 0 });
      await audit(env, "system", "post.error", `${post.id} ${post.brand_id}/${post.platform} ${logText(e)}`);
    }
  }
}

export async function runScheduled(env: Env): Promise<void> {
  const started = Date.now();
  for (const c of await dueCandidates(env, started)) {
    // Don't start new uploads late in the run (a cron run may last at most 15 minutes)
    if (Date.now() - started > 10 * 60_000) break;
    const now = Date.now();
    if (c.status === "publishing") {
      if (await markInterrupted(env, c.id, now)) await audit(env, "system", "post.interrupted", c.id);
      continue;
    }
    if (c.status === "processing") {
      const row = await lockForPoll(env, c.id, now);
      if (row) await poll(env, row);
      continue;
    }
    const row = await lockForPublish(env, c.id, now);
    if (row) await publish(env, row);
  }
  // Hourly token refresh check
  if (new Date(started).getUTCMinutes() < 5) await refreshAllConnections(env);
}
