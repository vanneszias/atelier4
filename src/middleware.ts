import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { getPluginSetting } from "emdash";
import { availabilityKey, isMaintenancePath, maintenanceResponse, readAvailability } from "./lib/maintenance";
import { accessCookie, readSiteAccess, verifyAccessToken } from "./lib/site-access";

export const onRequest = defineMiddleware(async (context, next) => {
  // Use the deployment binding, never a visitor-controlled hostname or cookie.
  if (env.ATELIER4_ENV !== "live" || !isMaintenancePath(context.url.pathname)) {
    return next();
  }
  const stored = await getPluginSetting("atelier4-community", availabilityKey);
  const availability = readAvailability(stored), access = readSiteAccess(stored);
  if (availability.offline) {
    if (!(await verifyAccessToken(context.cookies.get(accessCookie)?.value, access))) {
      return maintenanceResponse(context.request, availability.message, { hasAccessCode: !!access });
    }
  }
  const response = await next();
  // An old public page must not outlive a change to the offline switch.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  if (availability.offline) response.headers.set("X-Robots-Tag", "noindex");
  return response;
});
