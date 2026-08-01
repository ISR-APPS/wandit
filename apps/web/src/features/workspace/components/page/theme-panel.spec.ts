import { PAGE_TOKEN_NAMES, PRESET_PALETTES } from "@wandit/contracts";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	applyTokens: vi.fn(),
	resetTokens: vi.fn(),
	pendingTokens: {} as Record<string, string>,
	pendingTokensReset: false,
	versions: [] as Array<{
		id: string;
		isBuilderOrigin: boolean;
		source: string | null;
	}>,
	versionsPending: false,
	html: undefined as { html: string } | undefined,
	htmlPending: false,
	requestedVersionId: undefined as string | undefined,
}));

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			const messages: Record<string, string> = {
				"workspace.page.editor.themeLegacyNotice":
					"Regenerate to enable themes",
				"workspace.page.editor.themeReset": "Reset to original theme",
				"workspace.page.editor.themeResetUnavailable":
					"Original theme unavailable for this page",
				"workspace.page.editor.presetModeMismatchLight":
					"Designed for light pages",
				"workspace.page.editor.presetModeMismatchDark":
					"Designed for dark pages",
				"workspace.page.editor.presetDark": "Dark",
				"workspace.page.editor.presetLight": "Light",
				"workspace.page.editor.radiusFull": "Full",
			};
			return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			);
		},
	}),
}));

vi.mock("../../api/pages.queries", () => ({
	usePageVersionsQuery: () => ({
		data: mocks.versions,
		isPending: mocks.versionsPending,
	}),
	useVersionHtmlQuery: (versionId: string | undefined) => {
		mocks.requestedVersionId = versionId;
		return { data: mocks.html, isPending: mocks.htmlPending };
	},
}));

vi.mock("../../lib/store", () => ({
	useWorkspace: () => ({ projectId: "project-1" }),
}));

vi.mock("../../lib/use-page-editor", () => ({
	usePageEditor: () => ({
		pendingTokens: mocks.pendingTokens,
		pendingTokensReset: mocks.pendingTokensReset,
		applyTokens: mocks.applyTokens,
		resetTokens: mocks.resetTokens,
	}),
}));

import { PresetGrid } from "./preset-grid";
import { ThemePanel } from "./theme-panel";

const COMPLETE_THEME = PRESET_PALETTES[0]?.values;
if (!COMPLETE_THEME) throw new Error("Expected at least one preset fixture");
const OTHER_THEME = PRESET_PALETTES[1]?.values;
if (!OTHER_THEME) throw new Error("Expected at least two preset fixtures");

function themeHtml(tokens = COMPLETE_THEME) {
	return `<style>:root { ${PAGE_TOKEN_NAMES.map(
		(name) => `--${name}: ${tokens[name]};`,
	).join(" ")} }</style>`;
}

function renderPanel(element: ReactNode) {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

function resetButtonTag(html: string): string {
	const tag = html.match(
		/<button[^>]*aria-label="Reset to original theme"[^>]*>/,
	)?.[0];
	expect(tag).toBeDefined();
	return tag ?? "";
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.pendingTokens = {};
	mocks.pendingTokensReset = false;
	mocks.versions = [
		{ id: "builder-v1", isBuilderOrigin: true, source: "builder" },
	];
	mocks.versionsPending = false;
	mocks.html = { html: themeHtml() };
	mocks.htmlPending = false;
	mocks.requestedVersionId = undefined;
});

