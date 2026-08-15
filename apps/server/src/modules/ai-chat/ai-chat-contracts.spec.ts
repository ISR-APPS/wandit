import {
	aiChatBillingErrorDataSchema,
	aiChatMessageMetadataSchema,
	aiChatRequestMetadataSchema,
	aiChatSelectedTargetSchema,
	aiElementOpSchema,
	applyElementOpsInputSchema,
	clientEditOpSchema,
	editOpSchema,
	generateImageInputSchema,
	imageGenerationAttemptSchema,
	insertSectionInputSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("AI chat billing-error data contract", () => {
	it("locks the typed 402 stream payload", () => {
		const data = {
			code: "INSUFFICIENT_CREDITS",
			details: { availableCredits: 2, requiredCredits: 5 },
			statusCode: 402,
		};

		expect(aiChatBillingErrorDataSchema.parse(data)).toEqual(data);
		expect(
			aiChatBillingErrorDataSchema.safeParse({
				...data,
				statusCode: 400,
			}).success,
		).toBe(false);
	});
});

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
			kind: "image-src",
			value: "https://assets.wandit.example/images/hero.png",
			wid: "hero-image",
		},
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
				backgroundImage: "https://assets.wandit.example/images/background.png",
				paddingBottom: "l",
				paddingTop: "m",
			},
			wid: "hero",
		},
		{
			kind: "insert-element",
			position: "append",
			value: '<a href="/pricing">View pricing</a>',
			wid: "hero-actions",
		},
	])("accepts $kind", (op) => {
		expect(aiElementOpSchema.safeParse(op).success).toBe(true);
	});

	it.each([
		{ kind: "reset-tokens" },
		{ kind: "brand-logo", value: null, wid: "brand-logo" },
		{ kind: "placeholder-image", wid: "hero-image" },
		{ kind: "set-placeholder", value: "Email", wid: "email" },
		{
			kind: "replace-section",
			value: "<section><p>Replacement content</p></section>",
			wid: "hero",
		},
		{
			kind: "insert-section",
			position: "after",
			value: "<section><p>Inserted content</p></section>",
			wid: "hero",
		},
	])("rejects excluded $kind", (op) => {
		expect(aiElementOpSchema.safeParse(op).success).toBe(false);
	});

	it("rejects an arbitrary image-src value", () => {
		expect(
			aiElementOpSchema.safeParse({
				kind: "image-src",
				value: "not-a-url",
				wid: "hero-image",
			}).success,
		).toBe(false);
	});

	it.each([
		"http://assets.wandit.example/background.png",
		"not-a-url",
	])("rejects a non-HTTPS or arbitrary section background: %s", (backgroundImage) => {
		expect(
			aiElementOpSchema.safeParse({
				kind: "section-style",
				value: { backgroundImage },
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

	it("bounds insert-element HTML and validates its position", () => {
		const op = {
			kind: "insert-element",
			position: "before",
			value: "x",
			wid: "hero-title",
		};

		expect(aiElementOpSchema.safeParse(op).success).toBe(true);
		expect(
			aiElementOpSchema.safeParse({ ...op, position: "after" }).success,
		).toBe(true);
		expect(
			aiElementOpSchema.safeParse({ ...op, position: "append" }).success,
		).toBe(true);
		expect(
			aiElementOpSchema.safeParse({ ...op, value: "x".repeat(60_000) }).success,
		).toBe(true);
		expect(aiElementOpSchema.safeParse({ ...op, value: "" }).success).toBe(
			false,
		);
		expect(
			aiElementOpSchema.safeParse({ ...op, value: "x".repeat(60_001) }).success,
		).toBe(false);
		expect(
			aiElementOpSchema.safeParse({ ...op, position: "inside" }).success,
		).toBe(false);
	});

	it("keeps insertion ops server-only at the edit-op boundary", () => {
		const insertElement = {
			kind: "insert-element",
			position: "append",
			value: "<button>Buy now</button>",
			wid: "hero-actions",
		};
		const insertSection = {
			kind: "insert-section",
			position: "before",
			value: "<section><p>Announcement</p></section>",
			wid: "hero",
		};

		expect(editOpSchema.safeParse(insertElement).success).toBe(true);
		expect(editOpSchema.safeParse(insertSection).success).toBe(true);
		expect(clientEditOpSchema.safeParse(insertElement).success).toBe(false);
		expect(clientEditOpSchema.safeParse(insertSection).success).toBe(false);
		expect(aiElementOpSchema.safeParse(insertSection).success).toBe(false);
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

describe("insert_section contract", () => {
	const html = "<section><p>New section</p></section>";

	it("accepts an anchor and defaults its position to after", () => {
		expect(insertSectionInputSchema.parse({ anchorWid: "hero", html })).toEqual(
			{
				anchorWid: "hero",
				html,
				position: "after",
			},
		);
		expect(
			insertSectionInputSchema.safeParse({
				anchorWid: "hero",
				html,
				position: "before",
			}).success,
		).toBe(true);
	});

	it("bounds HTML and rejects invalid anchors or positions", () => {
		const input = { anchorWid: "hero", html, position: "after" };

		expect(
			insertSectionInputSchema.safeParse({ ...input, html: "x".repeat(20) })
				.success,
		).toBe(true);
		expect(
			insertSectionInputSchema.safeParse({
				...input,
				html: "x".repeat(60_000),
			}).success,
		).toBe(true);
		expect(
			insertSectionInputSchema.safeParse({ ...input, html: "x".repeat(19) })
				.success,
		).toBe(false);
		expect(
			insertSectionInputSchema.safeParse({
				...input,
				html: "x".repeat(60_001),
			}).success,
		).toBe(false);
		expect(
			insertSectionInputSchema.safeParse({
				...input,
				anchorWid: "INVALID",
			}).success,
		).toBe(false);
		expect(
			insertSectionInputSchema.safeParse({ ...input, position: "append" })
				.success,
		).toBe(false);
	});
});

describe("generate_image placement contract", () => {
	const baseInput = {
		aspect: "4:5",
		prompt: "Editorial product photo in a warm studio",
		title: "Updated hero image",
	} as const;

	it("keeps standalone generation unchanged when placement is absent", () => {
		expect(generateImageInputSchema.parse(baseInput)).toEqual({
			...baseInput,
			count: 1,
			sourceImageUrls: [],
		});
	});

	it("accepts image placement and defaults its image index to one", () => {
		expect(
			generateImageInputSchema.parse({
				...baseInput,
				placement: { kind: "image-src", wid: "hero-image" },
			}),
		).toMatchObject({
			placement: { imageIndex: 1, kind: "image-src", wid: "hero-image" },
		});

		expect(
			generateImageInputSchema.safeParse({
				...baseInput,
				placement: {
					imageIndex: 4,
					kind: "image-src",
					wid: "gallery-image",
				},
			}).success,
		).toBe(true);
	});

	it.each([
		{ kind: "section-background", wid: "hero-image" },
		{ kind: "image-src", wid: "INVALID" },
		{ imageIndex: 0, kind: "image-src", wid: "hero-image" },
		{ imageIndex: 5, kind: "image-src", wid: "hero-image" },
		{ imageIndex: 1.5, kind: "image-src", wid: "hero-image" },
	])("rejects invalid placement %#", (placement) => {
		expect(
			generateImageInputSchema.safeParse({ ...baseInput, placement }).success,
		).toBe(false);
	});

	it("exposes only the bounded placement status on attempt responses", () => {
		const attempt = {
			aspect: "4:5",
			completedAt: null,
			count: 1,
			createdAt: "2026-08-01T10:00:00.000Z",
			error: null,
			id: "11111111-1111-4111-8111-111111111111",
			images: null,
			placement: { status: "pending" },
			prompt: baseInput.prompt,
			sourceImageUrls: [],
			status: "generating",
			title: baseInput.title,
		};

		expect(imageGenerationAttemptSchema.parse(attempt).placement).toEqual({
			status: "pending",
		});
		expect(
			imageGenerationAttemptSchema.safeParse({
				...attempt,
				placement: { status: "queued" },
			}).success,
		).toBe(false);
	});
});
