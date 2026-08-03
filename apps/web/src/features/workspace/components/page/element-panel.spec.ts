import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	editor: {} as Record<string, unknown>,
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) => key.split(".").at(-1) ?? key,
	}),
}));

vi.mock("../../lib/use-page-editor", () => ({
	usePageEditor: () => mocks.editor,
}));

import { ElementPanel, postLadderSelection } from "./element-panel";

const BASE_STYLES = {
	backgroundColor: "rgb(255, 255, 255)",
	borderRadius: "12px",
	color: "rgb(17, 17, 17)",
	direction: "ltr",
	fontFamily: "Inter, sans-serif",
	fontSize: "16px",
	fontStyle: "normal",
	fontWeight: "400",
	height: "320px",
	letterSpacing: "normal",
	lineHeight: "24px",
	objectFit: "cover",
	textAlign: "left",
	width: "100%",
};

function selection(tag: string, overrides: Record<string, unknown> = {}) {
	return {
		wid: "e-7",
		sectionWid: "hero",
		tag,
		kind: "element" as const,
		excerpt: "Copy",
		ladder: [{ wid: "e-7", kind: "element", tag, label: "Copy" }],
		ladderIndex: 0,
		text:
			tag === "input" || tag === "textarea" || tag === "img" ? null : "Copy",
		src: tag === "img" ? "https://example.com/image.jpg" : null,
		inlineWidth: tag === "img" ? "50%" : null,
		removable: true,
		textEditable: true,
		isPlaceholderImage: false,
		placeholder: tag === "input" || tag === "textarea" ? "Your name" : null,
		href: tag === "a" ? "https://example.com" : null,
		sectionStyles: null,
		bgImage: null,
		styles: BASE_STYLES,
		...overrides,
	};
}

function renderTag(
	tag: string,
	overrides: Record<string, unknown> = {},
): string {
	mocks.editor.selection = selection(tag, overrides);
	return renderToStaticMarkup(createElement(ElementPanel));
}