describe("ThemePanel", () => {
	it("disables every theme control and explains legacy pages", () => {
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: { background: "#ffffff", foreground: "#111111" },
				colorScheme: "light",
			}),
		);

		expect(html).toContain("Regenerate to enable themes");
		expect(html).toMatch(/<fieldset[^>]*disabled=""/);
		expect(html).toMatch(/<button[^>]*disabled=""/);
	});

	it("converts functional token colors before rendering color inputs", () => {
		const tokens = {
			...COMPLETE_THEME,
			background: "rgb(255 128 0)",
		};
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: tokens,
				colorScheme: "light",
			}),
		);

		expect(PAGE_TOKEN_NAMES.every((name) => Boolean(tokens[name]))).toBe(true);
		expect(html).toContain('type="color"');
		expect(html).toContain('value="#ff8000"');
		expect(html).not.toMatch(/<fieldset[^>]*disabled=""/);
	});

	it("keeps reset disabled when the effective theme is already original", () => {
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: COMPLETE_THEME,
				colorScheme: "light",
			}),
		);

		expect(resetButtonTag(html)).toContain('disabled=""');
	});

	it("enables reset after an unsaved preset overlays the original", () => {
		mocks.pendingTokens = { ...OTHER_THEME };
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: COMPLETE_THEME,
				colorScheme: "light",
			}),
		);

		expect(resetButtonTag(html)).not.toContain('disabled=""');
	});

	it("disables reset with an honest notice when the original is unavailable", () => {
		mocks.versions = [];
		mocks.html = undefined;
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: COMPLETE_THEME,
				colorScheme: "light",
			}),
		);

		const button = resetButtonTag(html);
		expect(button).toContain('disabled=""');
		expect(button).toContain('aria-describedby="theme-reset-unavailable"');
		expect(button).toContain(
			'title="Original theme unavailable for this page"',
		);
		expect(html).toContain("Original theme unavailable for this page");
	});

	it("resolves the newest builder or legacy-origin version", () => {
		mocks.versions = [
			{ id: "future-v5", isBuilderOrigin: false, source: null },
			{ id: "theme-v4", isBuilderOrigin: false, source: "theme" },
			{ id: "legacy-v3", isBuilderOrigin: true, source: null },
			{ id: "builder-v2", isBuilderOrigin: true, source: "builder" },
		];
		renderPanel(
			createElement(ThemePanel, {
				baseTokens: COMPLETE_THEME,
				colorScheme: "light",
			}),
		);

		expect(mocks.requestedVersionId).toBe("legacy-v3");
	});

	it("rebases effective tokens onto the original while reset is pending", () => {
		mocks.pendingTokensReset = true;
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: OTHER_THEME,
				colorScheme: "light",
			}),
		);

		expect(html).toMatch(/aria-pressed="true"[^>]*>.*Dune chaude/s);
		expect(resetButtonTag(html)).toContain('disabled=""');
	});

	it("labels radii beyond the slider range as fully rounded", () => {
		const html = renderPanel(
			createElement(ThemePanel, {
				baseTokens: { ...COMPLETE_THEME, radius: "999px" },
				colorScheme: "light",
			}),
		);

		expect(html).toContain(">Full</span>");
		expect(html).not.toContain("62.438rem");
	});
});

describe("PresetGrid", () => {
	it("recognizes equivalent functional colors as the active preset", () => {
		const html = renderPanel(
			createElement(PresetGrid, {
				effective: {
					...COMPLETE_THEME,
					background: "rgb(251 246 237)",
				},
				colorScheme: "light",
			}),
		);

		expect(html).toMatch(/aria-pressed="true"[^>]*>.*Dune chaude/s);
	});

	it("de-emphasizes but keeps opposite-scheme presets enabled", () => {
		const html = renderPanel(
			createElement(PresetGrid, {
				effective: COMPLETE_THEME,
				colorScheme: "light",
			}),
		);

		expect(html).toContain("Nuit saharienne");
		expect(html).toContain("Designed for dark pages");
		expect(html).toContain("opacity-45 saturate-50");
		expect(html).not.toMatch(/aria-label="Nuit saharienne[^>]*disabled=""/);
	});

	it("uses a complete light-mode sentence for the inverse mismatch", () => {
		const html = renderPanel(
			createElement(PresetGrid, {
				effective: COMPLETE_THEME,
				colorScheme: "dark",
			}),
		);

		expect(html).toContain("Designed for light pages");
	});
});
