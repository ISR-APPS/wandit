import type { PageBuildProgress } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import {
	type BuildProgressEvent,
	createBuildProgressTracker,
	parseSections,
} from "./build-progress";
import { REQUIRED_SCREENSHOT_PASSES } from "./site-builder-agent";

const SECTIONED_HTML = `<!doctype html><html><body>
	<section aria-label="Hero"><h2>Ceramic tagines, hand-thrown</h2></section>
	<section id="countdown"><h2>Sale ends soon</h2></section>
	<section><h2>Choose your size</h2></section>
	<section aria-label="Hero"><h2>duplicate label is dropped</h2></section>
</body></html>`;

function makeTracker(overrides?: {
	publish?: (progress: PageBuildProgress) => void;
	uploadShot?: (shot: {
		base64: string;
		index: number;
		pass: number;
	}) => Promise<string | null>;
}) {
	const snapshots: PageBuildProgress[] = [];
	const uploadShot =
		overrides?.uploadShot ??
		(async ({ pass, index }: { base64: string; index: number; pass: number }) =>
			`https://assets.example.com/sites/p1/shots/a1/p${pass}-${index}.jpg`);
	const tracker = createBuildProgressTracker({
		attemptId: "a1",
		projectId: "p1",
		publish: overrides?.publish ?? ((progress) => snapshots.push(progress)),
		uploadShot,
	});

	return { snapshots, tracker };
}

function shotEvent(
	pass: number,
	shotCount = { desktop: 7, mobile: 7 },
): Extract<BuildProgressEvent, { type: "screenshot-pass" }> {
	return {
		consoleErrors: [],
		failedRequests: [],
		overflow: { desktop: 0, mobile: 0 },
		pass,
		shots: [
			...Array.from({ length: shotCount.desktop }, (_, i) => ({
				base64: `d${i}`,
				viewport: "desktop" as const,
			})),
			...Array.from({ length: shotCount.mobile }, (_, i) => ({
				base64: `m${i}`,
				viewport: "mobile" as const,
			})),
		],
		type: "screenshot-pass",
	};
}

