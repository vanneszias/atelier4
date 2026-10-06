import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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
