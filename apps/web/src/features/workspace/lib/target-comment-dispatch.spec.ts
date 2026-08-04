import { describe, expect, it, vi } from "vitest";
import {
	buildTargetCommentMessage,
	dispatchTargetComments,
} from "./target-comment-dispatch";
import {
	TARGET_COMMENT_MAX_LENGTH,
	type TargetCommentEntry,
} from "./use-target-comments";

const comments: TargetCommentEntry[] = [
	{ wid: "hero-title", tag: "h1", excerpt: "Hello", comment: "Make it warmer" },
	{
		wid: "hero-cta",
		tag: "button",
		excerpt: "Buy now",
		comment: "Use a softer label",
	},
];

function harness(
	overrides: {
		save?: () => Promise<"saved" | "noop" | "failed">;
		send?: () => Promise<boolean>;
	} = {},
) {
	const events: string[] = [];
	const onSendFailure = vi.fn(() => events.push("failure"));
	const onSuccess = vi.fn(() => events.push("clear"));
	const send = vi.fn(async (..._args: unknown[]) => {
		events.push("send");
		return overrides.send ? overrides.send() : true;
	});

	return {
		events,
		onSendFailure,
		onSuccess,
		send,
		input: {
			comments,
			begin: () => {
				events.push("begin");
				return true;
			},
			end: () => events.push("end"),
			save: async () => {
				events.push("save");
				return overrides.save ? overrides.save() : "saved";
			},
			send,
			onSendFailure,
			onSuccess,
		},
	};
}

describe("target comment dispatch", () => {
	it("numbers the body in the same order as both target arrays", () => {
		expect(buildTargetCommentMessage(comments)).toEqual({
			body: "1. Make it warmer\n2. Use a softer label",
			selectedWids: ["hero-title", "hero-cta"],
			selectedTargets: [
				{ wid: "hero-title", tag: "h1", excerpt: "Hello" },
				{ wid: "hero-cta", tag: "button", excerpt: "Buy now" },
			],
		});
	});

	it("filters a poisoned queue entry and clamps valid metadata before sending", async () => {
		const test = harness();
		const poisonedComments: TargetCommentEntry[] = [
			{
				wid: "INVALID_WID",
				tag: "div",
				excerpt: "Forged target",
				comment: "Never send this",
			},
			{
				wid: "hero-title",
				tag: "h".repeat(40),
				excerpt: "e".repeat(180),
				comment: "c".repeat(TARGET_COMMENT_MAX_LENGTH + 20),
			},
		];

		await expect(
			dispatchTargetComments({
				...test.input,
				comments: poisonedComments,
			}),
		).resolves.toBe("sent");

		expect(test.send).toHaveBeenCalledWith(
			`1. ${"c".repeat(TARGET_COMMENT_MAX_LENGTH)}`,
			{
				selectedWids: ["hero-title"],
				selectedTargets: [
					{
						wid: "hero-title",
						tag: "h".repeat(32),
						excerpt: "e".repeat(160),
					},
				],
			},
		);
	});

	it("clears the queue and pins only after a successful batch send", async () => {
		const test = harness();

		await expect(dispatchTargetComments(test.input)).resolves.toBe("sent");
		expect(test.events).toEqual(["begin", "save", "send", "clear", "end"]);
		expect(test.send).toHaveBeenCalledWith(
			"1. Make it warmer\n2. Use a softer label",
			{
				selectedWids: ["hero-title", "hero-cta"],
				selectedTargets: [
					{ wid: "hero-title", tag: "h1", excerpt: "Hello" },
					{ wid: "hero-cta", tag: "button", excerpt: "Buy now" },
				],
			},
		);
	});

	it("keeps the queue when the manual save fails", async () => {
		const test = harness({ save: async () => "failed" });

		await expect(dispatchTargetComments(test.input)).resolves.toBe("failed");
		expect(test.events).toEqual(["begin", "save", "end"]);
		expect(test.send).not.toHaveBeenCalled();
		expect(test.onSuccess).not.toHaveBeenCalled();
		expect(test.onSendFailure).not.toHaveBeenCalled();
	});

	it("keeps the queue and reports a failed send", async () => {
		const test = harness({ send: async () => false });

		await expect(dispatchTargetComments(test.input)).resolves.toBe("failed");
		expect(test.events).toEqual(["begin", "save", "send", "failure", "end"]);
		expect(test.onSuccess).not.toHaveBeenCalled();
		expect(test.onSendFailure).toHaveBeenCalledOnce();
	});

	it("uses the array metadata path for an immediate single-target send", async () => {
		const test = harness();
		const immediate = [comments[0] as TargetCommentEntry];

		await dispatchTargetComments({ ...test.input, comments: immediate });

		expect(test.send).toHaveBeenCalledWith("1. Make it warmer", {
			selectedWids: ["hero-title"],
			selectedTargets: [{ wid: "hero-title", tag: "h1", excerpt: "Hello" }],
		});
	});
});
