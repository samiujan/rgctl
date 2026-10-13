#!/usr/bin/env node
/**
 * Minimal Chrome DevTools Protocol driver for screenshotting and probing the mock.
 *
 * Why this file exists — the bug it fixes:
 *
 *   The obvious way to open a page is `PUT /json/new?<url>`. That silently breaks for any URL
 *   with more than one query parameter, because the `&` characters are parsed as parameters of
 *   `/json/new` itself, not of the page. Opening
 *   `.../json/new?http://localhost:4174/?room=understand&lens=cfgpddg&focus=abc`
 *   therefore loads `http://localhost:4174/?room=understand` — the lens and focus are dropped
 *   before the page ever sees them. Symptom: the app looks broken when it is fine.
 *
 *   The fix is one call: `encodeURIComponent(target)`. This driver does it for you.
 *
 * Usage:
 *   node scripts/cdp.mjs shot "<url>" out.png [--w 1440] [--h 900] [--wait 3000] [--eval "<js>"]
 *   node scripts/cdp.mjs eval "<url>" "<js expression>"
 *
 * Requires Chrome already running with --remote-debugging-port=9222.
 */

const HOST = process.env.CDP_HOST ?? "127.0.0.1:9222";

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      flags[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
    } else rest.push(argv[i]);
  }
  return { flags, rest };
}

/** Open a URL in a new tab. The encodeURIComponent is the whole point — see the header note. */
async function openTab(target) {
  const res = await fetch(`http://${HOST}/json/new?${encodeURIComponent(target)}`, { method: "PUT" });
  if (!res.ok) throw new Error(`/json/new failed: HTTP ${res.status}`);
  return await res.json();
}

async function closeTab(id) {
  await fetch(`http://${HOST}/json/close/${id}`).catch(() => {});
}

function connect(tab) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error("websocket failed")));
  });
}

function makeSend(ws) {
  let id = 0;
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const onMessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.id !== id) return;
        ws.removeEventListener("message", onMessage);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      };
      ws.addEventListener("message", onMessage);
      ws.send(JSON.stringify({ id: ++id, method, params }));
      setTimeout(() => reject(new Error(`timeout: ${method}`)), 30000);
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { flags, rest } = parseArgs(process.argv.slice(2));
const command = rest[0];

if (!command || !["shot", "eval"].includes(command)) {
  console.error(
    [
      "usage:",
      '  node scripts/cdp.mjs shot "<url>" out.png [--w 1440] [--h 900] [--wait 3000] [--eval "<js>"]',
      '  node scripts/cdp.mjs eval "<url>" "<js expression>"',
    ].join("\n"),
  );
  process.exit(2);
}

const target = rest[1];
if (!target) {
  console.error("error: a URL is required");
  process.exit(2);
}

const tab = await openTab(target);
const ws = await connect(tab);
const send = makeSend(ws);

try {
  await send("Emulation.setDeviceMetricsOverride", {
    width: Number(flags.w ?? 1440),
    height: Number(flags.h ?? 900),
    deviceScaleFactor: Number(flags.dsf ?? 2),
    mobile: false,
  });
  if (flags.cache !== "keep") await send("Network.setCacheDisabled", { cacheDisabled: true });
  await sleep(Number(flags.wait ?? 3000));

  // Fail loudly if the page did not keep the URL we asked for — that is the bug this guards.
  const actual = await send("Runtime.evaluate", { expression: "location.href", returnByValue: true });
  const want = new URL(target);
  const got = new URL(actual.result.value);
  if (got.search !== want.search) {
    console.error(`warn: URL params changed.\n  asked for: ${want.search}\n  landed on: ${got.search}`);
  }

  if (command === "shot") {
    if (flags.eval) {
      await send("Runtime.evaluate", { expression: flags.eval, returnByValue: true, awaitPromise: true });
      await sleep(Number(flags.after ?? 800));
    }
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    const out = rest[2] ?? "/tmp/cdp-shot.png";
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`wrote ${out}`);
  } else {
    const expression = rest[2];
    if (!expression) {
      console.error("error: eval needs an expression");
      process.exit(2);
    }
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    console.log(JSON.stringify(r.result?.value ?? r, null, 2));
  }
} finally {
  ws.close();
  await closeTab(tab.id);
}
