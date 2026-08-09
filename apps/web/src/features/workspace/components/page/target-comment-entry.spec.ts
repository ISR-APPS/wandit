import { describe, expect, it } from "vitest";

import type { PreviewSelection } from "../../lib/preview-editor/messages";
import { TARGET_COMMENT_MAX_LENGTH } from "../../lib/use-target-comments";
import { targetCommentEntry } from "./target-comment-popover";

describe("targetCommentEntry", () => {
	it("clamps forged target metadata and comment text to contract bounds", () => {
		const entry = targetCommentEntry(
			{
				wid: "hero-title",
				tag: "h".repeat(40),
				excerpt: "e".repeat(180),
			} as PreviewSelection,
			"c".repeat(TARGET_COMMENT_MAX_LENGTH + 20),
		);

		expect(entry).toEqual({
			wid: "hero-title",
			tag: "h".repeat(32),
			excerpt: "e".repeat(160),
			comment: "c".repeat(TARGET_COMMENT_MAX_LENGTH),
		});
	});

	it.each([
		"",
		"Hero_Title",
		"a".repeat(49),
	])("drops an invalid target wid %j", (wid) => {
		expect(
			targetCommentEntry(
				{ wid, tag: "div", excerpt: null } as PreviewSelection,
				"Comment",
			),
		).toBeNull();
	});
});
