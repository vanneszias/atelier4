import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { getPluginSetting } from "emdash";
import { availabilityKey, isMaintenancePath, maintenanceResponse, readAvailability } from "./lib/maintenance";

export const onRequest = defineMiddleware(async (context, next) => {
  // Use the deployment binding, never a visitor-controlled hostname or cookie.
  if (env.ATELIER4_ENV !== "live" || !isMaintenancePath(context.url.pathname)) {
    return next();
  }
  const availability = readAvailability(
    await getPluginSetting("atelier4-community", availabilityKey),
  );
  if (availability.offline) {
    return maintenanceResponse(context.request, availability.message);
  }
  const response = await next();
  // An old public page must not outlive a change to the offline switch.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});
