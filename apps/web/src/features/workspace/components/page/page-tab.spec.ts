import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let isPreviewingHistorical = false;
let dirtyCount = 0;

vi.mock("@/lib/i18n", () => ({
	useDictionary: () => ({}),
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("../../lib/store", () => ({
	useWorkspace: () => ({ isPreviewingHistorical }),
}));

vi.mock("../../lib/use-page-editor", () => ({
	usePageEditor: () => ({
		dirtyCount,
		isSaving: false,
		openDiscardPrompt: vi.fn(),
		save: vi.fn(),
	}),
}));

import type { TargetCommentEntry } from "../../lib/use-target-comments";
import {
	dispatchPopoverTargetComment,
	previewReadyMessages,
	routePreviewAskAiShortcut,
	SaveBar,
	selectionRectAfterSelect,
	syncPreviewSuspension,
	targetCommentChromeVisibility,
	targetCommentDraftVersionAfterDispatch,
} from "./page-tab";

const firstComment: TargetCommentEntry = {
	wid: "hero-title",
	tag: "h1",
	excerpt: "Hero title",
	comment: "Make this larger",
};
const secondComment: TargetCommentEntry = {
	wid: "price-card",
	tag: "article",
	excerpt: "Starter plan",
	comment: "Highlight this plan",
};
const currentComment: TargetCommentEntry = {
	wid: "hero-cta",
	tag: "a",
	excerpt: "Get started",
	comment: "Use a stronger label",
};

describe("SaveBar", () => {
	beforeEach(() => {
		isPreviewingHistorical = false;
		dirtyCount = 0;
	});

	it("does not expose save or discard actions over a historical canvas", () => {
		isPreviewingHistorical = true;
		dirtyCount = 3;

		expect(renderToStaticMarkup(createElement(SaveBar))).toBe("");
	});

	it("remains actionable for pending edits on the latest canvas", () => {
		dirtyCount = 3;

		const html = renderToStaticMarkup(createElement(SaveBar));

		expect(html).toContain("workspace.page.editor.discard");
		expect(html).toContain("workspace.page.editor.save");
	});

	it("replays mode, pins, AI targets, and suspension whenever the iframe becomes ready", () => {
		expect(
			previewReadyMessages(
				"select",
				[
					{ wid: "hero-title", number: 1 },
					{ wid: "price-card", number: 2 },
				],
				["hero-title", "price-card"],
				true,
			),
		).toEqual([
			{
				source: "wandit-preview",
				v: 1,
				type: "set-mode",
				payload: { mode: "select" },
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-comment-pins",
				payload: {
					pins: [
						{ wid: "hero-title", number: 1 },
						{ wid: "price-card", number: 2 },
					],
				},
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-ai-targets",
				payload: { wids: ["hero-title", "price-card"] },
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-suspended",
				payload: { suspended: true },
			},
		]);

		expect(previewReadyMessages("browse", [], [], false).slice(1)).toEqual([
			{
				source: "wandit-preview",
				v: 1,
				type: "set-comment-pins",
				payload: { pins: [] },
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-ai-targets",
				payload: { wids: [] },
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-suspended",
				payload: { suspended: false },
			},
		]);
	});

	it("emits the scoped-AI suspension lifecycle false → true → false", () => {
		const post = vi.fn();
		for (const suspended of [false, true, false]) {
			syncPreviewSuspension(post, suspended);
		}

		expect(post.mock.calls.map(([message]) => message)).toEqual([
			{
				source: "wandit-preview",
				v: 1,
				type: "set-suspended",
				payload: { suspended: false },
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-suspended",
				payload: { suspended: true },
			},
			{
				source: "wandit-preview",
				v: 1,
				type: "set-suspended",
				payload: { suspended: false },
			},
		]);
	});

	it("routes the iframe shortcut to the select-mode comment popover only", () => {
		const focus = vi.fn();

		expect(routePreviewAskAiShortcut("select", focus)).toBe(true);
		expect(focus).toHaveBeenCalledOnce();

		focus.mockClear();
		expect(routePreviewAskAiShortcut("edit", focus)).toBe(false);
		expect(focus).not.toHaveBeenCalled();
	});

	it("keeps a cached rect for either same-wid re-select path and clears it for a new wid", () => {
		const singleStopRect = {
			wid: "hero-section",
			left: 0,
			top: 0,
			width: 400,
			height: 500,
		};
		const distantReclickRect = {
			wid: "hero-title",
			left: 32,
			top: 48,
			width: 240,
			height: 64,
		};

		expect(selectionRectAfterSelect(singleStopRect, "hero-section")).toBe(
			singleStopRect,
		);
		expect(selectionRectAfterSelect(distantReclickRect, "hero-title")).toBe(
			distantReclickRect,
		);
		expect(selectionRectAfterSelect(distantReclickRect, "hero-cta")).toBeNull();
	});

	it("persists an empty-queue popover comment before immediate dispatch", async () => {
		let persistedQueue: TargetCommentEntry[] = [];
		const enqueue = vi.fn((entry: TargetCommentEntry) => {
			persistedQueue = [entry];
			return true;
		});
		const dispatch = vi.fn(async (comments: readonly TargetCommentEntry[]) => {
			expect(comments).toEqual(persistedQueue);
			persistedQueue = [];
			return "sent" as const;
		});

		await expect(
			dispatchPopoverTargetComment({
				entry: currentComment,
				queuedComments: [],
				enqueue,
				dispatch,
			}),
		).resolves.toBe("sent");
		expect(enqueue).toHaveBeenCalledWith(currentComment);
		expect(dispatch).toHaveBeenCalledWith([currentComment]);
		expect(persistedQueue).toEqual([]);
	});

	it("restores the exact first-comment draft after a failed dispatch", async () => {
		const draftText = "Keep this exact first-comment draft";
		const entry = { ...currentComment, comment: draftText };
		let persistedQueue: TargetCommentEntry[] = [];
		const enqueue = vi.fn((comment: TargetCommentEntry) => {
			persistedQueue = [comment];
			return true;
		});

		await expect(
			dispatchPopoverTargetComment({
				entry,
				queuedComments: [],
				enqueue,
				dispatch: async (comments) => {
					expect(comments).toEqual(persistedQueue);
					return "failed";
				},
			}),
		).resolves.toBe("failed");

		const remountedDraft = persistedQueue.find(({ wid }) => wid === entry.wid);
		expect(remountedDraft?.comment).toBe(draftText);
	});

	it("queues the current comment last before sending the whole ordered queue", async () => {
		let persistedQueue = [firstComment, secondComment];
		const enqueue = vi.fn((entry: TargetCommentEntry) => {
			persistedQueue = [...persistedQueue, entry];
			return true;
		});
		const dispatch = vi.fn(async () => {
			persistedQueue = [];
			return "sent" as const;
		});

		await expect(
			dispatchPopoverTargetComment({
				entry: currentComment,
				queuedComments: [firstComment, secondComment],
				enqueue,
				dispatch,
			}),
		).resolves.toBe("sent");
		expect(dispatch).toHaveBeenCalledWith([
			firstComment,
			secondComment,
			currentComment,
		]);
		expect(persistedQueue).toEqual([]);
	});

	it("retains the newly queued comment and draft identity after a failed send", async () => {
		let persistedQueue = [firstComment];
		const enqueue = vi.fn((entry: TargetCommentEntry) => {
			persistedQueue = [...persistedQueue, entry];
			return true;
		});

		await expect(
			dispatchPopoverTargetComment({
				entry: currentComment,
				queuedComments: [firstComment],
				enqueue,
				dispatch: async () => "failed",
			}),
		).resolves.toBe("failed");
		expect(persistedQueue).toEqual([firstComment, currentComment]);
		expect(targetCommentDraftVersionAfterDispatch(4, "failed")).toBe(4);
	});

	it("hides target chrome during dispatch and restores retained state after failure", () => {
		const retainedState = {
			previewMode: "select" as const,
			selectionWid: currentComment.wid,
			selectionRectWid: currentComment.wid,
			queuedCount: 2,
			isPreviewingHistorical: false,
		};

		expect(
			targetCommentChromeVisibility({
				...retainedState,
				isAskAiDispatching: true,
			}),
		).toEqual({
			showTargetPopover: false,
			showTargetReviewBar: false,
		});

		expect(targetCommentDraftVersionAfterDispatch(4, "failed")).toBe(4);
		expect(
			targetCommentChromeVisibility({
				...retainedState,
				isAskAiDispatching: false,
			}),
		).toEqual({
			showTargetPopover: true,
			showTargetReviewBar: true,
		});
	});

	it("resets the popover draft identity after any successful dispatch", () => {
		expect(targetCommentDraftVersionAfterDispatch(4, "sent")).toBe(5);
		expect(targetCommentDraftVersionAfterDispatch(4, "blocked")).toBe(4);
	});

	it("blocks an extra target when the queue cannot accept it", async () => {
		const enqueue = vi.fn(() => false);
		const dispatch = vi.fn(async () => "sent" as const);

		await expect(
			dispatchPopoverTargetComment({
				entry: currentComment,
				queuedComments: [firstComment],
				enqueue,
				dispatch,
			}),
		).resolves.toBe("blocked");
		expect(dispatch).not.toHaveBeenCalled();
	});
});
