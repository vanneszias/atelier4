import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const target = process.env.CLOUDFLARE_ENV;
assert(
  ["staging", "live"].includes(target),
  "CLOUDFLARE_ENV must be staging or live",
);
const config = JSON.parse(
  readFileSync(new URL("../dist/server/wrangler.json", import.meta.url)),
);
const ids = {
  staging: {
    db: "247eaa28-254e-4231-9140-b7b6ad8d5e36",
    kv: "3ca8581fcff64c9aa05a456c2ee716a0",
    host: "staging.ateliervier.be",
  },
  live: {
    db: "7a5ec78f-7351-417d-8953-74732d63b395",
    kv: "4d0055f889be4f5b8bbf304e51e53c6d",
    host: "ateliervier.be",
  },
};
assert.equal(config.name, `atelier4-${target}`);
assert.equal(
  config.d1_databases.find((x) => x.binding === "DB").database_id,
  ids[target].db,
);
assert.equal(
  config.r2_buckets.find((x) => x.binding === "MEDIA").bucket_name,
  `atelier4-media-${target}`,
);
assert.equal(
  config.kv_namespaces.find((x) => x.binding === "SESSION").id,
  ids[target].kv,
);
assert.equal(config.vars.EMDASH_SITE_URL, `https://${ids[target].host}`);
assert.equal(config.workers_dev, false);
assert.equal(config.preview_urls, false);
assert(
  config.routes.some((x) => x.pattern === ids[target].host && x.custom_domain),
);
console.log(`Verified isolated ${target} deployment target.`);
