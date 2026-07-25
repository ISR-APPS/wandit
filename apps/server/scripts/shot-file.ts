// Throwaway: screenshot a local HTML file (full page, desktop width).
// npx tsx scripts/shot-file.ts <htmlPath> <outPng>
import { resolve } from "node:path";
import { chromium } from "playwright";

const [, , htmlPath, outPng] = process.argv;

if (!htmlPath || !outPng) {
	console.error("usage: npx tsx scripts/shot-file.ts <htmlPath> <outPng>");
	process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });
await page.goto(`file://${resolve(htmlPath)}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ fullPage: true, path: resolve(outPng) });
await browser.close();
console.log(`saved ${outPng}`);
