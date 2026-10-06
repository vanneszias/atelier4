import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Exercise the built Worker, not Astro's development server. A fresh local DB
// catches startup failures without touching either remote environment.
const state = await mkdtemp(join(tmpdir(), "atelier4-worker-"));
const origin = "http://127.0.0.1:8798";
const worker = spawn(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js", "dev", "--ip", "127.0.0.1",
  "--port", "8798", "--persist-to", state,
], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
for (const stream of [worker.stdout, worker.stderr]) {
  stream.on("data", (chunk) => { logs = (logs + chunk).slice(-12000); });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (worker.exitCode !== null) throw new Error("Worker exited during startup");
    try {
      const response = await fetch(`${origin}/_emdash/admin/setup`, {
        redirect: "manual", signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 200, "Fresh CMS setup must render");
      assert.match(await response.text(), /<html/);
      // The admin HTML can render even when middleware initialization fails.
      // Exercise the API the setup UI actually needs before declaring readiness.
      const status = await fetch(`${origin}/_emdash/api/setup/status`, {
        redirect: "manual", signal: AbortSignal.timeout(10000),
      });
      assert.equal(status.status, 200, "Fresh CMS setup API must initialize");
      const setup = await status.json();
      assert.equal(setup.success, true);
      assert.equal(setup.data.needsSetup, true);
      ready = true;
      break;
    } catch { await delay(500); }
  }
  assert(ready, "Production Worker did not render the CMS setup page");
  for (const route of ["/events", "/en/events"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /Atelier 4/);
  }
  // Owner setup is deliberately not completed by this test.
  const missing = await fetch(`${origin}/not-a-real-page`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Atelier 4/);
  const builtConfig = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
  const testRoutes = ["/", "/events", "/en/events", "/search", "/not-a-real-page"];
  const baseline = new Map();
  for (const route of testRoutes) baseline.set(route, (await fetch(origin + route)).status);
  const files = await readdir(join(state, "v3/d1"), { recursive: true });
  const file = files.find((path) => path.endsWith(".sqlite"));
  assert(file, "Expected isolated local D1 state");
  const db = new DatabaseSync(join(state, "v3/d1", file));
  try {
    const set = db.prepare("INSERT INTO options (name, value, revision) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, revision = excluded.revision");
    const message = "We zijn aan het werk!\n<script>alert('test')</script>";
    const store = (offline, text = message) => set.run("plugin:atelier4-community:settings:siteAvailability", JSON.stringify({ offline, message: text }), crypto.randomUUID());
    store(true);
    const live = builtConfig.vars?.ATELIER4_ENV === "live";
    for (const route of testRoutes) {
      const response = await fetch(origin + route);
      assert.equal(response.status, live ? 503 : baseline.get(route), route);
      if (live) {
        const html = await response.text();
        assert.match(html, /We zijn aan het werk!/);
        assert.match(html, /&lt;script&gt;/);
        assert(!html.includes("<script>alert"), "Custom message must be escaped");
        assert.match(response.headers.get("cache-control"), /no-store/);
        assert.equal(response.headers.get("retry-after"), "300");
      }
    }
    if (live) {
      store(true, "Een nieuwe boodschap.");
      assert.match(await (await fetch(origin + "/events")).text(), /Een nieuwe boodschap/);
      const head = await fetch(origin + "/events", { method: "HEAD" });
      assert.equal(head.status, 503);
      assert.equal(await head.text(), "");
      const submit = await fetch(origin + "/_emdash/api/plugins/atelier4-community/submit", { method: "POST" });
      assert.equal(submit.status, 503);
    }
    for (const route of ["/_emdash/admin/setup", "/_emdash/api/setup/status", "/brand/mark.svg"]) {
      assert.equal((await fetch(origin + route)).status, 200, `Offline mode must preserve ${route}`);
    }
    for (const route of ["availability", "availability-save"]) {
      const response = await fetch(origin + "/_emdash/api/plugins/atelier4-community/" + route, {
        method: route.endsWith("save") ? "POST" : "GET", redirect: "manual",
        headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
        ...(route.endsWith("save") ? { body: JSON.stringify({ offline: false, message: "" }) } : {}),
      });
      assert([401, 403, 302, 307].includes(response.status), `Availability route must require admin authentication: ${response.status}`);
    }
    store(false);
    assert.equal((await fetch(origin + "/events")).status, 200, "Switching back online must take effect immediately");
  } finally {
    db.close();
  }
  console.log("Maintenance toggle, environment isolation, admin access and recovery passed.");
  console.log("Production Worker setup API, NL/EN routes and rendered 404 passed.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  const exited = new Promise((resolve) => worker.once("exit", resolve));
  worker.kill("SIGTERM");
  await Promise.race([exited, delay(3000)]);
  if (worker.exitCode === null) worker.kill("SIGKILL");
  await rm(state, { recursive: true, force: true });
}
