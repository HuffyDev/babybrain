import { TwitterApi, type TwitterApiReadOnly } from "twitter-api-v2";
import { env } from "../../../env";
import { launchMs, speed } from "../../clock";
import type { Mention, SocialAdapter } from "../types";

/**
 * X API v2 (pay-per-use). Only: mentions timeline, post, reply.
 * Quote-posts and likes are not available on pay-per-use and are deliberately not implemented.
 */
let writer: TwitterApi | null = null;
let reader: TwitterApiReadOnly | null = null;
let handle: string | null = env.X_BOT_HANDLE ?? null;
let userId: string | null = env.X_BOT_USER_ID ?? null;

function getWriter(): TwitterApi {
  if (writer) return writer;
  if (!env.X_API_KEY || !env.X_API_SECRET || !env.X_ACCESS_TOKEN || !env.X_ACCESS_SECRET)
    throw new Error("X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET are required to post");
  writer = new TwitterApi({ appKey: env.X_API_KEY, appSecret: env.X_API_SECRET, accessToken: env.X_ACCESS_TOKEN, accessSecret: env.X_ACCESS_SECRET });
  return writer;
}

function getReader(): TwitterApiReadOnly {
  if (reader) return reader;
  reader = env.X_BEARER_TOKEN ? new TwitterApi(env.X_BEARER_TOKEN).readOnly : getWriter().readOnly;
  return reader;
}

async function me() {
  if (handle && userId) return { handle, userId };
  const u = await getWriter().v2.me();
  handle = u.data.username;
  userId = u.data.id;
  return { handle, userId };
}

const statusUrl = (id: string) => `https://x.com/${handle ?? "i"}/status/${id}`;

export const liveX: SocialAdapter = {
  simulated: false,

  async fetchMentions(sinceId) {
    const { userId: id } = await me();
    const res = await getReader().v2.userMentionTimeline(id, {
      ...(sinceId ? { since_id: sinceId } : {}),
      max_results: 50,
      expansions: ["author_id"],
      "tweet.fields": ["created_at", "public_metrics", "author_id"],
      "user.fields": ["username", "public_metrics"],
    });
    const users = new Map((res.includes?.users ?? []).map((u) => [u.id, u]));
    const launch = launchMs() ?? Date.now();
    const out: Mention[] = [];
    for (const t of res.tweets ?? []) {
      const u = t.author_id ? users.get(t.author_id) : undefined;
      if (!u || u.id === id) continue;
      const created = t.created_at ? new Date(t.created_at).getTime() : Date.now();
      out.push({
        id: t.id,
        ageS: Math.max(0, Math.floor(((created - launch) / 1000) * speed)),
        handle: u.username,
        text: t.text,
        followers: u.public_metrics?.followers_count ?? 0,
        likes: t.public_metrics?.like_count ?? 0,
        replies: t.public_metrics?.reply_count ?? 0,
        minorFlag: false, // content-based minor detection runs in social.ts
      });
    }
    return out;
  },

  async post(text) {
    await me();
    const r = await getWriter().v2.tweet(text);
    return { id: r.data.id, url: statusUrl(r.data.id) };
  },

  async reply(inReplyToId, text) {
    await me();
    const r = await getWriter().v2.reply(text, inReplyToId);
    return { id: r.data.id, url: statusUrl(r.data.id) };
  },
};
