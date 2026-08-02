import { describe, expect, it } from "vitest";

import {
	applyStyleMessage,
	PREVIEW_MESSAGE_SOURCE,
	PREVIEW_PROTOCOL_VERSION,
	parsePreviewMessage,
	parsePreviewParentMessage,
	placeholderImageMessage,
	selectionRectMessage,
	selectTargetMessage,
	setAiTargetsMessage,
	setBrandLogoMessage,
	setCommentPinsMessage,
	setPlaceholderMessage,
	setSuspendedMessage,
	setTokensMessage,
} from "./messages";

const ENVELOPE = {
	source: PREVIEW_MESSAGE_SOURCE,
	v: PREVIEW_PROTOCOL_VERSION,
} as const;

const COMPUTED_STYLES = {
	backgroundColor: "rgb(255, 255, 255)",
	borderRadius: "12px",
	color: "rgb(17, 24, 39)",
	direction: "rtl",
	fontFamily: "Cairo, sans-serif",
	fontSize: "32px",
	fontStyle: "italic",
	fontWeight: "600",
	letterSpacing: "0.02em",
	lineHeight: "1.4",
	objectFit: "contain",
	textAlign: "start",
	width: "50%",
} as const;

describe("preview child-message protocol", () => {
	it("accepts the dedicated Escape message", () => {
		expect(
			parsePreviewMessage({ ...ENVELOPE, type: "escape", payload: {} }),
		).toEqual({ ...ENVELOPE, type: "escape", payload: {} });
	});

	it("defaults flattened descendant wids for older text-edited payloads", () => {
		expect(
			parsePreviewMessage({
				...ENVELOPE,
				type: "text-edited",
				payload: { wid: "e-1", value: "Flattened" },
			}),
		).toEqual({
			...ENVELOPE,
			type: "text-edited",
			payload: { wid: "e-1", value: "Flattened", flattenedWids: [] },
		});
	});

	it("parses the expanded selection payload and defaults optional legacy fields", () => {
		const parsed = parsePreviewMessage({
			...ENVELOPE,
			type: "select",
			payload: {
				wid: "e-12",
				sectionWid: "hero",
				tag: "input",
				kind: "element",
				text: null,
				src: null,
				styles: COMPUTED_STYLES,
			},
		});

		expect(parsed?.type).toBe("select");
		if (parsed?.type !== "select") throw new Error("selection did not parse");
		expect(parsed.payload).toMatchObject({
			excerpt: null,
			ladder: [],
			ladderIndex: 0,
			inlineWidth: null,
			isPlaceholderImage: false,
			removable: true,
			textEditable: true,
			placeholder: null,
			href: null,
			sectionStyles: null,
			bgImage: null,
			styles: { ...COMPUTED_STYLES, height: "" },
		});
	});

	it("parses surface selections and their full ladder", () => {
		const parsed = parsePreviewMessage({
			...ENVELOPE,
			type: "select",
			payload: {
				wid: "price-card",
				sectionWid: "pricing",
				tag: "article",
				kind: "surface",
				excerpt: "Professional plan",
				ladderIndex: 1,
				ladder: [
					{ wid: "e-12", kind: "element", tag: "p", label: "Price" },
					{
						wid: "price-card",
						kind: "surface",
						tag: "article",
						label: "Professional plan",
					},
					{
						wid: "pricing",
						kind: "section",
						tag: "section",
						label: "Pricing",
					},
				],
				text: null,
				src: null,
				styles: COMPUTED_STYLES,
			},
		});

		expect(parsed?.type).toBe("select");
		if (parsed?.type !== "select") throw new Error("selection did not parse");
		expect(parsed.payload.kind).toBe("surface");
		expect(parsed.payload.ladder).toHaveLength(3);
		expect(parsed.payload.ladderIndex).toBe(1);
	});

	it("defaults a newly added section background color for old scripts", () => {
		const parsed = parsePreviewMessage({
			...ENVELOPE,
			type: "select",
			payload: {
				wid: "hero",
				sectionWid: "hero",
				tag: "section",
				kind: "section",
				text: null,
				src: null,
				sectionStyles: {
					paddingTop: "64px",
					paddingBottom: "64px",
					backgroundImage: "none",
				},
				styles: COMPUTED_STYLES,
			},
		});

		expect(parsed?.type).toBe("select");
		if (parsed?.type !== "select") throw new Error("selection did not parse");
		expect(parsed.payload.sectionStyles?.backgroundColor).toBe("transparent");
	});

	it("accepts the iframe Ask-AI shortcut discriminator", () => {
		expect(
			parsePreviewMessage({
				...ENVELOPE,
				type: "ask-ai-shortcut",
				payload: {},
			}),
		).toEqual({ ...ENVELOPE, type: "ask-ai-shortcut", payload: {} });
	});

	it("builds and parses selection rect updates and their null clear", () => {
		const rect = {
			wid: "price-card",
			left: -12.5,
			top: 48,
			width: 320.25,
			height: 180,
		};

		expect(parsePreviewMessage(selectionRectMessage(rect))).toEqual({
			...ENVELOPE,
			type: "selection-rect",
			payload: rect,
		});
		expect(parsePreviewMessage(selectionRectMessage(null))).toEqual({
			...ENVELOPE,
			type: "selection-rect",
			payload: null,
		});
	});

	it("rejects malformed selection rect payloads", () => {
		const rect = {
			wid: "price-card",
			left: 12,
			top: 48,
			width: 320,
			height: 180,
		};

		expect(
			parsePreviewMessage({
				...ENVELOPE,
				type: "selection-rect",
				payload: { ...rect, width: -1 },
			}),
		).toBeNull();
		expect(
			parsePreviewMessage({
				...ENVELOPE,
				type: "selection-rect",
				payload: { ...rect, left: "12" },
			}),
		).toBeNull();
	});

	it("rejects forged envelopes and incomplete computed-style snapshots", () => {
		const selection = {
			...ENVELOPE,
			type: "select",
			payload: {
				wid: "e-12",
				sectionWid: null,
				tag: "span",
				kind: "element",
				text: "Hello",
				src: null,
				styles: { ...COMPUTED_STYLES, width: undefined },
			},
		};

		expect(
			parsePreviewMessage({ ...selection, source: "page-script" }),
		).toBeNull();
		expect(parsePreviewMessage({ ...selection, v: 999 })).toBeNull();
		expect(parsePreviewMessage(selection)).toBeNull();
	});

	it("rejects overlong untrusted selection tags and excerpts", () => {
		const selection = {
			...ENVELOPE,
			type: "select",
			payload: {
				wid: "e-12",
				sectionWid: "hero",
				tag: "p",
				kind: "element",
				excerpt: "Visible copy",
				ladder: [{ wid: "e-12", kind: "element", tag: "p", label: "Copy" }],
				text: "Visible copy",
				src: null,
				styles: COMPUTED_STYLES,
			},
		};

		expect(
			parsePreviewMessage({
				...selection,
				payload: { ...selection.payload, tag: "x".repeat(33) },
			}),
		).toBeNull();
		expect(
			parsePreviewMessage({
				...selection,
				payload: { ...selection.payload, excerpt: "x".repeat(161) },
			}),
		).toBeNull();
		expect(
			parsePreviewMessage({
				...selection,
				payload: {
					...selection.payload,
					ladder: [
						{
							...selection.payload.ladder[0],
							tag: "x".repeat(33),
						},
					],
				},
			}),
		).toBeNull();
	});

	it("accepts selection tags and excerpts at their exact boundaries", () => {
		const tag = "t".repeat(32);
		const excerpt = "e".repeat(160);
		const parsed = parsePreviewMessage({
			...ENVELOPE,
			type: "select",
			payload: {
				wid: "e-12",
				sectionWid: "hero",
				tag,
				kind: "element",
				excerpt,
				ladder: [{ wid: "e-12", kind: "element", tag, label: "Visible copy" }],
				text: "Visible copy",
				src: null,
				styles: COMPUTED_STYLES,
			},
		});

		expect(parsed?.type).toBe("select");
		if (parsed?.type !== "select") throw new Error("selection did not parse");
		expect(parsed.payload.tag).toHaveLength(32);
		expect(parsed.payload.excerpt).toHaveLength(160);
		expect(parsed.payload.ladder[0]?.tag).toHaveLength(32);
	});
});

