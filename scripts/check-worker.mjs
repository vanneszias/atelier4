import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { accessCookie, createSiteAccess, issueAccessToken, verifyAccessToken } from "../src/lib/site-access.ts";

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
    // Miniflare also uses this database. Wait for its short background writes
    // rather than failing immediately if a settings update overlaps one.
    db.exec("PRAGMA busy_timeout = 5000");
    const set = db.prepare("INSERT INTO options (name, value, revision) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value, revision = excluded.revision");
    const message = "We zijn aan het werk!\n<script>alert('test')</script>";
    const store = (offline, text = message, access) => set.run("plugin:atelier4-community:settings:siteAvailability", JSON.stringify({ offline, message: text, ...(access ? { access } : {}) }), crypto.randomUUID());
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
      const access = await createSiteAccess("atelier-test-code");
      store(true, message, access);
      const gate = await (await fetch(origin + "/en/events?from=test")).text();
      assert.match(gate, /Have an access code/);
      for (const secret of ["atelier-test-code", access.hash, access.sessionKey]) assert(!gate.includes(secret), "Visitor HTML must never contain access credentials");
      const unlock = (code, next = "/en/events?from=test", headers = {}) => fetch(origin + "/site-access/unlock", {
        method: "POST", redirect: "manual", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded", ...headers },
        body: new URLSearchParams({ code, next }),
      });
      const wrong = await unlock("wrong-code");
      assert.equal(wrong.status, 403);
      assert.equal(wrong.headers.get("set-cookie"), null);
      assert.match(await wrong.text(), /Die code klopt niet/);
      assert.equal((await unlock("atelier-test-code", "/events", { Origin: "https://example.com" })).status, 403);
      const unlocked = await unlock("atelier-test-code");
      assert.equal(unlocked.status, 303);
      assert.equal(unlocked.headers.get("location"), "/en/events?from=test");
      const cookie = unlocked.headers.get("set-cookie");
      assert(cookie);
      for (const attribute of ["Secure", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=604800"]) assert(cookie.includes(attribute));
      const credential = cookie.split(";")[0];
      assert.equal((await fetch(origin + "/events", { headers: { Cookie: credential } })).status, 200);
      assert.equal((await fetch(origin + "/en/events", { headers: { Cookie: credential } })).status, 200);
      assert.equal((await fetch(origin + "/events")).status, 503, "Other visitors must remain blocked");
      const token = credential.slice(credential.indexOf("=") + 1);
      const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
      assert.equal((await fetch(origin + "/events", { headers: { Cookie: `${accessCookie}=${tampered}` } })).status, 503);
      const expired = await issueAccessToken(access, Date.now() - 8 * 86400000);
      assert.equal(await verifyAccessToken(expired, access), false);
      assert.equal((await fetch(origin + "/events", { headers: { Cookie: `${accessCookie}=${expired}` } })).status, 503);
      const redirect = await unlock("atelier-test-code", "//example.com");
      assert.equal(redirect.headers.get("location"), "/", "Access form cannot redirect to another website");
      for (let index = 0; index < 12; index++) assert.equal((await unlock("atelier-test-code")).status, 303, "Successful visitors on shared Wi-Fi must not consume the failed-guess limit");
      // A visitor access cookie must never become an admin session.
      const admin = await fetch(origin + "/_emdash/api/plugins/atelier4-community/availability", {
        redirect: "manual", headers: { Cookie: credential, "X-EmDash-Request": "1" },
      });
      assert([401, 403, 302, 307].includes(admin.status));
      const replacement = await createSiteAccess("replacement-code");
      store(true, message, replacement);
      assert.equal((await fetch(origin + "/events", { headers: { Cookie: credential } })).status, 503, "Changing the code must revoke existing access");
      assert.equal((await unlock("atelier-test-code")).status, 403, "The old code must stop working");
      assert.equal((await unlock("replacement-code")).status, 303);
      store(true);
      assert.equal((await fetch(origin + "/events", { headers: { Cookie: credential } })).status, 503, "Removing the code must revoke existing access");
      store(true, message, await createSiteAccess("rate-limit-code"));
      for (let index = 0; index < 10; index++) assert.equal((await unlock("wrong-code")).status, 403);
      const limited = await unlock("rate-limit-code");
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("retry-after"), "600");
      console.log("Visitor code entry, signed sessions, expiry, revocation and rate limiting passed.");
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
