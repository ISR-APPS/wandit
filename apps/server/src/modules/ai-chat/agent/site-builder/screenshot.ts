/**
 * Real-browser rendering behind the builder's screenshot_page tool.
 *
 * One headless Chromium per build: launched lazily on the first capture,
 * reused across review passes, and torn down (browser + temp dir) by
 * runSiteBuild's finally. Playwright is imported dynamically so the Nest
 * server never loads it — only the Trigger worker does; tests inject a fake
 * session and never touch a browser.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser } from "playwright";

export type CapturedShot = {
	/** JPEG bytes, base64-encoded — handed to the model, never persisted. */
	base64: string;
	viewport: "desktop" | "mobile";
};

export type ScreenshotCapture = {
	/** pageerror + console.error messages, prefixed with their viewport. */
	consoleErrors: string[];
	/** scrollWidth − clientWidth per viewport; anything > 1px is a layout bug. */
	overflow: { desktop: number; mobile: number };
	shots: CapturedShot[];
};

export type ScreenshotSession = {
	capture(html: string): Promise<ScreenshotCapture>;
	dispose(): Promise<void>;
};

const VIEWPORTS = [
	{ height: 900, name: "desktop" as const, width: 1440 },
	{ height: 844, name: "mobile" as const, width: 390 },
];

// Fonts and the entrance sequence need real time before the first shot;
// scroll-triggered reveals need a beat after each reposition.
const SETTLE_MS = 2500;
const SCROLL_SETTLE_MS = 900;

// 7 per viewport keeps the multimodal tool result at ≤14 images; JPEG at
// this quality is plenty for layout review without bloating the context.
const MAX_SHOTS_PER_VIEWPORT = 7;
const JPEG_QUALITY = 60;

export function createScreenshotSession(attemptId: string): ScreenshotSession {
	const dir = join(tmpdir(), `wandit-build-${attemptId}`);
	const htmlPath = join(dir, "index.html");
	// Memoize the launch PROMISE, not the browser: tool calls within one
	// assistant step run concurrently, and memoizing after the await would
	// launch (and leak) a second Chromium.
	let browserPromise: Promise<Browser> | null = null;
	// Captures share one temp file and one browser — serialize them.
	let captureChain: Promise<unknown> = Promise.resolve();

	const doCapture = async (html: string): Promise<ScreenshotCapture> => {
		await mkdir(dir, { recursive: true });
		await writeFile(htmlPath, html, "utf-8");

		browserPromise ??= import("playwright").then(({ chromium }) =>
			chromium.launch({ headless: true }),
		);
		const browser = await browserPromise;

		const consoleErrors: string[] = [];
		const overflow = { desktop: 0, mobile: 0 };
		const shots: CapturedShot[] = [];

		for (const viewport of VIEWPORTS) {
			const page = await browser.newPage({
				viewport: { height: viewport.height, width: viewport.width },
			});

			page.on("pageerror", (error) => {
				consoleErrors.push(`[${viewport.name}] ${error.message}`);
			});
			page.on("console", (message) => {
				if (message.type() === "error") {
					consoleErrors.push(`[${viewport.name}] ${message.text()}`);
				}
			});

			try {
				await page.goto(pathToFileURL(htmlPath).href, {
					waitUntil: "networkidle",
				});
				await page.waitForTimeout(SETTLE_MS);

				// String-form evaluate: the server tsconfig has no DOM lib,
				// so a callback referencing document would not typecheck.
				const metrics = (await page.evaluate(
					"({" +
						" clientWidth: document.documentElement.clientWidth," +
						" scrollHeight: document.documentElement.scrollHeight," +
						" scrollWidth: document.documentElement.scrollWidth" +
						" })",
				)) as {
					clientWidth: number;
					scrollHeight: number;
					scrollWidth: number;
				};

				overflow[viewport.name] = Math.max(
					0,
					metrics.scrollWidth - metrics.clientWidth,
				);

				for (const top of scrollOffsets(
					metrics.scrollHeight,
					viewport.height,
					MAX_SHOTS_PER_VIEWPORT,
				)) {
					await page.evaluate(`window.scrollTo(0, ${top})`);
					await page.waitForTimeout(SCROLL_SETTLE_MS);

					const buffer = await page.screenshot({
						quality: JPEG_QUALITY,
						type: "jpeg",
					});
					shots.push({
						base64: buffer.toString("base64"),
						viewport: viewport.name,
					});
				}
			} finally {
				await page.close();
			}
		}

		return { consoleErrors, overflow, shots };
	};

	return {
		capture(html) {
			const next = captureChain.then(() => doCapture(html));
			// Keep the chain alive past failures so a later pass can retry.
			captureChain = next.catch(() => undefined);
			return next;
		},

		async dispose() {
			await captureChain.catch(() => undefined);

			if (browserPromise) {
				const browser = await browserPromise.catch(() => null);
				await browser?.close().catch(() => undefined);
				browserPromise = null;
			}

			await rm(dir, { force: true, recursive: true }).catch(() => undefined);
		},
	};
}

/**
 * Evenly spaced scroll positions covering the page top → bottom, capped at
 * maxShots. Exported for tests — the only pure math in this file.
 */
export function scrollOffsets(
	scrollHeight: number,
	viewportHeight: number,
	maxShots: number,
): number[] {
	const maxTop = Math.max(0, scrollHeight - viewportHeight);

	if (maxTop === 0) {
		return [0];
	}

	const count = Math.min(
		maxShots,
		Math.max(2, Math.ceil(scrollHeight / viewportHeight)),
	);
	const step = maxTop / (count - 1);

	return Array.from({ length: count }, (_, index) => Math.round(index * step));
}
