import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const target = process.argv[2];
if (target && !["local", "staging"].includes(target))
  throw Error("Target must be local or staging. Omit it to export only.");
if (!process.env.EMDASH_TOKEN_LIVE)
  throw Error(
    "Set EMDASH_TOKEN_LIVE to a live CMS token with transfer:export scope.",
  );
mkdirSync(".backups", { recursive: true, mode: 0o700 });
const output = resolve(
  ".backups",
  `atelier4-live-${new Date().toISOString().replace(/[:.]/g, "-")}.emdash`,
);
function run(args, token, headers) {
  const env = {
    ...process.env,
    EMDASH_TOKEN: token,
    EMDASH_HEADERS: headers || "",
  };
  delete env.EMDASH_TOKEN_LIVE;
  delete env.EMDASH_TOKEN_STAGING;
  delete env.EMDASH_HEADERS_STAGING;
  const r = spawnSync("bunx", ["emdash", ...args], { env, stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
run(
  ["site", "export", "--url", "https://ateliervier.be", "--output", output],
  process.env.EMDASH_TOKEN_LIVE,
);
console.log(
  `Exported live content, settings, history and media to ${output}. Users and secrets are excluded.`,
);
if (target) {
  const url =
    target === "staging"
      ? "https://staging.ateliervier.be"
      : "http://localhost:4321";
  if (
    target === "staging" &&
    (!process.env.EMDASH_TOKEN_STAGING || !process.env.EMDASH_HEADERS_STAGING)
  )
    throw Error(
      "Staging requires its own CMS token and Cloudflare Access service-token headers.",
    );
  run(
    ["site", "import", output, "--url", url, "--analyze"],
    target === "staging" ? process.env.EMDASH_TOKEN_STAGING : "",
    target === "staging" ? process.env.EMDASH_HEADERS_STAGING : "",
  );
  console.log(
    "Review the printed import plan. The target must be empty. Execute only the reviewed digest with emdash site import --plan <digest> --confirm.",
  );
}
