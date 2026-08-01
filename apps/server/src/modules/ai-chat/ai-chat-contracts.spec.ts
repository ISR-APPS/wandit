import {
	aiChatMessageMetadataSchema,
	aiChatRequestMetadataSchema,
	aiChatSelectedTargetSchema,
	aiElementOpSchema,
	applyElementOpsInputSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("AI chat selected-target contract", () => {
	it("accepts the exact client boundary without changing the clean shape", () => {
		const target = {
			excerpt: "e".repeat(160),
			tag: "t".repeat(32),
			wid: "hero-title",
		};

		expect(aiChatSelectedTargetSchema.parse(target)).toEqual(target);
	});

	it.each([
		{
			field: "tag",
			target: { excerpt: "Headline", tag: "t".repeat(33), wid: "hero-title" },
		},
		{
			field: "excerpt",
			target: { excerpt: "e".repeat(161), tag: "h1", wid: "hero-title" },
		},
	])("rejects an overlong $field", ({ target }) => {
		expect(aiChatSelectedTargetSchema.safeParse(target).success).toBe(false);
	});

	it("round-trips multi-target metadata and keeps legacy metadata valid", () => {
		const targets = Array.from({ length: 10 }, (_, index) => ({
			excerpt: index % 2 === 0 ? `Comment ${index + 1}` : null,
			tag: "p",
			wid: `target-${index + 1}`,
		}));

		expect(
			aiChatMessageMetadataSchema.parse({ selectedTargets: targets }),
		).toEqual({ selectedTargets: targets });
		expect(
			aiChatMessageMetadataSchema.parse({ selectedTarget: targets[0] }),
		).toEqual({ selectedTarget: targets[0] });
	});

	it("bounds selectedTargets and validates every target", () => {
		const target = { excerpt: null, tag: "p", wid: "target" };

		expect(
			aiChatMessageMetadataSchema.safeParse({ selectedTargets: [] }).success,
		).toBe(false);
		expect(
			aiChatMessageMetadataSchema.safeParse({
				selectedTargets: Array.from({ length: 11 }, (_, index) => ({
					...target,
					wid: `target-${index + 1}`,
				})),
			}).success,
		).toBe(false);
		expect(
			aiChatMessageMetadataSchema.safeParse({
				selectedTargets: [{ ...target, excerpt: "x".repeat(161) }],
			}).success,
		).toBe(false);
	});

	it("bounds selectedWids and preserves their order", () => {
		const selectedWids = Array.from(
			{ length: 10 },
			(_, index) => `target-${index + 1}`,
		);

		expect(aiChatRequestMetadataSchema.parse({ selectedWids })).toEqual({
			selectedWids,
		});
		expect(
			aiChatRequestMetadataSchema.safeParse({ selectedWids: [] }).success,
		).toBe(false);
		expect(
			aiChatRequestMetadataSchema.safeParse({
				selectedWids: [...selectedWids, "target-11"],
			}).success,
		).toBe(false);
		expect(
			aiChatRequestMetadataSchema.safeParse({ selectedWids: ["INVALID"] })
				.success,
		).toBe(false);
		expect(
			aiChatRequestMetadataSchema.safeParse({ selectedWid: "legacy-target" })
				.success,
		).toBe(true);
	});
});

describe("AI element-op contract", () => {
	it.each([
		{ kind: "text", value: "Updated copy", wid: "hero-title" },
		{
			kind: "element-style",
			value: { fontSize: "24px", textAlign: "center" },
			wid: "hero-title",
		},
		{ kind: "set-tokens", value: { primary: "#123456" } },
		{
			kind: "set-link-href",
			value: "https://example.com/contact",
			wid: "contact-link",
		},
		{ kind: "remove-element", wid: "hero-kicker" },
		{
			kind: "section-style",
			value: {
				backgroundColor: "#ffffff",
				backgroundImage: "none",
				paddingBottom: "l",
				paddingTop: "m",
			},
			wid: "hero",
		},
	])("accepts $kind", (op) => {
		expect(aiElementOpSchema.safeParse(op).success).toBe(true);
	});

	it.each([
		{ kind: "reset-tokens" },
		{
			kind: "image-src",
			value: "https://example.com/image.png",
			wid: "hero-image",
		},
		{ kind: "brand-logo", value: null, wid: "brand-logo" },
		{ kind: "placeholder-image", wid: "hero-image" },
		{ kind: "set-placeholder", value: "Email", wid: "email" },
		{
			kind: "replace-section",
			value: "<section><p>Replacement content</p></section>",
			wid: "hero",
		},
	])("rejects excluded $kind", (op) => {
		expect(aiElementOpSchema.safeParse(op).success).toBe(false);
	});

	it("rejects an HTTPS section background image", () => {
		expect(
			aiElementOpSchema.safeParse({
				kind: "section-style",
				value: { backgroundImage: "https://example.com/background.png" },
				wid: "hero",
			}).success,
		).toBe(false);
	});

	it.each([
		{ danger: "#123456" },
		{ danger: "#654321", primary: "#123456" },
		{ primary: "red" },
		{ radius: "12%" },
		{ "font-heading": "comic-sans" },
	])("rejects invalid token names or values %#", (value) => {
		expect(
			aiElementOpSchema.safeParse({ kind: "set-tokens", value }).success,
		).toBe(false);
	});

	it("bounds apply_element_ops batches at twenty", () => {
		const op = { kind: "text", value: "Updated", wid: "hero-title" };

		expect(
			applyElementOpsInputSchema.safeParse({
				ops: Array.from({ length: 20 }, () => op),
			}).success,
		).toBe(true);
		expect(
			applyElementOpsInputSchema.safeParse({
				ops: Array.from({ length: 21 }, () => op),
			}).success,
		).toBe(false);
		expect(applyElementOpsInputSchema.safeParse({ ops: [] }).success).toBe(
			false,
		);
	});
});
