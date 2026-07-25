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
	/** Failed request URLs and HTTP error responses, prefixed by viewport. */
	failedRequests: string[];
	/** scrollWidth − clientWidth per viewport; anything > 1px is a layout bug. */
	overflow: { desktop: number; mobile: number };
	shots: CapturedShot[];
};

export type ScreenshotSession = {
	capture(html: string): Promise<ScreenshotCapture>;
	dispose(): Promise<void>;
};

/**
 * Only browser loading/launch failures use this error. The Builder can safely
 * degrade to code review for those failures without hiding page-level bugs.
 */
export class ScreenshotUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScreenshotUnavailableError";
	}
}

const VIEWPORTS = [
	{ height: 900, name: "desktop" as const, width: 1440 },
	{ height: 844, name: "mobile" as const, width: 390 },
];

// Fonts and the entrance sequence need real time before the first shot;
// scroll-triggered reveals need a beat after each reposition.
const SETTLE_MS = 2500;
const SCROLL_SETTLE_MS = 900;

// 7 per viewport keeps the multimodal tool result at ≤14 images; JPEG at
// this quality is enough for layout review without bloating the context.
const MAX_SHOTS_PER_VIEWPORT = 7;
const JPEG_QUALITY = 70;

export function createScreenshotSession(
	attemptId: string,
	abortSignal?: AbortSignal,
): ScreenshotSession {
	const dir = join(tmpdir(), `wandit-build-${attemptId}`);
	const htmlPath = join(dir, "index.html");
	// Memoize the launch PROMISE, not the browser: tool calls within one
	// assistant step run concurrently, and memoizing after the await would
	// launch (and leak) a second Chromium.
	let browserPromise: Promise<Browser> | null = null;
	// Captures share one temp file and one browser — serialize them.
	let captureChain: Promise<unknown> = Promise.resolve();

	const launchBrowser = async (): Promise<Browser> => {
		try {
			const { chromium } = await import("playwright");

			return await chromium.launch({ headless: true });
		} catch (error) {
			throw new ScreenshotUnavailableError(
				`Playwright/Chromium could not launch: ${errorMessage(error)}`,
			);
		}
	};

	const doCapture = async (html: string): Promise<ScreenshotCapture> => {
		throwIfAborted(abortSignal);
		await abortable(mkdir(dir, { recursive: true }), abortSignal);
		await abortable(writeFile(htmlPath, html, "utf-8"), abortSignal);

		browserPromise ??= launchBrowser();
		const browser = await abortable(browserPromise, abortSignal);

		const consoleErrors: string[] = [];
		const failedRequests: string[] = [];
		const overflow = { desktop: 0, mobile: 0 };
		const shots: CapturedShot[] = [];

		for (const viewport of VIEWPORTS) {
			throwIfAborted(abortSignal);
			const page = await abortable(
				browser.newPage({
					viewport: { height: viewport.height, width: viewport.width },
				}),
				abortSignal,
			);

			page.on("pageerror", (error) => {
				consoleErrors.push(`[${viewport.name}] ${error.message}`);
			});
			page.on("console", (message) => {
				if (message.type() === "error") {
					consoleErrors.push(`[${viewport.name}] ${message.text()}`);
				}
			});
			page.on("requestfailed", (request) => {
				const failure = request.failure()?.errorText ?? "request failed";
				failedRequests.push(`[${viewport.name}] ${request.url()} (${failure})`);
			});
			page.on("response", (response) => {
				if (response.status() >= 400) {
					failedRequests.push(
						`[${viewport.name}] ${response.url()} (HTTP ${response.status()})`,
					);
				}
			});

			try {
				await abortable(
					page.goto(pathToFileURL(htmlPath).href, {
						waitUntil: "networkidle",
					}),
					abortSignal,
				);
				// String-form evaluate: the server tsconfig has no DOM lib.
				await abortable(
					page.evaluate(
						"document.fonts && document.fonts.ready " +
							"? document.fonts.ready.then(() => undefined) : undefined",
					),
					abortSignal,
				);
				await abortable(page.waitForLoadState("networkidle"), abortSignal);
				await abortable(page.waitForTimeout(SETTLE_MS), abortSignal);

				const metrics = (await abortable(
					page.evaluate(
						"({" +
							" clientWidth: document.documentElement.clientWidth," +
							" scrollHeight: document.documentElement.scrollHeight," +
							" scrollWidth: document.documentElement.scrollWidth" +
							" })",
					),
					abortSignal,
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
					// Smooth-scroll libraries (Lenis) hijack window.scrollTo, so a
					// plain call may never reach the target and every shot collapses
					// into the same frame. The builder prompt requires any smooth
					// scroller to be exposed as window.__lenis; drive it immediately
					// when present, else fall back to a native instant jump.
					await abortable(
						page.evaluate(
							"window.__lenis && window.__lenis.scrollTo" +
								` ? window.__lenis.scrollTo(${top}, { immediate: true })` +
								` : window.scrollTo({ top: ${top}, behavior: "instant" })`,
						),
						abortSignal,
					);
					await abortable(page.waitForTimeout(SCROLL_SETTLE_MS), abortSignal);

					const buffer = await abortable(
						page.screenshot({
							quality: JPEG_QUALITY,
							type: "jpeg",
						}),
						abortSignal,
					);
					shots.push({
						base64: buffer.toString("base64"),
						viewport: viewport.name,
					});
				}
			} finally {
				await page.close().catch(() => undefined);
			}
		}

		return { consoleErrors, failedRequests, overflow, shots };
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

function abortable<T>(
	promise: Promise<T>,
	signal: AbortSignal | undefined,
): Promise<T> {
	if (!signal) {
		return promise;
	}

	if (signal.aborted) {
		return Promise.reject(abortReason(signal));
	}

	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(abortReason(signal));

		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			},
			(error: unknown) => {
				signal.removeEventListener("abort", onAbort);
				reject(error);
			},
		);
	});
}

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) {
		throw abortReason(signal);
	}
}

function abortReason(signal: AbortSignal): Error {
	return signal.reason instanceof Error
		? signal.reason
		: new Error("Screenshot capture aborted");
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
