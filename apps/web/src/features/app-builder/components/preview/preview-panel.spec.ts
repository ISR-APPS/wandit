// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import type { BootContext } from "../../lib/boot-state";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PreviewPanel, type PreviewPanelProps } from "./preview-panel";

const PROJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const PREVIEW_URL = `https://r-abcdef123456--p-${PROJECT_ID}.wanditpreview.app/?wt=t1`;
const PREVIEW_URL_2 = `https://r-abcdef123456--p-${PROJECT_ID}.wanditpreview.app/?wt=t2`;
const PREVIEW_ORIGIN = new URL(PREVIEW_URL).origin;
const TITLE = "Preview of Nadi Fitness";

// No turn runs and the backend is unknown.
const IDLE_BOOT: BootContext = {
	isTurnRunning: false,
	turnPhase: null,
	lastTurnFailed: false,
	isFirstTurn: false,
	backend: undefined,
};

/** A mint that answers `SANDBOX_NOT_RUNNING`, like the API while no sandbox runs. */
const wakingDeps: PreviewTokenDeps = {
	getPreviewToken: async () => {
		throw new ApiClientError({
			code: "SANDBOX_NOT_RUNNING",
			message: "No sandbox runs for this project.",
			path: `/api/v2/projects/${PROJECT_ID}/preview-token`,
			requestId: "req-1",
			statusCode: 409,
			timestamp: "2026-01-01T12:00:00.000Z",
		});
	},
};

function readyDeps(): PreviewTokenDeps {
	return {
		getPreviewToken: async () => ({
			token: "t1",
			previewUrl: PREVIEW_URL,
			// One hour out: the scheduled re-mint never fires during a spec run.
			expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
		}),
	};
}

// I18nProvider requires children in its props type for createElement calls.
function panelElement(
	props: Partial<PreviewPanelProps> & { deps: PreviewTokenDeps },
) {
	return createElement(I18nProvider, {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(PreviewPanel, {
			projectId: PROJECT_ID,
			title: TITLE,
			reloadKey: 0,
			className: "h-full w-full",
			bootContext: IDLE_BOOT,
			...props,
		}),
	} satisfies ComponentProps<typeof I18nProvider>);
}

function renderPanel(
	props: Partial<PreviewPanelProps> & { deps: PreviewTokenDeps },
) {
	return render(panelElement(props));
}

afterEach(cleanup);

