import { describe, expect, it, vi } from "vitest";
import {
	buildPendingImageOps,
	buildPendingOps,
	buildPendingTokenOps,
	countPendingTokenSlot,
	diffPendingPlaceholderImages,
	fontStylesheetHrefsForResetPreview,
	hasOnlyInlineFormattingTags,
	nextPendingTokensReset,
	omitPendingRemovals,
	omitPendingWids,
	shouldClearSpeculativeTokenReset,
	shouldQueueTokenReset,
	sourceForPendingOps,
} from "./page-editor-pending";
import {
	beginManualEditGuard,
	diffPendingSectionStyles,
	drainPageEditorSaves,
	endManualEditGuard,
	joinPageEditorSave,
	pruneDestroyedTargetComments,
} from "./use-page-editor";

describe("page editor pending ops", () => {
	it("keeps image sources before placeholder swaps", () => {
		const ops = buildPendingImageOps(
			{ "e-1": "https://assets.wandit.example/new.webp" },
			{
				"e-2": { width: 800, height: 600 },
				"e-3": null,
			},
		);

		expect(ops).toEqual([
			{
				kind: "image-src",
				wid: "e-1",
				value: "https://assets.wandit.example/new.webp",
			},
			{
				kind: "placeholder-image",
				wid: "e-2",
				value: { width: 800, height: 600 },
			},
			{ kind: "placeholder-image", wid: "e-3" },
		]);
	});

	it("keeps reset-tokens before a following token patch", () => {
		expect(buildPendingTokenOps(true, { radius: "0.5rem" })).toEqual([
			{ kind: "reset-tokens" },
			{ kind: "set-tokens", value: { radius: "0.5rem" } },
		]);
	});

	it("orders removals before parent text edits in the saved batch", () => {
		const ops = buildPendingOps({
			text: { "e-1": "Fast delivery" },
			styles: {},
			images: {},
			placeholderImages: {},
			links: {},
			placeholders: {},
			removals: ["e-2"],
			sectionStyles: {},
			tokens: {},
			tokensReset: false,
		});

		expect(ops).toEqual([
			{ kind: "remove-element", wid: "e-2" },
			{ kind: "text", wid: "e-1", value: "Fast delivery" },
		]);
	});

	it("orders brand swaps after image ops and before descendant-sensitive styles", () => {
		const ops = buildPendingOps({
			text: {},
			styles: { "e-child": { color: "#112233" } },
			images: { "e-image": "https://assets.wandit.example/new.webp" },
			placeholderImages: {},
			brandLogos: {
				"brand-nav": "https://assets.wandit.example/logo.png",
				"brand-footer": null,
			},
			links: { "e-link": "/new" },
			placeholders: {},
			removals: [],
			sectionStyles: {},
			tokens: {},
			tokensReset: false,
		});

		expect(ops.map((op) => op.kind)).toEqual([
			"image-src",
			"brand-logo",
			"brand-logo",
			"set-link-href",
			"element-style",
		]);
		expect(ops[2]).toEqual({
			kind: "brand-logo",
			wid: "brand-footer",
			value: null,
		});
	});

	it("drops every pending descendant op before a parent text flatten", () => {
		const descendants = ["e-2", "e-3"];

		expect(
			omitPendingWids(
				{
					"e-1": "parent text",
					"e-2": "child text",
					"e-3": "nested child text",
					"e-4": "sibling text",
				},
				descendants,
			),
		).toEqual({ "e-1": "parent text", "e-4": "sibling text" });
		expect(
			omitPendingWids(
				{
					"e-2": { color: "#112233" },
					"e-4": { color: "#445566" },
				},
				descendants,
			),
		).toEqual({ "e-4": { color: "#445566" } });
		expect(
			omitPendingWids(
				{ "e-2": "Child placeholder", "e-4": "Sibling placeholder" },
				descendants,
			),
		).toEqual({ "e-4": "Sibling placeholder" });
		expect(omitPendingRemovals(["e-2", "e-4"], descendants)).toEqual(["e-4"]);
	});

	it("prunes descendant edits before a brand wrapper replaces its inner HTML", () => {
		const descendants = ["brand-text", "brand-icon"];

		expect(
			omitPendingWids(
				{
					"brand-text": "Old wordmark",
					"brand-icon": "https://assets.wandit.example/icon.png",
					sibling: "Keep me",
				},
				descendants,
			),
		).toEqual({ sibling: "Keep me" });
		expect(
			omitPendingWids(
				{
					"brand-text": { color: "#112233" },
					sibling: { color: "#445566" },
				},
				descendants,
			),
		).toEqual({ sibling: { color: "#445566" } });
		expect(omitPendingRemovals(["brand-icon", "sibling"], descendants)).toEqual(
			["sibling"],
		);
	});

	it("prunes queued comments for every descendant destroyed by a parent edit", () => {
		const queued = new Set(["text-child", "brand-icon", "sibling"]);
		let pruneNoticeCount = 0;
		const pruneTargetComment = vi.fn((wid: string) => {
			if (!queued.delete(wid)) return false;
			pruneNoticeCount += 1;
			return true;
		});

		expect(
			pruneDestroyedTargetComments(
				["text-child", "brand-icon", "text-child", "missing"],
				pruneTargetComment,
			),
		).toBe(2);
		expect([...queued]).toEqual(["sibling"]);
		expect(pruneNoticeCount).toBe(2);
		expect(pruneTargetComment.mock.calls.map(([wid]) => wid)).toEqual([
			"text-child",
			"brand-icon",
			"missing",
		]);
	});

	it("mirrors the server's all-inline text flattening shape", () => {
		expect(hasOnlyInlineFormattingTags(["SPAN", "A", "EM"])).toBe(true);
		expect(hasOnlyInlineFormattingTags([])).toBe(true);
		expect(hasOnlyInlineFormattingTags(["SVG", "SPAN"])).toBe(false);
		expect(hasOnlyInlineFormattingTags(["IMG"])).toBe(false);
		expect(hasOnlyInlineFormattingTags(["INPUT"])).toBe(false);
	});

	it("keeps reset font links through non-font patches and replay", () => {
		const href =
			"https://fonts.googleapis.com/css2?family=Fraunces&display=swap";
		const reset = {
			values: {
				"font-heading": '"Fraunces", serif',
				"font-body": '"Inter", sans-serif',
			},
			fontStylesheetHrefs: [href],
		};

		expect(
			fontStylesheetHrefsForResetPreview(
				reset,
				{
					...reset.values,
					radius: "1rem",
				},
				false,
			),
		).toEqual([href]);
		expect(
			fontStylesheetHrefsForResetPreview(reset, { radius: "1rem" }, true),
		).toEqual([href]);
		expect(
			fontStylesheetHrefsForResetPreview(
				reset,
				{
					"font-heading": "Poppins",
					"font-body": "Cairo",
				},
				true,
			),
		).toEqual([]);
	});

	it("marks only token-only batches as theme saves", () => {
		const themeOps = buildPendingTokenOps(true, { radius: "0.5rem" });

		expect(sourceForPendingOps(themeOps)).toBe("theme");
		expect(sourceForPendingOps([{ kind: "reset-tokens" }])).toBe("theme");
		expect(
			sourceForPendingOps([
				...themeOps,
				{ kind: "text", wid: "e-1", value: "Changed" },
			]),
		).toBe("inline");
		expect(sourceForPendingOps([])).toBe("inline");
	});

	it("counts reset and token tweaks as one dirty token slot", () => {
		expect(countPendingTokenSlot(false, {})).toBe(0);
		expect(countPendingTokenSlot(true, {})).toBe(1);
		expect(countPendingTokenSlot(false, { radius: "0.5rem" })).toBe(1);
		expect(countPendingTokenSlot(true, { radius: "0.5rem" })).toBe(1);
	});

	it("queues reset when an in-flight token save will replace an original base", () => {
		expect(shouldQueueTokenReset(true, false)).toBe(false);
		expect(shouldQueueTokenReset(true, true)).toBe(true);
		expect(shouldQueueTokenReset(false, false)).toBe(true);
	});

	it("clears only the speculative reset tied to a definitively failed save", () => {
		const reset = { attempt: 4, revision: 2 };

		expect(shouldClearSpeculativeTokenReset(reset, 4, 2)).toBe(true);
		expect(shouldClearSpeculativeTokenReset(reset, 3, 2)).toBe(false);
		expect(shouldClearSpeculativeTokenReset(reset, 4, 3)).toBe(false);
		expect(shouldClearSpeculativeTokenReset(null, 4, 2)).toBe(false);
	});
});

