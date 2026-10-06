import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
  output: "server",
  i18n: { defaultLocale: "nl", locales: ["nl", "en"], fallback: { en: "nl" } },
  adapter: cloudflare(),
  image: {
    layout: "constrained",
    responsiveStyles: true,
  },
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "auto" }),
      storage: r2({ binding: "MEDIA" }),
      sandboxRunner: sandbox(),
      plugins: [
        {
          id: "atelier4-community",
          version: "1.0.0",
          entrypoint: new URL(
            "./src/plugins/community/index.ts",
            import.meta.url,
          ).pathname,
          adminEntry: new URL(
            "./src/plugins/community/admin.tsx",
            import.meta.url,
          ).pathname,
          adminPages: [
            { path: "/submissions", label: "Community & forms", icon: "users" },
            { path: "/availability", label: "Site availability", icon: "settings" },
          ],
        },
      ],
    }),
  ],
  devToolbar: { enabled: false },
});
