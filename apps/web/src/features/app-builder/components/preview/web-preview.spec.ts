// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { WebPreview, type WebPreviewProps } from "./web-preview";

const project: AppProject = {
	id: "nadi-fitness",
	name: "Nadi Fitness",
	kind: "web",
	languages: ["en"],
	templateVersion: "1.0.0",
	engine: "v2_app",
	versionNumber: 4,
	unpublishedChanges: 3,
	hasCodeChanges: true,
};

const PREVIEW_ORIGIN =
	"https://r-abcdef123456--p-nadi-fitness.wanditpreview.app";
const TITLE = "Preview of Nadi Fitness";

// No turn runs and the backend is unknown: the boot screen has nothing to show over the frame.
const idleBoot: BootContext = {
	isTurnRunning: false,
	turnPhase: null,
	lastTurnFailed: false,
	isFirstTurn: false,
	backend: undefined,
	hasCodeChanges: true,
	isPlanning: false,
};

// Each mint answers the next token, so no network call happens.
function depsWithTokens(...tokens: string[]): PreviewTokenDeps {
	const getPreviewToken = vi.fn<PreviewTokenDeps["getPreviewToken"]>();
	for (const token of tokens) {
		getPreviewToken.mockResolvedValueOnce({
			token,
			previewUrl: `${PREVIEW_ORIGIN}/?wt=${token}`,
			// One hour out: the scheduled re-mint never fires during a spec run.
			expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
		});
	}
	return { getPreviewToken };
}

/** The wake button of the boot screen needs a query client. No case clicks it, so one client serves every case. */
const queryClient = new QueryClient();

// The bar shows tooltips and translated labels; the page mounts these providers.
function previewElement(props: WebPreviewProps) {
	return createElement(
		QueryClientProvider,
		{ client: queryClient },
		createElement(I18nProvider, {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(
				TooltipProvider,
				null,
				createElement(WebPreview, props),
			),
		} satisfies ComponentProps<typeof I18nProvider>),
	);
}

function propsWith(
	deps: PreviewTokenDeps,
	reloadKey: number,
	liveUrl: string | null = null,
): WebPreviewProps {
	return {
		project,
		liveUrl,
		viewport: "desktop",
		onChangeViewport: () => {},
		reloadKey,
		onReload: () => {},
		bootContext: idleBoot,
		canStartTurn: true,
		isSelecting: false,
		onSelectingChange: vi.fn(),
		onPickTarget: vi.fn(),
		onTryToFix: vi.fn(),
		deps,
	};
}

// The template bridge of the app posts this message on each page change, from the window of the preview iframe.
async function postRoute(path: string) {
	const iframe = screen.getByTitle<HTMLIFrameElement>(TITLE);
	// The message listener registers in an effect; flush it before the dispatch.
	await act(async () => {});
	act(() => {
		window.dispatchEvent(
			new MessageEvent("message", {
				origin: PREVIEW_ORIGIN,
				source: iframe.contentWindow,
				data: { type: "wandit:route", path },
			}),
		);
	});
}

afterEach(cleanup);

describe("WebPreview", () => {
	// Before the first publish the bar showed ".wandit.app", a host that does not exist.
	// After it, the host is the one link to the live app.
	it.each([
		["https://nadi.wandit.app", "nadi.wandit.app", "https://nadi.wandit.app"],
		[null, "Not published yet", null],
	])("shows %s in the bar as %s with the live app link %s", async (liveUrl, text, href) => {
		render(previewElement(propsWith(depsWithTokens("t1"), 0, liveUrl)));
		await screen.findByTitle(TITLE);
		expect(screen.getByText(text)).toBeTruthy();
		expect(screen.queryByRole("link")?.getAttribute("href") ?? null).toBe(href);
	});

	it("shows a page change of the app in the capsule and keeps the iframe src", async () => {
		render(previewElement(propsWith(depsWithTokens("t1"), 0)));
		const iframe = await screen.findByTitle(TITLE);

		await postRoute("/invoices?page=2");

		expect(
			screen.getByRole("button", { name: "Page /invoices?page=2" }),
		).toBeTruthy();
		// A new src would reload the app, and the app would post its route again.
		expect(iframe.getAttribute("src")).toBe(`${PREVIEW_ORIGIN}/?wt=t1`);
	});

	it("loads the page the app shows when a reload mints a new preview URL", async () => {
		const deps = depsWithTokens("t1", "t2");
		const { rerender } = render(previewElement(propsWith(deps, 0)));
		await screen.findByTitle(TITLE);
		await postRoute("/invoices");

		// The page bumps reloadKey when the reload button calls onReload.
		rerender(previewElement(propsWith(deps, 1)));

		await waitFor(() =>
			expect(screen.getByTitle(TITLE).getAttribute("src")).toBe(
				`${PREVIEW_ORIGIN}/invoices?wt=t2`,
			),
		);
	});
});
