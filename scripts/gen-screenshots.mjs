// Screenshots for the landing page, taken from the real app rather than mocked up.
//
// The ledger in them is the demo one — the same invented household anybody can open from the
// gate, which is the honest way round: these are published to everyone, and nobody's actual net
// worth belongs in that. It also means there is nothing to seed here. The demo is deterministic
// apart from live prices, so re-running produces the same pictures give or take a market.
//
// Drives Chrome over the DevTools protocol rather than through a browser-automation dependency,
// because the app has none and one script is not a reason to start.
//
//   npx wrangler dev --port 8791      (in another terminal — the API has to answer)
//   npm run gen-shots
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const ORIGIN = process.env.SHOT_ORIGIN || "http://127.0.0.1:8791";
const PORT = 9224;
const OUT = new URL("../public/assets/screenshots/", import.meta.url);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* Each view once on a phone, and the two worth seeing wide. `scroll` is where the interesting
   part of the page is: the top for the total and the chart, further down for the panels that
   answer a question rather than state a figure. */
const SHOTS = [
  { name: "networth", view: "navNet", form: "narrow", scroll: 0 },
  { name: "salary", view: "salaryBtn", form: "narrow", scroll: 0 },
  { name: "budget", view: "navBudget", form: "narrow", scroll: 0 },
  { name: "networth-wide", view: "navNet", form: "wide", scroll: 0 },
  { name: "forecast-wide", view: "navNet", form: "wide", scroll: "forecast" },
];

/* Narrow at 2x, which is what a phone actually is. Wide at 1x: beside the phone frames it is
   decoration, and twice the pixels is twice the megabytes for no gain at that size. */
const SIZE = {
  narrow: { width: 412, height: 915, scale: 2 },
  wide: { width: 1280, height: 800, scale: 1 },
};

// ---- the DevTools protocol, by hand ----

let ws, next = 1;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = next++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function connect(url) {
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  };
}

// Runs an async expression in the page and gives back its value, throwing what the page threw.
async function run(expression) {
  const r = await send("Runtime.evaluate", {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

// ---- what the page is told to do ----

/* In through the gate's own demo button, which is the path that loads the sample ledger and
   boots the app. The banner it puts at the top says "nothing is saved" — true, and not what a
   screenshot of the app is a picture of, so it goes. */
const ENTER_DEMO = `
  const btn = document.getElementById("toDemo");
  if (!btn) return false;
  btn.click();
  await new Promise((r) => setTimeout(r, 1200));
  const bar = document.getElementById("demoBanner");
  if (bar) bar.remove();
  /* Fetch the prices first, or the total is filed under "prices not refreshed" — true of a
     ledger nobody has opened yet, and not the sentence to publish under the headline figure.
     The wait is for the toast that follows it to clear, which lasts 2.3 seconds. */
  const px = document.getElementById("pricesBtn");
  if (px) { px.click(); await new Promise((r) => setTimeout(r, 4200)); }
  return !!document.getElementById("app") && !document.getElementById("app").classList.contains("hide");
`;

// A view, from the same buttons a reader would press, then put where the shot wants it.
const showView = (id, scroll) => `
  document.getElementById(${JSON.stringify(id)}).click();
  await new Promise((r) => setTimeout(r, 700));
  const bar = document.getElementById("demoBanner");
  if (bar) bar.remove();
  ${scroll === "forecast"
    ? `const fc = document.querySelector("#viewNet section.forecast");
       if (fc) fc.scrollIntoView({ block: "start" });`
    : `window.scrollTo(0, ${Number(scroll) || 0});`}
  await new Promise((r) => setTimeout(r, 500));
  return document.title;
`;

// ---- go ----

const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + (process.env.TMPDIR || "/tmp") + "nestegg-shots",
  "--no-first-run", "--no-default-browser-check", "--disable-gpu",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

const die = async (msg, code = 1) => {
  console.error("gen-screenshots: " + msg);
  chrome.kill();
  process.exit(code);
};

try {
  // Chrome takes a moment to open its debugging port.
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === "page");
    } catch (e) { /* not up yet */ }
  }
  if (!target) await die("Chrome never opened its debugging port");

  await connect(target.webSocketDebuggerUrl);
  await send("Page.enable");
  await send("Runtime.enable");

  const goto = async (url) => {
    await send("Page.navigate", { url });
    await sleep(1200);
  };

  mkdirSync(OUT, { recursive: true });

  const written = [];
  for (const shot of SHOTS) {
    const size = SIZE[shot.form];
    await send("Emulation.setDeviceMetricsOverride", {
      ...size, deviceScaleFactor: size.scale, mobile: shot.form === "narrow",
    });
    /* Reloaded per shot rather than kept alive across the set. The app is one page with a
       bottom bar on a phone and a rail on a desktop, and the layout is decided as it boots —
       resizing a booted one leaves it half in the shape it was born in. */
    await goto(ORIGIN + "/dashboard.html");
    const inDemo = await run(ENTER_DEMO);
    if (!inDemo) await die("could not get into the demo — is the dev server running on " + ORIGIN + "?");
    await run(showView(shot.view, shot.scroll));
    await sleep(1500);   // live prices, and the charts' own arithmetic

    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const file = `${shot.name}.png`;
    writeFileSync(new URL(file, OUT), Buffer.from(data, "base64"));
    written.push({ ...shot, file, w: size.width * size.scale, h: size.height * size.scale });
    console.log(`  wrote ${file}  ${size.width * size.scale}x${size.height * size.scale}  ${shot.form}`);
  }

  console.log(`gen-screenshots: ${written.length} written to public/assets/screenshots/`);
  chrome.kill();
  process.exit(0);
} catch (e) {
  await die(e.message);
}
