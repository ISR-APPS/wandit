// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { PreviewBridgeMessage } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import type { MobilePreviewTarget } from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PhonePreview, type PhonePreviewProps } from "./phone-preview";

const project: AppProject = {
	id: "nadi-fitness-mobile",
	name: "Nadi Fitness",
	kind: "mobile",
	languages: ["en"],
	templateVersion: "1.0.0",
	engine: "v2_app",
	versionNumber: 4,
	unpublishedChanges: 3,
	hasCodeChanges: true,
};

const PREVIEW_ORIGIN =
	"https://r-abcdef123456--p-nadi-fitness-mobile.wanditpreview.app";
const TITLE = "Preview of Nadi Fitness";

// The fake answers one minted URL, so no network call happens.
const readyDeps: PreviewTokenDeps = {
	getPreviewToken: async () => ({
		token: "t1",
		previewUrl: `${PREVIEW_ORIGIN}/?wt=t1`,
		tabUrl: `${PREVIEW_ORIGIN}/?wt=t1`,
		// One hour out: the scheduled re-mint never fires during a spec run.
		expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
	}),
};

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
			tabUrl: `${PREVIEW_ORIGIN}/?wt=${token}`,
			// One hour out: the scheduled re-mint never fires during a spec run.
			expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
		});
	}
	return { getPreviewToken };
}

// jsdom has no ResizeObserver; the stage measures itself with one.
class ResizeObserverStub implements ResizeObserver {
	disconnect() {}
	observe() {}
	takeRecords(): ResizeObserverEntry[] {
		return [];
	}
	unobserve() {}
}

function propsWith(overrides: Partial<PhonePreviewProps>): PhonePreviewProps {
	return {
		project,
		target: "web",
		onChangeTarget: () => {},
		reloadKey: 0,
		onReload: () => {},
		bootContext: idleBoot,
		canRunOnDevice: false,
		canStartTurn: true,
		onTryToFix: () => {},
		deps: readyDeps,
		...overrides,
	};
}

// One client per case: a rerender with a new client would drop the queries of the stage.
function previewElement(props: PhonePreviewProps, queryClient: QueryClient) {
	// The page mounts one TooltipProvider; the bar buttons need it too.
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			TooltipProvider,
			null,
			createElement(PhonePreview, props),
		),
	};
	// The wake button of the boot screen needs a query client.
	return createElement(
		QueryClientProvider,
		{ client: queryClient },
		createElement(I18nProvider, providerProps),
	);
}

async function renderPreview(
	target: MobilePreviewTarget,
	canRunOnDevice = false,
) {
	render(
		previewElement(propsWith({ target, canRunOnDevice }), new QueryClient()),
	);
	return screen.findByTitle(TITLE);
}

// The dev bridge of the app posts from the window of the preview iframe, on the preview origin.
async function postFromFrame(message: PreviewBridgeMessage) {
	const iframe = screen.getByTitle<HTMLIFrameElement>(TITLE);
	// The message listener registers in an effect; flush it before the dispatch.
	await act(async () => {});
	act(() => {
		window.dispatchEvent(
			new MessageEvent("message", {
				origin: PREVIEW_ORIGIN,
				source: iframe.contentWindow,
				data: message,
			}),
		);
	});
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("PhonePreview", () => {
	it("gives a mobile app reload and Expo Go but no live app link, shows the target switch only behind its flag, and a device waits for its turn-on button", async () => {
		// Without the flag, a `?device=ios` URL falls back to the web build.
		await renderPreview("ios");
		expect(screen.queryByRole("button", { name: "Android" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Reload the preview" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Test on your phone" }),
		).toBeTruthy();
		// A mobile app has no site, so the bar has no live app link.
		expect(
			screen.queryByRole("link", { name: "Open the live app" }),
		).toBeNull();
		cleanup();

		// Each device minute costs money: no stream mounts before the click.
		await renderPreview("ios", true);
		expect(screen.getByRole("button", { name: "Android" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Turn on" })).toBeTruthy();
		expect(screen.queryByTitle("iOS device with Nadi Fitness")).toBeNull();
	});

	// An error during a turn can come from a half-written file. A page that cannot start
	// after the turn posts no ready. So the kept error must show on the frame load.
	it("hides a turn error, reloads the frame at the turn end, shows the kept error on load, and clears it on ready", async () => {
		const onTryToFix = vi.fn<(message: string) => void>();
		const deps = depsWithTokens("t1", "t2");
		const queryClient = new QueryClient();
		const runningBoot: BootContext = { ...idleBoot, isTurnRunning: true };
		const compileError = "Unable to resolve module ../../assets/hero.png";
		const { rerender } = render(
			previewElement(
				propsWith({ bootContext: runningBoot, onTryToFix, deps }),
				queryClient,
			),
		);
		await screen.findByTitle(TITLE);

		await postFromFrame({
			type: "wandit:runtime-error",
			message: compileError,
		});
		expect(screen.queryByRole("alert")).toBeNull();

		rerender(
			previewElement(
				propsWith({ bootContext: idleBoot, onTryToFix, deps }),
				queryClient,
			),
		);
		await waitFor(() =>
			expect(screen.getByTitle(TITLE).getAttribute("src")).toBe(
				`${PREVIEW_ORIGIN}/?wt=t2`,
			),
		);
		// The new page has not loaded yet, so the old error may not apply.
		expect(screen.queryByRole("alert")).toBeNull();

		fireEvent.load(screen.getByTitle(TITLE));
		const banner = await screen.findByRole("alert");
		expect(within(banner).getByText(compileError)).toBeTruthy();
		fireEvent.click(within(banner).getByRole("button", { name: "Try to fix" }));
		expect(onTryToFix).toHaveBeenCalledWith(
			expect.stringContaining(`1. ${compileError}`),
		);

		await postFromFrame({ type: "wandit:bridge-ready" });
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
