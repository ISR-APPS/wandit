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
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PreviewPanel, type PreviewPanelProps } from "./preview-panel";

const PROJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const PREVIEW_URL = `https://r-abcdef123456--p-${PROJECT_ID}.wanditpreview.app/?wt=t1`;
const PREVIEW_URL_2 = `https://r-abcdef123456--p-${PROJECT_ID}.wanditpreview.app/?wt=t2`;
const PREVIEW_ORIGIN = new URL(PREVIEW_URL).origin;
const TITLE = "Preview of Nadi Fitness";

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

	it("shows the spinner without text while the first mint runs", async () => {
		// A mint that never resolves keeps the panel in the loading state.
		const deps: PreviewTokenDeps = {
			getPreviewToken: () => new Promise<never>(() => undefined),
		};
		renderPanel({ deps });

		const status = await screen.findByRole("status");
		expect(status.textContent).toBe("");
	});

	it("shows the waking text while no sandbox runs", async () => {
		const deps: PreviewTokenDeps = {
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
		renderPanel({ deps });

		expect((await screen.findByRole("status")).textContent).toContain(
			"Waking up the sandbox…",
		);
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

	it("drops the iframe and shows the waking state on a not-running message", async () => {
		renderPanel({ deps: readyDeps() });

		await screen.findByTitle(TITLE);

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
		expect((await screen.findByRole("status")).textContent).toContain(
			"Waking up the sandbox…",
		);
	});
});
