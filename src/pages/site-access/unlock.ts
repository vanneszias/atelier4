import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPluginSetting } from "emdash";
import { availabilityKey, maintenanceResponse, readAvailability } from "../../lib/maintenance";
import { accessCookie, accessDuration, accessReturnPath, allowAccessAttempt, releaseAccessAttempt, issueAccessToken, readSiteAccess, verifyAccessCode } from "../../lib/site-access";

export const POST: APIRoute = async ({ request, url }) => {
  if (env.ATELIER4_ENV !== "live") return new Response(null, { status: 404 });
  const stored = await getPluginSetting("atelier4-community", availabilityKey);
  const availability = readAvailability(stored), access = readSiteAccess(stored);
  if (!availability.offline || !access) return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "no-store" } });
  const english = request.headers.get("referer")?.startsWith(url.origin + "/en");
  const reject = (status: number, message: string, next?: string) => maintenanceResponse(request, availability.message, {
    hasAccessCode: true, error: message, status, english, returnTo: next,
  });
  if (request.headers.get("origin") !== url.origin) return reject(403, english ? "Please enter the code on this website." : "Vul de code in op deze website.");
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return reject(400, "Invalid request.");
  // Bound the input before parsing it, including chunked requests.
  const reader = request.body?.getReader();
  let raw = "", size = 0;
  if (reader) {
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4096) { await reader.cancel(); return reject(413, "Invalid request."); }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
  }
  const form = new URLSearchParams(raw);
  const next = accessReturnPath(form.get("next"), url.origin);
  // Cloudflare overwrites this header; never use caller-controlled forwarded IPs.
  const attempt = await allowAccessAttempt(env.DB, request.headers.get("cf-connecting-ip") || "local", access);
  if (!attempt) {
    const response = reject(429, english ? "Too many attempts. Please try again in ten minutes." : "Te veel pogingen. Probeer het over tien minuten opnieuw.", next);
    response.headers.set("Retry-After", "600");
    return response;
  }
  if (!(await verifyAccessCode(form.get("code") ?? "", access))) {
    return reject(403, english ? "That code is not correct. Please try again." : "Die code klopt niet. Probeer het opnieuw.", next);
  }
  await releaseAccessAttempt(env.DB, attempt);
  const token = await issueAccessToken(access);
  return new Response(null, { status: 303, headers: {
    Location: next,
    "Cache-Control": "private, no-store",
    "Set-Cookie": `${accessCookie}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${accessDuration}`,
    "X-Robots-Tag": "noindex",
  } });
};
