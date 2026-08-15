import type { AiChatRequestMetadata } from "@wandit/contracts";
import { describe, expect, it } from "vitest";
import {
	buildChatRequestContext,
	resolveVideoRequestKeySeed,
} from "./request-context";

const VIDEO_SUBMISSION_ID = "de890510-e194-4a18-8d4a-a30f80dbe32a";

function metadata(
	mode: "page" | "video",
	videoSubmissionId: unknown,
): AiChatRequestMetadata {
	return {
		composer: {
			mode,
			options: { videoSubmissionId },
			quality: "standard",
		},
	};
}

describe("resolveVideoRequestKeySeed", () => {
	it("prefers a validated Video submission UUID over a new message id", () => {
		expect(
			resolveVideoRequestKeySeed(
				metadata("video", VIDEO_SUBMISSION_ID),
				"message_after_transport_retry",
			),
		).toBe(VIDEO_SUBMISSION_ID);
	});

	it("falls back when the Video submission token is malformed", () => {
		expect(
			resolveVideoRequestKeySeed(metadata("video", "not-a-uuid"), "message_2"),
		).toBe("message_2");
	});

	it("ignores a submission token outside Video mode", () => {
		expect(
			resolveVideoRequestKeySeed(
				metadata("page", VIDEO_SUBMISSION_ID),
				"message_3",
			),
		).toBe("message_3");
	});
});

function composerContext(
	mode: "auto" | "page" | "marketing" | "image" | "video",
	output: string | undefined,
	options: Record<string, unknown> | undefined,
): string {
	return (
		buildChatRequestContext({
			manualEdits: [],
			metadata: { composer: { mode, options, output, quality: "standard" } },
		}) ?? ""
	);
}

describe("buildChatRequestContext composer settings", () => {
	it("renders marketing output and every generation setting", () => {
		const block = composerContext("marketing", "ad-copy", {
			angle: "proof",
			length: "short",
			platform: "tiktok",
			variants: "5",
		});

		expect(block).toContain("Mode: Marketing");
		expect(block).toContain('They chose "Ad copy"');
		expect(block).toContain("Platform: tiktok.");
		expect(block).toContain("Number of variants: 5.");
		expect(block).toContain("Angle: proof.");
		expect(block).toContain("Copy length: short.");
	});

	it("renders image output, translates size tokens, and keeps unknown keys visible", () => {
		const block = composerContext("image", "product-shot", {
			froopy: "max",
			scene: "studio",
			size: "9-16",
		});

		expect(block).toContain('They chose "Product shot"');
		expect(block).toContain("Aspect ratio: 9:16.");
		expect(block).toContain("Scene: studio.");
		// A UI option the server has no label for must still reach the model.
		expect(block).toContain("froopy: max.");
	});

	it("never leaks transport-internal option keys", () => {
		const block = composerContext("image", "image-creator", {
			videoSubmissionId: VIDEO_SUBMISSION_ID,
		});

		expect(block).not.toContain("videoSubmissionId");
		expect(block).not.toContain(VIDEO_SUBMISSION_ID);
	});

	it("keeps the page goal block intact", () => {
		const block = composerContext("page", "landing-page", { goal: "cod" });

		expect(block).toContain('They chose "Landing page"');
		expect(block).toContain("Objectif: Vente COD");
	});
});

describe("buildChatRequestContext active page outline", () => {
	it("renders the start-of-request page version and compact section lines", () => {
		const block = buildChatRequestContext({
			activePageOutline: {
				sections: [
					{
						elements: 4,
						snippet: "Bienvenue chez Atlas",
						tag: "header",
						wid: "hero",
					},
					{
						elements: 7,
						snippet: "Nos services Conseil Formation",
						tag: "section",
						wid: "services",
					},
				],
				versionNumber: 12,
			},
			manualEdits: [],
		});

		expect(block).toBe(
			"## This request (set by the app, not the user's words)\n\n" +
				"The current page outline at the start of this request (version 12):\n" +
				'- data-wid="hero" | <header> | "Bienvenue chez Atlas"\n' +
				'- data-wid="services" | <section> | "Nos services Conseil Formation"\n' +
				"A page already exists — edit it with the surgical tools. Do not " +
				"call get_page_outline again; the outline is right here. Call " +
				"generate_page only when the user asks for a new page or a full " +
				"redesign.",
		);
	});

	it("omits page-state guidance when no outline was loaded", () => {
		expect(
			buildChatRequestContext({ activePageOutline: null, manualEdits: [] }),
		).toBeNull();
	});
});

describe("buildChatRequestContext preview targets", () => {
	it("routes a single selected element directly to read_section with an outline", () => {
		const block = buildChatRequestContext({
			activePageOutline: {
				sections: [
					{
						elements: 3,
						snippet: "The selected hero",
						tag: "section",
						wid: "hero",
					},
				],
				versionNumber: 4,
			},
			manualEdits: [],
			metadata: { selectedWids: ["hero-title"] },
		});

		expect(block).toContain(
			' data-wid="hero-title". When they say "this", "here", "ça", ' +
				'"هذا" they mean that element. Call read_section directly to see it ' +
				"before answering or editing.",
		);
		expect(block).not.toContain("Call get_page_outline / read_section");
	});

	it("renders a one-item selectedWids array as the single-target block", () => {
		const block = buildChatRequestContext({
			manualEdits: [],
			metadata: { selectedWids: ["hero-title"] },
		});

		expect(block).toBe(
			"## This request (set by the app, not the user's words)\n\n" +
				"The user selected an element in the page preview for THIS message: " +
				'data-wid="hero-title". When they say "this", "here", "ça", ' +
				'"هذا" they mean that element. Call get_page_outline / ' +
				"read_section to see it before answering or editing.",
		);
	});

	it("renders multiple selectedWids in their original numbered order", () => {
		const block = buildChatRequestContext({
			manualEdits: [],
			metadata: {
				selectedWids: ["hero-title", "pricing-cta", "footer-link"],
			},
		});

		expect(block).toBe(
			"## This request (set by the app, not the user's words)\n\n" +
				"The user attached 3 numbered comments to elements in the page " +
				"preview for THIS message.\nTargets in order:\n" +
				'1. data-wid="hero-title"\n' +
				'2. data-wid="pricing-cta"\n' +
				'3. data-wid="footer-link"\n' +
				"The numbered comments are in the message body. Resolve each " +
				"comment against its wid at the same numbered position, and prefer " +
				"apply_element_ops for these edits.",
		);
	});

	it("keeps the legacy selectedWid block unchanged", () => {
		const block = buildChatRequestContext({
			manualEdits: [],
			metadata: { selectedWid: "hero-title" },
		});

		expect(block).toBe(
			"## This request (set by the app, not the user's words)\n\n" +
				"The user selected an element in the page preview for THIS message: " +
				'data-wid="hero-title". When they say "this", "here", "ça", ' +
				'"هذا" they mean that element. Call get_page_outline / ' +
				"read_section to see it before answering or editing.",
		);
	});

	it("prefers selectedWids when both request fields are present", () => {
		const block = buildChatRequestContext({
			manualEdits: [],
			metadata: {
				selectedWid: "legacy-target",
				selectedWids: ["first-target", "second-target"],
			},
		});

		expect(block).toContain('1. data-wid="first-target"');
		expect(block).toContain('2. data-wid="second-target"');
		expect(block).not.toContain("legacy-target");
	});
});
