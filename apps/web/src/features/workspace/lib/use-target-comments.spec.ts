import { describe, expect, it } from "vitest";
import {
	pruneMissingTargetComments,
	removeTargetCommentEntry,
	TARGET_COMMENT_LIMIT,
	TARGET_COMMENT_MAX_LENGTH,
	type TargetCommentEntry,
	targetCommentPins,
	targetCommentsAfterHistoricalPreview,
	targetCommentsAfterVersionChange,
	upsertTargetCommentEntry,
} from "./use-target-comments";

function comment(
	wid: string,
	value = `Comment for ${wid}`,
): TargetCommentEntry {
	return { wid, tag: "p", excerpt: `Excerpt ${wid}`, comment: value };
}

describe("target comment queue", () => {
	it("adds in order and replaces one comment per wid without renumbering", () => {
		const initial = [comment("e-1"), comment("e-2")];
		const updated = upsertTargetCommentEntry(initial, {
			...comment("e-1", "Updated"),
			tag: "h2",
		});

		expect(updated).toEqual([
			{
				wid: "e-1",
				tag: "h2",
				excerpt: "Excerpt e-1",
				comment: "Updated",
			},
			comment("e-2"),
		]);
		expect(targetCommentPins(updated)).toEqual([
			{ wid: "e-1", number: 1 },
			{ wid: "e-2", number: 2 },
		]);
	});

	it("removes by wid and renumbers the remaining pins", () => {
		const remaining = removeTargetCommentEntry(
			[comment("e-1"), comment("e-2"), comment("e-3")],
			"e-2",
		);

		expect(remaining.map(({ wid }) => wid)).toEqual(["e-1", "e-3"]);
		expect(targetCommentPins(remaining)).toEqual([
			{ wid: "e-1", number: 1 },
			{ wid: "e-3", number: 2 },
		]);
	});

	it("caps new targets at ten while allowing an existing target to update", () => {
		const full = Array.from({ length: TARGET_COMMENT_LIMIT }, (_, index) =>
			comment(`e-${index + 1}`),
		);

		expect(upsertTargetCommentEntry(full, comment("e-11"))).toBe(full);
		const updated = upsertTargetCommentEntry(full, comment("e-4", "Revised"));
		expect(updated).toHaveLength(TARGET_COMMENT_LIMIT);
		expect(updated[3]?.comment).toBe("Revised");
	});

	it("bounds comments to the input's 500-character contract", () => {
		const [entry] = upsertTargetCommentEntry(
			[],
			comment("e-1", "x".repeat(TARGET_COMMENT_MAX_LENGTH + 1)),
		);

		expect(entry?.comment).toHaveLength(TARGET_COMMENT_MAX_LENGTH);
	});

	it("preserves comments for an own-save version and clears on a foreign version", () => {
		const queued = [comment("e-1"), comment("e-2")];

		expect(targetCommentsAfterVersionChange(queued, true)).toBe(queued);
		expect(targetCommentsAfterVersionChange(queued, false)).toEqual([]);
	});

	it("clears when entering a historical preview", () => {
		const queued = [comment("e-1")];

		expect(targetCommentsAfterHistoricalPreview(queued, true)).toEqual([]);
		expect(targetCommentsAfterHistoricalPreview(queued, false)).toBe(queued);
	});

	it("prunes dead targets against the current version and reports the count", () => {
		const queued = [comment("e-1"), comment("e-2"), comment("e-3")];
		const result = pruneMissingTargetComments(queued, new Set(["e-1", "e-3"]));

		expect(result.removedCount).toBe(1);
		expect(result.comments.map(({ wid }) => wid)).toEqual(["e-1", "e-3"]);
		expect(targetCommentPins(result.comments)).toEqual([
			{ wid: "e-1", number: 1 },
			{ wid: "e-3", number: 2 },
		]);
	});

	it("keeps queue and pin state unchanged across iframe-only remounts", () => {
		const queued = [comment("e-1"), comment("e-2")];
		const before = targetCommentPins(queued);
		const after = targetCommentPins(queued);

		expect(after).toEqual(before);
	});
});
