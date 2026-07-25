// Throwaway: verify the composer stays on ONE row with Image → Product Shot
// selected, and that quality now lives inside the settings popover.
// npx tsx scripts/shot-composer.ts <outDir>
import { resolve } from "node:path";
import { chromium } from "playwright";

const outDir = process.argv[2] ?? ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });

await page.goto("http://localhost:3061/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const step = async (name: string, fn: () => Promise<void>) => {
	try {
		await fn();
		console.log(`ok: ${name}`);
	} catch (error) {
		console.log(`skip: ${name} — ${String(error).slice(0, 120)}`);
	}
};

// Mode picker shows the current mode ("Auto") — open it and pick Image.
await step("open mode picker", () =>
	page
		.getByRole("button", { name: /auto/i })
		.first()
		.click({ timeout: 5_000 }),
);
await step("choose Image mode", () =>
	page
		.getByRole("menuitemradio", { name: /^image\b/i })
		.first()
		.click({ timeout: 5_000 }),
);
await page.waitForTimeout(400);

// Output picker chip (first output auto-selected) → choose Product shot.
await step("open output picker", async () => {
	const chip = page
		.getByRole("button", { name: /produit|product|créateur|creator/i })
		.first();
	await chip.click({ timeout: 5_000 });
});
await step("choose product shot", () =>
	page
		.getByRole("menuitemradio", { name: /produit|product/i })
		.first()
		.click({ timeout: 5_000 }),
);
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(outDir, "composer-row.png") });

// Open the generation-settings popover — quality must be inside now.
await step("open settings popover", () =>
	page
		.getByRole("button", { name: /réglages|settings|إعدادات/i })
		.first()
		.click({ timeout: 5_000 }),
);
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(outDir, "composer-settings.png") });

await browser.close();
console.log("done");
