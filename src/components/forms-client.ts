export {};
type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
    atelier4TurnstileReady?: () => void;
  }
}
const ready = () => {
  document
    .querySelectorAll<HTMLFormElement>("form[data-community-form]")
    .forEach((form) => {
      if (form.dataset.ready) return;
      form.dataset.ready = "true";
      let submissionId = crypto.randomUUID(),
        token = "",
        widgetId: string | undefined;
      const mount = () => {
        const el = form.querySelector<HTMLElement>("[data-turnstile]");
        if (el && window.turnstile && !widgetId)
          widgetId = window.turnstile.render(el, {
            sitekey: form.dataset.siteKey,
            callback: (value: string) => {
              token = value;
            },
            "expired-callback": () => {
              token = "";
            },
            "error-callback": () => {
              token = "";
            },
          });
      };
      mount();
      window.addEventListener("atelier4:turnstile", mount);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const button = form.querySelector<HTMLButtonElement>(
          "button[type=submit]",
        )!;
        const status = form.querySelector<HTMLElement>(".form-status")!;
        button.disabled = true;
        button.textContent = form.dataset.sending!;
        status.textContent = "";
        const fields = new FormData(form);
        const data = {
          submissionId,
          type: fields.get("type"),
          locale: fields.get("locale"),
          name: fields.get("name"),
          email: fields.get("email"),
          discipline: fields.get("discipline") || "",
          message: fields.get("message") || "",
          eventId: fields.get("eventId") || "",
          website: fields.get("website") || "",
          help: fields.has("help"),
          updates: fields.has("updates"),
          consent: fields.has("consent"),
          turnstileToken: token,
        };
        try {
          const res = await fetch(
            "/_emdash/api/plugins/atelier4-community/submit",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
          );
          const response = (await res.json()) as {
            success: boolean;
            data?: { ok: boolean };
          };
          if (!res.ok || !response.success || !response.data?.ok) throw Error();
          form.reset();
          submissionId = crypto.randomUUID();
          status.textContent = form.dataset.success!;
        } catch {
          status.textContent = form.dataset.error!;
        } finally {
          button.disabled = false;
          button.textContent = form.dataset.submit!;
          status.focus();
          if (widgetId) window.turnstile?.reset(widgetId);
          token = "";
        }
      });
    });
  if (
    document.querySelector('[data-site-key]:not([data-site-key=""])') &&
    !document.querySelector("script[data-turnstile-script]")
  ) {
    window.atelier4TurnstileReady = () =>
      window.dispatchEvent(new Event("atelier4:turnstile"));
    const script = document.createElement("script");
    script.dataset.turnstileScript = "true";
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=atelier4TurnstileReady&render=explicit";
    script.async = true;
    document.head.appendChild(script);
  }
};
ready();