describe("preview parent-message constructors", () => {
	it("carries every extended live style property", () => {
		expect(applyStyleMessage("e-7", COMPUTED_STYLES)).toEqual({
			...ENVELOPE,
			type: "apply-style",
			payload: { wid: "e-7", style: COMPUTED_STYLES },
		});
	});

	it("builds the set-placeholder message", () => {
		expect(setPlaceholderMessage("e-9", "Your phone number")).toEqual({
			...ENVELOPE,
			type: "set-placeholder",
			payload: { wid: "e-9", value: "Your phone number" },
		});
	});

	it("builds and validates the suspended-state message", () => {
		expect(setSuspendedMessage(true)).toEqual({
			...ENVELOPE,
			type: "set-suspended",
			payload: { suspended: true },
		});
		expect(parsePreviewParentMessage(setSuspendedMessage(false))).toEqual({
			...ENVELOPE,
			type: "set-suspended",
			payload: { suspended: false },
		});
		expect(
			parsePreviewParentMessage({
				...ENVELOPE,
				type: "set-suspended",
				payload: { suspended: "yes" },
			}),
		).toBeNull();
	});

	it("builds and validates selection and brand messages", () => {
		expect(selectTargetMessage("price-card")).toEqual({
			...ENVELOPE,
			type: "select-target",
			payload: { wid: "price-card" },
		});
		expect(
			setBrandLogoMessage(
				"brand-nav",
				"https://cdn.wandit.example/uploads/u/logo.png",
			),
		).toEqual({
			...ENVELOPE,
			type: "set-brand-logo",
			payload: {
				wid: "brand-nav",
				value: "https://cdn.wandit.example/uploads/u/logo.png",
			},
		});
		expect(setBrandLogoMessage("brand-nav", null)).toMatchObject({
			type: "set-brand-logo",
			payload: { value: null },
		});
		expect(
			parsePreviewParentMessage({
				...ENVELOPE,
				type: "set-brand-logo",
				payload: { wid: "brand-nav", value: "not a url" },
			}),
		).toBeNull();
	});

	it("builds bounded comment pins and rejects malformed entries", () => {
		const pins = Array.from({ length: 10 }, (_, index) => ({
			wid: `target-${index + 1}`,
			number: index + 1,
		}));
		const message = setCommentPinsMessage(pins);

		expect(message).toEqual({
			...ENVELOPE,
			type: "set-comment-pins",
			payload: { pins },
		});
		expect(parsePreviewParentMessage(message)).toEqual(message);
		expect(() =>
			setCommentPinsMessage([...pins, { wid: "target-11", number: 1 }]),
		).toThrow();
		for (const number of [0, 1.5, 11]) {
			expect(
				parsePreviewParentMessage({
					...ENVELOPE,
					type: "set-comment-pins",
					payload: { pins: [{ wid: "price-card", number }] },
				}),
			).toBeNull();
		}
	});

	it("builds bounded multi-target pulses with an empty clear", () => {
		const wids = Array.from(
			{ length: 10 },
			(_, index) => `target-${index + 1}`,
		);

		expect(setAiTargetsMessage(wids)).toEqual({
			...ENVELOPE,
			type: "set-ai-targets",
			payload: { wids },
		});
		expect(parsePreviewParentMessage(setAiTargetsMessage([]))).toEqual({
			...ENVELOPE,
			type: "set-ai-targets",
			payload: { wids: [] },
		});
		expect(() => setAiTargetsMessage([...wids, "target-11"])).toThrow();
		expect(
			parsePreviewParentMessage({
				...ENVELOPE,
				type: "set-ai-targets",
				payload: { wids: ["price-card", 2] },
			}),
		).toBeNull();
		expect(
			parsePreviewParentMessage({
				...ENVELOPE,
				type: "set-ai-target",
				payload: { wid: "price-card" },
			}),
		).toBeNull();
	});

	it("builds marker-safe placeholder image messages with optional dimensions", () => {
		expect(
			placeholderImageMessage("e-10", { width: 800, height: 600 }),
		).toMatchObject({
			...ENVELOPE,
			type: "placeholder-image",
			payload: {
				wid: "e-10",
				width: 800,
				height: 600,
				src: expect.stringMatching(/^data:image\/svg\+xml,/),
			},
		});
	});

	it("carries only allowlisted Google Font stylesheet hrefs", () => {
		const href =
			"https://fonts.googleapis.com/css2?family=Fraunces&display=swap";

		expect(
			setTokensMessage({ "font-heading": "Fraunces" }, undefined, [href]),
		).toEqual({
			...ENVELOPE,
			type: "set-tokens",
			payload: {
				values: { "font-heading": "Fraunces" },
				fontStylesheetHrefs: [href],
			},
		});
		expect(() =>
			setTokensMessage({}, undefined, ["https://evil.example/font.css"]),
		).toThrow();
		expect(() =>
			setTokensMessage({}, undefined, [
				"https://fonts.googleapis.com/\ncss2?family=Unsafe",
			]),
		).toThrow();
	});

	it("defaults old set-tokens payloads and rejects non-Google font hrefs", () => {
		expect(
			parsePreviewParentMessage({
				...ENVELOPE,
				type: "set-tokens",
				payload: { values: { radius: "1rem" } },
			}),
		).toEqual({
			...ENVELOPE,
			type: "set-tokens",
			payload: { values: { radius: "1rem" }, fontStylesheetHrefs: [] },
		});
		expect(
			parsePreviewParentMessage({
				...ENVELOPE,
				type: "set-tokens",
				payload: {
					values: {},
					fontStylesheetHrefs: ["https://fonts.googleapis.com.evil/font.css"],
				},
			}),
		).toBeNull();
	});
});