describe("PreviewPanel", () => {
	it("renders the iframe with the signed url and the locked sandbox", async () => {
		renderPanel({ deps: readyDeps() });

		const iframe = await screen.findByTitle(TITLE);
		expect(iframe.getAttribute("src")).toBe(PREVIEW_URL);
		expect(iframe.getAttribute("sandbox")).toBe(
			"allow-scripts allow-same-origin allow-forms allow-popups allow-modals",
		);
		expect(iframe.getAttribute("sandbox")).not.toContain(
			"allow-top-navigation",
		);
	});

	it("shows the loading status while the first mint runs", async () => {
		// A mint that never resolves keeps the panel in the loading state.
		const deps: PreviewTokenDeps = {
			getPreviewToken: () => new Promise<never>(() => undefined),
		};
		renderPanel({ deps });

		expect((await screen.findByRole("status")).textContent).toBe(
			"Loading the preview",
		);
	});

	it("shows the asleep note 1.2 s after a waking answer while no turn runs", async () => {
		const getPreviewToken = vi.fn(wakingDeps.getPreviewToken);
		renderPanel({ deps: { getPreviewToken } });

		await waitFor(() => expect(getPreviewToken).toHaveBeenCalledTimes(1));
		// Flush the rejected mint, so the panel holds the waking status.
		await act(async () => {});
		// The first waking answer waits: a new project's turn often connects in that time.
		expect(screen.getByRole("status").textContent).toBe("Loading the preview");
		await waitFor(
			() =>
				expect(screen.getByRole("status").textContent).toContain(
					"Your app is asleep",
				),
			{ timeout: 2_500 },
		);
	});

	it("shows the machine step while the first turn boots the sandbox", async () => {
		renderPanel({
			deps: wakingDeps,
			bootContext: {
				...IDLE_BOOT,
				isTurnRunning: true,
				turnPhase: "sandbox_waking",
				isFirstTurn: true,
			},
		});

		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe(
				"Getting your app ready. Starting a cloud machine",
			),
		);
		expect(screen.getByText("Copying the starter files")).toBeTruthy();
		expect(screen.getByText("Opening your app")).toBeTruthy();
	});

	it("starts the comet hidden, so it fades in after the drawing", async () => {
		const { container } = renderPanel({
			deps: wakingDeps,
			bootContext: {
				...IDLE_BOOT,
				isTurnRunning: true,
				turnPhase: "sandbox_waking",
				isFirstTurn: true,
			},
		});

		await screen.findByText("Starting a cloud machine");
		// The comet groups are the only elements that reduced motion hides.
		const comets = container.querySelectorAll("g.motion-reduce\\:hidden");
		expect(comets.length).toBe(2);
		for (const comet of comets) {
			expect(comet.getAttribute("opacity")).toBe("0");
		}
	});

	it("keeps the boot screen over the iframe until the frame loads", async () => {
		renderPanel({ deps: readyDeps() });

		const iframe = await screen.findByTitle(TITLE);
		expect(screen.getByRole("status").textContent).toBe(
			"Getting your app ready. Opening your app",
		);

		// The covered frame is out of the tab order until it loads.
		expect(iframe.hasAttribute("inert")).toBe(true);

		// jsdom loads no external src, so the spec fires the load event itself.
		fireEvent.load(iframe);

		await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
		expect(screen.getByTitle(TITLE)).toBe(iframe);
		expect(iframe.hasAttribute("inert")).toBe(false);
	});

	it("keeps the same iframe element and src when only the width changes", async () => {
		const deps = readyDeps();
		const { rerender } = renderPanel({ deps, style: { width: 400 } });
		const iframe = await screen.findByTitle(TITLE);

		rerender(panelElement({ deps, style: { width: 768 } }));

		const resized = await screen.findByTitle(TITLE);
		expect(resized).toBe(iframe);
		expect(resized.getAttribute("src")).toBe(PREVIEW_URL);
	});

	it("shows the alert on an unknown error and retries through refresh", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockRejectedValue(new Error("offline"));
		renderPanel({ deps: { getPreviewToken } });

		expect((await screen.findByRole("alert")).textContent).toContain(
			"Something went wrong. Please try again.",
		);

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		await waitFor(() => expect(getPreviewToken).toHaveBeenCalledTimes(2));
	});

	it("re-mints and swaps the iframe src on a token-expired message", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValueOnce({
				token: "t1",
				previewUrl: PREVIEW_URL,
				// 30 s out, inside the 60 s refresh lead: a token-expired report on
				// a dying token is a real expiry, so the bridge mints again. The
				// report on a fresh token would show the retry state instead.
				expiresAt: new Date(Date.now() + 30_000).toISOString(),
			})
			.mockResolvedValueOnce({
				token: "t2",
				previewUrl: PREVIEW_URL_2,
				expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
			});
		renderPanel({ deps: { getPreviewToken } });

		const iframe = await screen.findByTitle(TITLE);
		expect(iframe.getAttribute("src")).toBe(PREVIEW_URL);

		// The proxy error page reports the dead token from the preview origin.
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: PREVIEW_ORIGIN,
					data: { type: "wandit:preview", event: "token-expired" },
				}),
			);
		});

		await waitFor(() => expect(getPreviewToken).toHaveBeenCalledTimes(2));
		expect((await screen.findByTitle(TITLE)).getAttribute("src")).toBe(
			PREVIEW_URL_2,
		);
	});

	it("drops the iframe and shows the asleep note on a not-running message", async () => {
		renderPanel({ deps: readyDeps() });

		await screen.findByTitle(TITLE);
		// The message listener registers in an effect; flush it before the dispatch.
		await act(async () => {});

		// The proxy error page reports the stopped sandbox from the preview origin.
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: PREVIEW_ORIGIN,
					data: { type: "wandit:preview", event: "not-running" },
				}),
			);
		});

		expect(screen.queryByTitle(TITLE)).toBeNull();
		// The boot screen already showed the step list, so the asleep note needs no wait.
		expect((await screen.findByRole("status")).textContent).toContain(
			"Your app is asleep",
		);
	});

	it("shows the boot screen again when a loaded frame reports not-running", async () => {
		renderPanel({ deps: readyDeps() });

		fireEvent.load(await screen.findByTitle(TITLE));
		await waitFor(() => expect(screen.queryByRole("status")).toBeNull());

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: PREVIEW_ORIGIN,
					data: { type: "wandit:preview", event: "not-running" },
				}),
			);
		});

		expect(screen.queryByTitle(TITLE)).toBeNull();
		await waitFor(
			() =>
				expect(screen.getByRole("status").textContent).toContain(
					"Your app is asleep",
				),
			{ timeout: 2_500 },
		);
	});
});
