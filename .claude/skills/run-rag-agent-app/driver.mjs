#!/usr/bin/env node
// Browser driver for rag-agent-app. Drives the real UI in the installed Chrome
// via playwright-core (no bundled-browser download).
//
//   node .claude/skills/run-rag-agent-app/driver.mjs [--flow all] [--out DIR]
//
// Flows: shots | chat | drawer | theme | all (default)

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const FLOW = argOf("flow", "all");
const OUT = argOf("out", join(tmpdir(), "rag-agent-shots"));
const BASE = argOf("base", "http://localhost:3000");
const API = argOf("api", "http://localhost:8000");
const QUESTION = argOf("question", "What are these documents about?");

const VIEWPORTS = [
  { name: "compact", width: 390, height: 844 },
  { name: "medium", width: 768, height: 1024 },
  { name: "expanded", width: 1280, height: 900 },
];

const problems = [];
const shots = [];

async function shoot(page, label) {
  const path = join(OUT, `${label}.png`);
  await page.screenshot({ path, fullPage: false });
  shots.push(path);
  console.log(`  shot  ${label}.png`);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem("theme", t);
  }, theme);
  await page.waitForTimeout(150);
}

async function preflight() {
  const r = await fetch(`${API}/health`).catch(() => null);
  if (!r || !r.ok) {
    throw new Error(`backend not healthy at ${API}/health — start it before the driver`);
  }
  console.log(`  backend ${API}/health -> ${JSON.stringify(await r.json())}`);
  const f = await fetch(BASE).catch(() => null);
  if (!f || !f.ok) throw new Error(`frontend not serving at ${BASE}`);
  console.log(`  frontend ${BASE} -> ${f.status}`);
}

async function flowShots(ctx) {
  console.log("\n[shots] every viewport, both themes");
  for (const vp of VIEWPORTS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE, { waitUntil: "networkidle" });

    for (const theme of ["light", "dark"]) {
      await setTheme(page, theme);
      await shoot(page, `${vp.name}-${theme}`);
    }

    // Horizontal overflow is the classic responsive failure; assert it directly.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) problems.push(`${vp.name}: horizontal overflow of ${overflow}px`);
    else console.log(`  ok    ${vp.name}: no horizontal overflow`);

    // Icon font must render as glyphs, not the literal ligature text.
    const iconBox = await page.locator(".icon").first().boundingBox();
    if (iconBox && iconBox.width > 48) {
      problems.push(`${vp.name}: icon ${Math.round(iconBox.width)}px wide — ligature text, font failed`);
    }
    await page.close();
  }
}

async function flowChat(ctx) {
  console.log("\n[chat] real question against the live backend");
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });

  await page.getByPlaceholder("Ask a question...").fill(QUESTION);
  await page.getByRole("button", { name: "Send message" }).click();

  const bubble = page.locator("p.whitespace-pre-wrap").nth(1);
  try {
    await bubble.waitFor({ state: "visible", timeout: 90_000 });
    const answer = (await bubble.innerText()).trim();
    console.log(`  answer: ${answer.slice(0, 120)}${answer.length > 120 ? "..." : ""}`);
    if (!answer) problems.push("chat: assistant bubble rendered empty");
  } catch {
    const err = await page.locator(".bg-error-container").first().innerText().catch(() => "");
    problems.push(`chat: no answer within 90s${err ? ` — error shown: ${err.trim()}` : ""}`);
  }
  await shoot(page, "chat-answer");

  const badge = page.locator("button[title]").first();
  if (await badge.count()) {
    console.log(`  citation: ${(await badge.innerText()).trim()}`);
    await badge.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(600);
    await shoot(page, "chat-citation-modal");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5_000 });
    console.log("  ok    citation modal opens and closes on Escape");
  } else {
    problems.push("chat: answer rendered with no citation badges");
  }
  await page.close();
}

async function flowDrawer(ctx) {
  console.log("\n[drawer] modal drawer at 390px");
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });

  const menu = page.getByRole("button", { name: "Open documents" });
  if (!(await menu.isVisible())) {
    problems.push("drawer: menu button not visible at 390px");
    await page.close();
    return;
  }
  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Documents" });
  await drawer.waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(300);
  await shoot(page, "compact-drawer-open");

  if (await page.evaluate(() => document.body.style.overflow === "hidden")) {
    console.log("  ok    body scroll locked while open");
  } else {
    problems.push("drawer: body scroll not locked");
  }

  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden", timeout: 5_000 });
  const restored = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") ?? null,
  );
  if (restored === "Open documents") console.log("  ok    Escape closes, focus restored to trigger");
  else problems.push(`drawer: focus not restored (activeElement aria-label: ${restored})`);

  // The permanent sidebar must take over above the expanded breakpoint.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  if (await menu.isVisible()) problems.push("drawer: menu button still visible at 1280px");
  else console.log("  ok    menu button hidden at expanded width");
  await page.close();
}

async function flowTheme(ctx) {
  console.log("\n[theme] toggle persists across reload");
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await setTheme(page, "light");
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => document.documentElement.classList.contains("dark")))) {
    problems.push("theme: toggle did not add .dark");
  }
  await page.reload({ waitUntil: "networkidle" });
  const stillDark = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  if (stillDark) console.log("  ok    dark theme survives reload, applied pre-paint");
  else problems.push("theme: dark did not persist across reload");
  await page.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`rag-agent-app driver — out: ${OUT}`);
  await preflight();

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });

  ctx.on("console", (m) => {
    // The app ships no public/favicon.ico; that 404 is pre-existing noise.
    const isFavicon = m.location()?.url?.endsWith("/favicon.ico");
    if (m.type() === "error" && !isFavicon) problems.push(`console error: ${m.text()}`);
  });
  ctx.on("weberror", (e) => problems.push(`page error: ${e.error().message}`));

  try {
    if (FLOW === "all" || FLOW === "shots") await flowShots(ctx);
    if (FLOW === "all" || FLOW === "chat") await flowChat(ctx);
    if (FLOW === "all" || FLOW === "drawer") await flowDrawer(ctx);
    if (FLOW === "all" || FLOW === "theme") await flowTheme(ctx);
  } finally {
    await browser.close();
  }

  console.log(`\n${shots.length} screenshots in ${OUT}`);
  if (problems.length) {
    console.log(`\nFAIL — ${problems.length} problem(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log("\nPASS — all checks green");
}

main().catch((e) => {
  console.error(`\ndriver failed: ${e.message}`);
  process.exit(1);
});
