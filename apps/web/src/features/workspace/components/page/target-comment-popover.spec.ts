import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		dir: "rtl" as const,
		t: (key: string, params?: { count?: number }) =>
			params?.count === undefined
				? (key.split(".").at(-1) ?? key)
				: `${key.split(".").at(-1)}:${params.count}`,
	}),
}));

import type { PreviewSelectionRect } from "../../lib/preview-editor/messages";
import type { TargetCommentEntry } from "../../lib/use-target-comments";
import {
	positionTargetCommentPopover,
	TargetCommentPopover,
} from "./target-comment-popover";
import { TargetCommentReviewBar } from "./target-comment-review-bar";

const rect: PreviewSelectionRect = {
	wid: "hero-title",
	left: 20,
	top: 30,
	width: 100,
	height: 40,
};
const nullStageRef = { current: null } as RefObject<HTMLDivElement | null>;
const nullIframeRef = {
	current: null,
} as RefObject<HTMLIFrameElement | null>;

function renderPopover(
	queuedComment: TargetCommentEntry | null,
	queueFull = false,
	queuedCount = queuedComment ? 1 : 0,
) {
	return renderToStaticMarkup(
		createElement(TargetCommentPopover, {
			selectionRect: rect,
			queuedComment,
			queuedCount,
			queueFull,
			disabled: false,
			stageRef: nullStageRef,
			iframeRef: nullIframeRef,
			registerFocus: vi.fn(),
			onSend: vi.fn(),
			onAdd: vi.fn(),
			onUpdate: vi.fn(),
			onRemove: vi.fn(),
		}),
	);
}

describe("TargetCommentPopover", () => {
	it("prefills a queued comment and exposes update/remove actions", () => {
		const html = renderPopover({
			wid: "hero-title",
			tag: "h1",
			excerpt: "A headline",
			comment: "Tighten this copy",
		});

		expect(html).toContain("Tighten this copy");
		expect(html).toContain("updateComment");
		expect(html).toContain("removeComment");
		expect(html).not.toContain(">addComment<");
	});

	it("disables both new-target actions and shows a localized hint at the queue cap", () => {
		const html = renderPopover(null, true, 10);

		expect(html).toContain("queueFull");
		expect(html).toContain("sendAll:11");
		expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
		expect(html).toMatch(/<button[^>]*disabled=""[^>]*>addComment<\/button>/);
	});

	it("labels a new target as Send all when queued comments already exist", () => {
		const html = renderPopover(null, false, 2);

		expect(html).toContain(">sendAll:3<");
		expect(html).not.toContain(">send<");
	});

	it("keeps update and remove available for an already-queued target at the cap", () => {
		const html = renderPopover(
			{
				wid: "hero-title",
				tag: "h1",
				excerpt: "A headline",
				comment: "Tighten this copy",
			},
			true,
			10,
		);

		expect(html).not.toContain("queueFull");
		expect(html).not.toContain('disabled=""');
		expect(html).toContain(">updateComment<");
		expect(html).toContain(">removeComment<");
	});

	it("uses logical inline placement for RTL-safe anchoring", () => {
		const html = renderPopover(null);

		expect(html).toContain('data-logical-placement="inline-start"');
		expect(html).toContain("inset-inline-start:");
		expect(html).not.toMatch(/style="[^"]*\bleft:/);
	});

	it("converts iframe coordinates, clamps, and flips above collisions", () => {
		expect(
			positionTargetCommentPopover({
				dir: "ltr",
				selectionRect: { ...rect, top: 330 },
				iframeRect: { left: 140, top: 80, width: 400, height: 360 },
				stageRect: { left: 100, top: 50, width: 500, height: 400 },
				popoverSize: { width: 200, height: 184 },
			}),
		).toEqual({ insetInlineStart: 60, top: 168, placement: "above" });

		const rtl = positionTargetCommentPopover({
			dir: "rtl",
			selectionRect: rect,
			iframeRect: { left: 140, top: 80, width: 400, height: 360 },
			stageRect: { left: 100, top: 50, width: 500, height: 400 },
			popoverSize: { width: 200, height: 184 },
		});
		expect(rtl.insetInlineStart).toBe(292);
	});
});

describe("TargetCommentReviewBar", () => {
	it("renders the count, clear-all control, and batch Send", () => {
		const html = renderToStaticMarkup(
			createElement(TargetCommentReviewBar, {
				count: 3,
				disabled: false,
				onClear: vi.fn(),
				onSend: vi.fn(),
			}),
		);

		expect(html).toContain("commentsCount:3");
		expect(html).toContain('aria-label="clearAll"');
		expect(html).toContain(">send<");
		expect(html).toContain("start-1/2");
		expect(html).toContain("rtl:translate-x-1/2");
	});
});
