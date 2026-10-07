import { z } from "zod";

export const availabilityKey = "siteAvailability";
export const defaultMaintenanceMessage =
  "We werken even aan onze website. Binnenkort zijn we terug — bedankt voor je geduld!";
export const availabilitySchema = z.object({
  offline: z.boolean(),
  message: z.string().trim().max(3000),
});
export const availabilityUpdateSchema = availabilitySchema.extend({
  accessCode: z.string().trim().min(6).max(128).optional(),
  removeAccessCode: z.boolean().optional(),
}).refine((value) => !(value.accessCode && value.removeAccessCode));
export type SiteAvailability = z.infer<typeof availabilitySchema>;
export function readAvailability(value: unknown): SiteAvailability {
  const parsed = availabilitySchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { offline: false, message: defaultMaintenanceMessage };
}

// All public pages, including unknown paths and feeds, use the same notice.
// The CMS and assets remain available so signing in and restoring the site work.
export function isMaintenancePath(path: string): boolean {
  path = path.replace(/\/+$/, "") || "/";
  if (path === "/site-access/unlock") return false;
  if (path === "/_emdash/api/plugins/atelier4-community/submit") return true;
  return !["/_emdash", "/_astro", "/brand"].some(
    (prefix) => path === prefix || path.startsWith(prefix + "/"),
  ) && path !== "/favicon.svg";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function maintenanceResponse(request: Request, message: string, options: { hasAccessCode?: boolean; error?: string; status?: number; english?: boolean; returnTo?: string } = {}): Response {
  const url = new URL(request.url);
  const english = options.english ?? /^\/en(?:\/|$)/.test(url.pathname);
  const title = english ? "A little work in progress." : "Even achter de schermen.";
  const text = message.trim() || (english
    ? "We’re updating our website. We’ll be back soon — thanks for your patience!"
    : defaultMaintenanceMessage);
  const html = `<!doctype html>
<html lang="${english ? "en" : "nl"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="theme-color" content="#3546e8">
<title>${title} — Atelier 4</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box}body{margin:0;background:#3546e8;color:#f6f3ea;font-family:"Futura",Arial,sans-serif;min-height:100svh;display:flex;flex-direction:column}
header{padding:clamp(1.5rem,4vw,3.5rem);display:flex;align-items:center;gap:.9rem;font-size:1.2rem;font-weight:800;letter-spacing:-.04em}
header img{width:2.8rem;height:auto;filter:brightness(0) invert(1)}main{flex:1;display:flex;flex-direction:column;justify-content:center;width:min(76rem,100%);padding:clamp(2rem,7vw,6rem);margin-inline:auto}
h1{max-width:12ch;font-size:clamp(3rem,8vw,7.5rem);letter-spacing:-.06em;line-height:1.02;text-transform:uppercase;margin:0 0 2rem;overflow-wrap:break-word;text-wrap:balance}
p{font-size:clamp(1.125rem,2vw,1.5rem);line-height:1.65;max-width:48ch;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
footer{background:#dce735;color:#20201e;padding:1.25rem clamp(1.5rem,4vw,3.5rem);font-weight:700;font-size:1rem}
::selection{background:#dce735;color:#20201e}
form{display:grid;gap:.75rem;margin-top:2rem;max-width:28rem}label{font-size:1rem;font-weight:700}input,button{font:inherit;border-radius:3px;min-height:3rem;padding:.75rem 1rem}input{border:1px solid #f6f3ea;background:transparent;color:inherit;min-width:0;width:100%}button{border:0;background:#dce735;color:#20201e;font-weight:700;cursor:pointer;transition:background .2s,transform .2s}button:hover{background:#f6f3ea;transform:translateY(-2px)}input:focus-visible,button:focus-visible{outline:3px solid #dce735;outline-offset:4px}.access-error{font-size:1rem;margin:0}.access-help{font-size:.875rem;opacity:.85}
</style></head><body><header><img src="/brand/mark.svg" alt="" width="430" height="370">ATELIER 4</header>
<main><h1>${title}</h1><p>${escapeHtml(text)}</p>${options.hasAccessCode ? `
<form method="post" action="/site-access/unlock"><label for="access-code">${english ? "Have an access code?" : "Heb je een toegangscode?"}</label>
<input id="access-code" name="code" type="password" required maxlength="128" autocomplete="current-password"${options.error ? ' aria-invalid="true" aria-describedby="access-error"' : ""}>
<input type="hidden" name="next" value="${escapeHtml(options.returnTo ?? (url.pathname + url.search))}">
${options.error ? `<p id="access-error" class="access-error" role="alert">${escapeHtml(options.error)}</p>` : ""}
<button type="submit">${english ? "Enter the website" : "Bekijk de website"}</button>
<p class="access-help">${english ? "Access is remembered in this browser for seven days." : "Je toegang wordt zeven dagen onthouden in deze browser."}</p></form>` : ""}</main>
<footer>Muziek · Atelier · Drama · Dans</footer></body></html>`;
  return new Response(request.method === "HEAD" ? null : html, {
    status: options.status ?? 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Retry-After": "300",
      "X-Robots-Tag": "noindex",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