describe("createBuildProgressTracker", () => {
	it("folds a whole build into monotonic, phase-correct snapshots", async () => {
		const { snapshots, tracker } = makeTracker();

		tracker.emit({ role: "hero", type: "image-start" });
		tracker.emit({
			role: "hero",
			type: "image-generated",
			url: "https://assets.example.com/img-1.png",
		});
		tracker.emit({ type: "write-start" });
		tracker.emit({
			bytes: 24_000,
			html: SECTIONED_HTML,
			kind: "write",
			type: "page-written",
		});
		tracker.emit(shotEvent(1));
		await tracker.idle();
		tracker.emit({
			bytes: 24_100,
			html: SECTIONED_HTML,
			kind: "edit",
			type: "page-written",
		});
		tracker.emit(shotEvent(2));
		tracker.emit({ summary: "done", type: "finished" });
		await tracker.idle();

		const last = snapshots.at(-1);

		expect(last).toMatchObject({
			done: true,
			fixes: 1,
			headline: "Publishing the page…",
			images: [{ role: "hero", url: "https://assets.example.com/img-1.png" }],
			pageBytes: 24_100,
			percent: 100,
			phase: "finishing",
			reviewPasses: 2,
			reviewTarget: REQUIRED_SCREENSHOT_PASSES,
			sections: ["Hero", "Countdown", "Choose your size"],
		});

		// The bar never moves backwards across the whole build.
		for (let i = 1; i < snapshots.length; i += 1) {
			expect(snapshots[i]?.percent).toBeGreaterThanOrEqual(
				snapshots[i - 1]?.percent ?? 0,
			);
		}

		// Phase trail follows the build's real activity. Pass fields fold
		// synchronously at the pass event; each pass then adds one async
		// shots-only publish, and the pass-2 uploads land after finish
		// without regressing the terminal phase.
		expect(snapshots.map((snapshot) => snapshot.phase)).toEqual([
			// The creation-time snapshot: the card lights up before the first
			// tool call (a reasoning builder can think for minutes).
			"starting",
			"art",
			"art",
			"writing",
			"reviewing",
			"reviewing",
			"reviewing",
			"fixing",
			"reviewing",
			"finishing",
			"finishing",
		]);

		// The badge source: the pass in flight is published synchronously.
		expect(last?.currentPass).toBe(2);
	});

	it("uploads a bounded desktop-heavy subset of each pass's shots", async () => {
		const uploads: Array<{ base64: string; index: number; pass: number }> = [];
		const { snapshots, tracker } = makeTracker({
			uploadShot: async (shot) => {
				uploads.push(shot);

				return `https://assets.example.com/p${shot.pass}-${shot.index}.jpg`;
			},
		});

		tracker.emit(shotEvent(1));
		await tracker.idle();

		expect(uploads).toHaveLength(6);
		expect(uploads.map((shot) => shot.base64)).toEqual([
			"d0",
			"d1",
			"d2",
			"d3",
			"m0",
			"m1",
		]);
		expect(snapshots.at(-1)?.shots).toHaveLength(6);
		expect(
			snapshots.at(-1)?.shots.filter((shot) => shot.viewport === "mobile"),
		).toHaveLength(2);
	});

	it("omits failed shot uploads without breaking the pass", async () => {
		const { snapshots, tracker } = makeTracker({
			uploadShot: async ({ index }) =>
				index === 1 ? null : `https://assets.example.com/${index}.jpg`,
		});

		tracker.emit(shotEvent(1, { desktop: 2, mobile: 1 }));
		await tracker.idle();

		expect(snapshots.at(-1)?.shots).toHaveLength(2);
		expect(snapshots.at(-1)?.reviewPasses).toBe(1);
	});

	it("keeps the pass fold intact when the uploader itself throws", async () => {
		const { snapshots, tracker } = makeTracker({
			uploadShot: async () => {
				throw new Error("r2 down");
			},
		});

		tracker.emit(shotEvent(1));
		tracker.emit({ summary: "done", type: "finished" });
		await expect(tracker.idle()).resolves.toBeUndefined();

		expect(snapshots.at(-1)).toMatchObject({
			done: true,
			reviewPasses: 1,
			shots: [],
		});
	});

	it("does not count an edit before the first review pass as a fix", () => {
		const { snapshots, tracker } = makeTracker();

		tracker.emit({
			bytes: 10_000,
			html: SECTIONED_HTML,
			kind: "edit",
			type: "page-written",
		});

		expect(snapshots.at(-1)).toMatchObject({ fixes: 0, phase: "reviewing" });
	});

	it("humanizes render findings and clears them on a clean pass", async () => {
		const { snapshots, tracker } = makeTracker();

		tracker.emit({
			...shotEvent(1),
			consoleErrors: ["[mobile] boom"],
			failedRequests: ["[desktop] broken.png", "[mobile] broken.png"],
			overflow: { desktop: 0, mobile: 14 },
		});
		await tracker.idle();

		expect(snapshots.at(-1)?.findings).toEqual([
			"1 console error",
			"2 failed requests",
			"Horizontal overflow on mobile (14px)",
		]);

		tracker.emit(shotEvent(2));
		await tracker.idle();

		expect(snapshots.at(-1)?.findings).toEqual([]);
	});

	it("ignores every event after the accepted finish", async () => {
		const { snapshots, tracker } = makeTracker();

		tracker.emit({ summary: "done", type: "finished" });
		await tracker.idle();
		tracker.emit({ type: "write-start" });
		tracker.emit({ role: "extra", type: "image-start" });

		expect(snapshots.at(-1)).toMatchObject({
			done: true,
			headline: "Publishing the page…",
			phase: "finishing",
		});
	});

	it("survives a throwing publish sink", () => {
		const publish = vi.fn(() => {
			throw new Error("metadata down");
		});
		const { tracker } = makeTracker({ publish });

		expect(() =>
			tracker.emit({ role: "hero", type: "image-start" }),
		).not.toThrow();
		expect(publish).toHaveBeenCalled();
	});
});

describe("parseSections", () => {
	it("prefers aria-label, then a humanized id, then the first heading", () => {
		expect(parseSections(SECTIONED_HTML)).toEqual([
			"Hero",
			"Countdown",
			"Choose your size",
		]);
	});

	it("falls back to h2 texts when the page has no section tags", () => {
		const html = "<html><body><h2>Our story</h2><h2>Pricing</h2></body></html>";

		expect(parseSections(html)).toEqual(["Our story", "Pricing"]);
	});

	it("clips long labels and returns [] for empty documents", () => {
		const longLabel = "An exceptionally verbose section label that keeps going";
		const html = `<html><body><section aria-label="${longLabel}"></section></body></html>`;

		const [clipped] = parseSections(html);

		expect(clipped?.length).toBeLessThanOrEqual(25);
		expect(clipped?.endsWith("…")).toBe(true);
		expect(parseSections("")).toEqual([]);
	});
});
