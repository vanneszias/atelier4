import { definePlugin } from "emdash";
import { submissionSchema, type Submission } from "./validation";
import { z } from "zod";

export function createPlugin() {
  return definePlugin({
    id: "atelier4-community",
    version: "1.0.0",
    capabilities: ["content:read", "network:request"],
    allowedHosts: ["challenges.cloudflare.com"],
    storage: {
      submissions: { indexes: ["type", "createdAt", "updates"] },
      rate_limits: { indexes: ["expiresAt"] },
    },
    admin: {
      entry: new URL("./admin.tsx", import.meta.url).pathname,
      pages: [
        { path: "/submissions", label: "Community & forms", icon: "users" },
      ],
      settingsSchema: {
        openpanelClientId: {
          type: "string",
          label: "OpenPanel client ID",
          description:
            "Public client ID. Analytics run only on live after visitor consent.",
        },
        openpanelApiUrl: {
          type: "url",
          label: "OpenPanel API URL",
          default: "https://api.openpanel.dev",
        },
        turnstileSiteKey: { type: "string", label: "Turnstile site key" },
        turnstileSecret: { type: "secret", label: "Turnstile secret" },
      },
    },
    hooks: {
      cron: async (event, ctx) => {
        if (event.name !== "retention") return;
        const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
        let cursor: string | undefined;
        do {
          const page = await ctx.storage.submissions.query({
            where: { createdAt: { lt: cutoff }, updates: false },
            limit: 100,
            cursor,
          });
          await ctx.storage.submissions.deleteMany(page.items.map((x) => x.id));
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        const rates = await ctx.storage.rate_limits.query({
          where: { expiresAt: { lt: new Date().toISOString() } },
          limit: 100,
        });
        await ctx.storage.rate_limits.deleteMany(rates.items.map((x) => x.id));
      },
      "plugin:activate": async (_event, ctx) => {
        await ctx.cron?.schedule("retention", { schedule: "0 3 * * *" });
      },
    },
    routes: {
      submit: {
        public: true,
        methods: ["POST"],
        request: { body: "json", maxBytes: 16384 },
        handler: async (ctx) => {
          const origin = ctx.request.headers.get("origin");
          if (origin !== new URL(ctx.request.url).origin)
            return { ok: false, error: "ORIGIN" };
          const parsed = submissionSchema.safeParse(ctx.input);
          if (!parsed.success) return { ok: false, error: "VALIDATION" };
          const input = parsed.data;
          if (input.website) return { ok: true };
          const existing = await ctx.storage.submissions.get(
            input.submissionId,
          );
          if (existing) return { ok: true };
          // An atomic bounded limiter, scoped to a salted IP hash and one-minute window.
          let salt = await ctx.kv.get<string>("rate-salt");
          if (!salt) {
            await ctx.kv.compareAndSet("rate-salt", null, crypto.randomUUID());
            salt = await ctx.kv.get<string>("rate-salt");
          }
          const bytes = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              `${salt}:${ctx.requestMeta.ip || "unknown"}:${Math.floor(Date.now() / 60000)}`,
            ),
          );
          const rateKey = Array.from(new Uint8Array(bytes), (x) =>
            x.toString(16).padStart(2, "0"),
          ).join("");
          let limited = true;
          for (let i = 0; i < 5; i++) {
            const state = await ctx.storage.rate_limits.getVersioned(rateKey);
            const count = Number(
              (state?.value as { count?: number })?.count || 0,
            );
            if (count >= 5) break;
            const result = await ctx.storage.rate_limits.compareAndSet(
              rateKey,
              state?.revision ?? null,
              {
                count: count + 1,
                expiresAt: new Date(Date.now() + 120000).toISOString(),
              },
            );
            if (result.applied) {
              limited = false;
              break;
            }
          }
          if (limited) return { ok: false, error: "RATE_LIMIT" };
          const siteKey = await ctx.settings.get<string>("turnstileSiteKey");
          const secret = await ctx.settings.get<string>("turnstileSecret");
          if (siteKey) {
            if (!secret || !input.turnstileToken || !ctx.http)
              return { ok: false, error: "VERIFICATION" };
            const res = await ctx.http.fetch(
              "https://challenges.cloudflare.com/turnstile/v0/siteverify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  secret,
                  response: input.turnstileToken,
                  remoteip: ctx.requestMeta.ip,
                }),
              },
            );
            const verification = (await res.json()) as {
              success?: boolean;
              hostname?: string;
            };
            if (
              !verification.success ||
              verification.hostname !== new URL(ctx.request.url).hostname
            )
              return { ok: false, error: "VERIFICATION" };
          }
          if (input.type === "registration") {
            const event = await ctx.content?.get("events", input.eventId);
            if (
              !event ||
              event.status !== "published" ||
              event.data.registration_open !== true ||
              event.data.event_state !== "open"
            )
              return { ok: false, error: "REGISTRATION_CLOSED" };
            // Capacity-controlled / paid events use the external ticket provider; avoid overselling here.
            if (event.data.capacity || event.data.registration_url)
              return { ok: false, error: "EXTERNAL_REGISTRATION_REQUIRED" };
          }
          const { turnstileToken, website, ...data } = input;
          await ctx.storage.submissions.compareAndSet(
            input.submissionId,
            null,
            {
              ...data,
              createdAt: new Date().toISOString(),
              status: "new",
              consentVersion: "2026-10-06",
            },
          );
          return { ok: true };
        },
      },
      list: {
        permission: "plugins:manage",
        methods: ["GET"],
        handler: async (ctx) => {
          const p = z
            .object({
              cursor: z.string().optional(),
              type: z
                .enum([
                  "community",
                  "newsletter",
                  "artist",
                  "contact",
                  "registration",
                ])
                .optional(),
            })
            .safeParse(ctx.input);
          if (!p.success) return { ok: false };
          return {
            ok: true,
            ...(await ctx.storage.submissions.query({
              where: p.data.type ? { type: p.data.type } : undefined,
              limit: 50,
              orderBy: { createdAt: "desc" },
              cursor: p.data.cursor,
            })),
          };
        },
      },
      delete: {
        permission: "plugins:manage",
        methods: ["POST"],
        handler: async (ctx) => {
          const p = z.object({ id: z.uuid() }).safeParse(ctx.input);
          if (!p.success) return { ok: false };
          return {
            ok: true,
            deleted: await ctx.storage.submissions.delete(p.data.id),
          };
        },
      },
    },
  });
}
export type StoredSubmission = Omit<
  Submission,
  "website" | "turnstileToken"
> & { createdAt: string; status: string; consentVersion: string };
