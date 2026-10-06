import { OpenPanel } from "@openpanel/web";
declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}
const panel = document.querySelector<HTMLElement>("[data-analytics-consent]");
if (panel) {
  const key = "atelier4:analytics:v1";
  let client: OpenPanel | undefined;
  const read = () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const save = (value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  };
  const start = () => {
    if (
      client ||
      !panel.dataset.clientId ||
      navigator.globalPrivacyControl ||
      navigator.doNotTrack === "1"
    )
      return;
    client = new OpenPanel({
      clientId: panel.dataset.clientId,
      apiUrl: panel.dataset.apiUrl,
      trackScreenViews: false,
      trackOutgoingLinks: false,
      trackAttributes: false,
    });
    client.track("screen_view", {
      path: location.pathname,
      origin: location.origin,
    });
  };
  if (read() === "allowed") start();
  else if (
    !read() &&
    navigator.doNotTrack !== "1" &&
    !navigator.globalPrivacyControl
  )
    panel.hidden = false;
  panel
    .querySelector("[data-analytics-allow]")
    ?.addEventListener("click", () => {
      save("allowed");
      panel.hidden = true;
      start();
    });
  panel
    .querySelector("[data-analytics-deny]")
    ?.addEventListener("click", () => {
      save("denied");
      panel.hidden = true;
      if (client) location.reload();
    });
  document
    .querySelector("[data-analytics-settings]")
    ?.addEventListener("click", () => {
      panel.hidden = false;
      panel.querySelector<HTMLButtonElement>("button")?.focus();
    });
}