describe("page editor save pruning", () => {
	it("compares placeholder dimensions structurally", () => {
		expect(
			diffPendingPlaceholderImages(
				{
					"e-1": { width: 800, height: 600 },
					"e-2": null,
					"e-3": { width: 640, height: 480 },
					"e-4": null,
				},
				{
					"e-1": { width: 800, height: 600 },
					"e-2": null,
					"e-3": { width: 320, height: 240 },
				},
			),
		).toEqual({
			"e-3": { width: 640, height: 480 },
			"e-4": null,
		});
	});

	it("joins concurrent saves and exposes saved/noop/failed results", async () => {
		let resolveFirst: ((result: "saved") => void) | undefined;
		const first = new Promise<"saved">((resolve) => {
			resolveFirst = resolve;
		});
		const inFlight: { current: Promise<"saved" | "noop" | "failed"> | null } = {
			current: null,
		};
		const run = vi.fn(() => first);

		const joinedA = joinPageEditorSave(inFlight, run);
		const joinedB = joinPageEditorSave(inFlight, () =>
			Promise.resolve("failed"),
		);
		expect(joinedB).toBe(joinedA);
		expect(run).toHaveBeenCalledOnce();
		resolveFirst?.("saved");
		await expect(joinedA).resolves.toBe("saved");
		await Promise.resolve();
		await expect(
			joinPageEditorSave(inFlight, () => Promise.resolve("noop")),
		).resolves.toBe("noop");
		await Promise.resolve();
		await expect(
			joinPageEditorSave(inFlight, () => Promise.resolve("failed")),
		).resolves.toBe("failed");
	});

	it("holds and releases the manual-edit guard across Ask-AI dispatch", () => {
		const blocked = { current: false };

		expect(beginManualEditGuard(blocked)).toBe(true);
		expect(blocked.current).toBe(true);
		expect(beginManualEditGuard(blocked)).toBe(false);
		endManualEditGuard(blocked);
		expect(blocked.current).toBe(false);
		expect(beginManualEditGuard(blocked)).toBe(true);
	});

	it("drains leftovers after joining an older save before scoped AI sends", async () => {
		const saveOnce = vi
			.fn<() => Promise<"saved" | "noop" | "failed">>()
			.mockResolvedValueOnce("saved")
			.mockResolvedValueOnce("saved")
			.mockResolvedValueOnce("noop");

		await expect(drainPageEditorSaves(saveOnce)).resolves.toBe("noop");
		expect(saveOnce).toHaveBeenCalledTimes(3);

		const failed = vi.fn(async () => "failed" as const);
		await expect(drainPageEditorSaves(failed)).resolves.toBe("failed");
		expect(failed).toHaveBeenCalledOnce();
	});

	it("prunes a saved reset but preserves one recorded during another save", () => {
		expect(nextPendingTokensReset(true, true, 1, 1)).toBe(false);
		expect(nextPendingTokensReset(true, true, 2, 1)).toBe(true);
		expect(nextPendingTokensReset(true, false)).toBe(true);
	});

	it("preserves section color edits recorded while an earlier save is in flight", () => {
		expect(
			diffPendingSectionStyles(
				{
					hero: {
						paddingTop: "l",
						backgroundColor: "#445566",
					},
				},
				{
					hero: {
						paddingTop: "l",
						backgroundColor: "#112233",
					},
				},
			),
		).toEqual({ hero: { backgroundColor: "#445566" } });
	});
});
