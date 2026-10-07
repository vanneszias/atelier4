// Server-only access credentials. Never return this object through the admin API.
export type SiteAccess = { salt: string; hash: string; sessionKey: string };
export const accessCookie = "__Host-atelier4-access";
export const accessDuration = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
const unhex = (value: string) => new Uint8Array(value.match(/../g)!.map((byte) => parseInt(byte, 16)));

export function readSiteAccess(value: unknown): SiteAccess | undefined {
  if (!value || typeof value !== "object") return;
  const access = (value as { access?: Partial<SiteAccess> }).access;
  if (access && /^[a-f0-9]{32}$/.test(access.salt ?? "") &&
    /^[a-f0-9]{64}$/.test(access.hash ?? "") && /^[a-f0-9]{64}$/.test(access.sessionKey ?? "")) {
    return access as SiteAccess;
  }
}

async function deriveCode(code: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(code.trim()), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unhex(salt), iterations: 100000, hash: "SHA-256" }, key, 256));
}

export async function createSiteAccess(code: string): Promise<SiteAccess> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await deriveCode(code, salt), sessionKey: hex(crypto.getRandomValues(new Uint8Array(32))) };
}

export async function verifyAccessCode(code: string, access: SiteAccess): Promise<boolean> {
  if (code.trim().length < 6 || code.length > 128) return false;
  const actual = await deriveCode(code, access.salt);
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ access.hash.charCodeAt(index);
  return difference === 0;
}

async function signingKey(access: SiteAccess) {
  return crypto.subtle.importKey("raw", unhex(access.sessionKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueAccessToken(access: SiteAccess, now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + accessDuration;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(access), encoder.encode(`atelier4-access:${expires}`));
  return `${expires}.${hex(signature)}`;
}

export async function verifyAccessToken(token: string | undefined, access: SiteAccess | undefined, now = Date.now()): Promise<boolean> {
  if (!access || !token || !/^\d{10,13}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expiry, signature] = token.split(".");
  const expires = Number(expiry), current = Math.floor(now / 1000);
  if (expires <= current || expires > current + accessDuration) return false;
  return crypto.subtle.verify("HMAC", await signingKey(access), unhex(signature), encoder.encode(`atelier4-access:${expiry}`));
}

export function accessReturnPath(value: string | null, origin: string): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname.startsWith("/site-access")) return "/";
    return url.pathname + url.search;
  } catch { return "/"; }
}

// Ten guesses per IP in a ten-minute window, shared across Worker instances.
// Store an IP digest only; expired counters are removed as visitors use this flow.
export async function allowAccessAttempt(db: D1Database, ip: string, access: SiteAccess, now = Date.now()): Promise<string | undefined> {
  const digest = hex(await crypto.subtle.sign("HMAC", await signingKey(access), encoder.encode(`attempt:${ip}`)));
  const bucket = Math.floor(now / 600000);
  const name = `plugin:atelier4-community:access-rate:${digest}:${bucket}`;
  const statements = [
    db.prepare("DELETE FROM options WHERE name LIKE 'plugin:atelier4-community:access-rate:%' AND json_extract(value, '$.expires') < ?").bind(now),
    db.prepare("INSERT INTO options (name, value, revision) VALUES (?, json_object('count', 1, 'expires', ?), ?) ON CONFLICT(name) DO UPDATE SET value = json_set(options.value, '$.count', json_extract(options.value, '$.count') + 1) WHERE json_extract(options.value, '$.count') < 10 RETURNING name")
      .bind(name, (bucket + 2) * 600000, crypto.randomUUID()),
  ];
  const result = await db.batch(statements);
  return (result[1].results?.length ?? 0) > 0 ? name : undefined;
}

export async function releaseAccessAttempt(db: D1Database, name: string): Promise<void> {
  // Successful visitors do not consume the failed-guess limit on shared Wi-Fi.
  await db.prepare("UPDATE options SET value = json_set(value, '$.count', max(json_extract(value, '$.count') - 1, 0)) WHERE name = ?")
    .bind(name).run();
}