describe("ElementPanel", () => {
	beforeEach(() => {
		mocks.editor = {
			mode: "select",
			selection: selection("p"),
			pendingStyles: {},
			pendingImages: {},
			pendingPlaceholderImages: {},
			pendingLinks: {},
			pendingPlaceholders: {},
			pendingSectionStyles: {},
			pendingRemovals: [],
			isAskAiDispatching: false,
			applyStyle: vi.fn(),
			applyImage: vi.fn(),
			applyImagePlaceholder: vi.fn(),
			applyLinkHref: vi.fn(),
			applyPlaceholder: vi.fn(),
			applySectionStyle: vi.fn(),
			removeElement: vi.fn(),
			clearSelection: vi.fn(),
			postToPreview: vi.fn(),
		};
	});

	it("renders the complete typography surface for every text-leaf family", () => {
		for (const tag of [
			"h1",
			"p",
			"li",
			"blockquote",
			"figcaption",
			"label",
			"legend",
			"span",
		]) {
			const html = renderTag(tag);
			expect(html).toContain("fontWeight");
			expect(html).toContain("italic");
			expect(html).toContain("textAlign");
			expect(html).toContain("lineHeight");
			expect(html).toContain("letterSpacing");
			expect(html).toContain("removeElement");
		}
	});

	it("renders image controls and the placeholder-swap action", () => {
		const html = renderTag("img");

		expect(html).toContain("25%");
		expect(html).toContain("100%");
		expect(html).toContain("radius");
		expect(html).toContain("fitCover");
		expect(html).toContain("fitContain");
		expect(html).toContain("placeholderImage");
		expect(html).not.toContain("removeElement");
		expect(html).not.toContain("removeImage");
		expect(html).toMatch(
			/aria-pressed="true"[^>]*><span dir="ltr">50%<\/span>/,
		);
	});

	it("uses true removal after an image has become a placeholder", () => {
		const html = renderTag("img", { isPlaceholderImage: true });

		expect(html).toContain("removeElement");
		expect(html).not.toContain("placeholderImage");
	});

	it("only shows the edit hint when inline text editing can engage", () => {
		mocks.editor.mode = "edit";
		expect(renderTag("p")).toContain("textHint");
		expect(renderTag("p", { textEditable: false })).not.toContain("textHint");
	});

	it("renders surface colors for links and buttons and href only for links", () => {
		const linkHtml = renderTag("a");
		const buttonHtml = renderTag("button");

		for (const html of [linkHtml, buttonHtml]) {
			expect(html).toContain("backgroundColor");
			expect(html).toContain("color");
			expect(html).toContain("radius");
			expect(html).toContain("removeElement");
		}
		expect(linkHtml).toContain("linkUrl");
		expect(buttonHtml).not.toContain("linkUrl");
	});

	it("renders placeholder editing and removal for both form fields", () => {
		for (const tag of ["input", "textarea"]) {
			const html = renderTag(tag);
			expect(html).toContain('value="Your name"');
			expect(html).toContain("placeholder");
			expect(html).toContain("removeElement");
		}
	});

	it("hides removal for protected form controls", () => {
		for (const tag of ["input", "textarea", "button"]) {
			mocks.editor.selection = selection(tag, { removable: false });
			const html = renderToStaticMarkup(createElement(ElementPanel));
			expect(html).not.toContain("removeElement");
		}
	});

	it("shows a transparent background as an empty neutral color field", () => {
		mocks.editor.selection = selection("button", {
			styles: {
				...BASE_STYLES,
				backgroundColor: "rgba(0, 0, 0, 0)",
			},
		});
		const html = renderToStaticMarkup(createElement(ElementPanel));

		expect(html).toContain("opacity-0");
		expect(html).toContain('value=""');
	});

	it("uses the localized full-radius label as visible chip text", () => {
		const html = renderTag("button");

		expect(html).toContain(">radiusFull</button>");
		expect(html).not.toContain(">FULL</button>");
	});

	it("renders a clickable active breadcrumb", () => {
		const html = renderTag("p", {
			ladder: [
				{ wid: "e-7", kind: "element", tag: "p", label: "Copy" },
				{
					wid: "card",
					kind: "surface",
					tag: "article",
					label: "Card",
				},
				{ wid: "hero", kind: "section", tag: "section", label: "Hero" },
			],
		});

		expect(html).toContain("selectionPath");
		expect(html).toContain('aria-current="true"');
		expect(html).toContain(">p</bdi>");
		expect(html).toContain(">article</bdi>");
		expect(html).toContain(">section</bdi>");
		const post = vi.fn();
		postLadderSelection(post, "card");
		expect(post).toHaveBeenCalledWith({
			source: "wandit-preview",
			v: 1,
			type: "select-target",
			payload: { wid: "card" },
		});
	});

	it("routes a surface to only background color and corner controls", () => {
		const html = renderTag("article", {
			kind: "surface",
			wid: "price-card",
			ladder: [
				{
					wid: "price-card",
					kind: "surface",
					tag: "article",
					label: "Plan",
				},
			],
		});

		expect(html).toContain("surface");
		expect(html).toContain("backgroundColor");
		expect(html).toContain("radius");
		expect(html).not.toContain("fontWeight");
		expect(html).not.toContain("removeElement");
		expect(html).not.toContain("replaceImage");
	});

	it("keeps section color visible alongside a full-bleed image", () => {
		const html = renderTag("section", {
			kind: "section",
			wid: "hero",
			sectionWid: "hero",
			sectionStyles: {
				paddingTop: "64px",
				paddingBottom: "64px",
				backgroundImage: "none",
				backgroundColor: "rgb(255, 255, 255)",
			},
			bgImage: {
				wid: "e-bg",
				src: "https://example.com/hero.jpg",
			},
			ladder: [{ wid: "hero", kind: "section", tag: "section", label: "Hero" }],
		});

		expect(html).toContain("backgroundColor");
		expect(html).toContain("https://example.com/hero.jpg");
	});

	it("keeps manual controls inert without owning the shared working visuals", () => {
		mocks.editor.isAskAiDispatching = true;
		const html = renderTag("p");
		const fieldset = html.match(/<fieldset[^>]*>[\s\S]*<\/fieldset>/)?.[0];

		expect(fieldset).toBeDefined();
		expect(fieldset).toContain('disabled=""');
		expect(fieldset).toContain('inert=""');
		expect(fieldset).toContain('aria-disabled="true"');
		expect(fieldset).toContain("pointer-events-none");
		expect(fieldset).toContain('data-slot="element-panel-controls"');
		expect(fieldset).not.toContain('data-slot="editor-panel-skeleton"');
		expect(fieldset).not.toContain("animate-shimmer");
		expect(fieldset).toContain("fontWeight");
		expect(html).not.toContain('role="status"');
		expect(html).not.toContain("aiApplying");
		// The selection path stays outside the defensively frozen manual controls.
		expect(html.indexOf("selectionPath")).toBeLessThan(
			html.indexOf("<fieldset"),
		);
	});

	it("restores direct control interactivity after scoped AI finishes", () => {
		mocks.editor.isAskAiDispatching = false;
		const html = renderTag("p");

		expect(html).not.toContain("aiApplying");
		expect(html).not.toContain('data-slot="editor-panel-skeleton"');
		expect(html).not.toContain("animate-shimmer");
		expect(html).not.toContain('disabled=""');
		expect(html).not.toContain('inert=""');
		expect(html).toContain('data-slot="element-panel-controls"');
		expect(html).toContain("fontWeight");
	});
});
