// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

import type { SessionUser } from "@/features/auth";

// The Better Auth client keeps the global fetch when its module loads, so
// every repo module loads after the stub.
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
const { default: OAuthConsentPage } = await import("./oauth-consent-page");
const { codingAgentKeys } = await import("../api/coding-agents.queries");
const { promptStash } = await import("@/features/auth");

const CLIENT_ID = "https://claude.ai/oauth/claude-code-client-metadata";
const SIGNED_QUERY = new URLSearchParams([
	["client_id", CLIENT_ID],
	["scope", "projects:read"],
	["redirect_uri", "http://127.0.0.1:33418/callback"],
	["ba_param", "client_id"],
	["ba_param", "redirect_uri"],
	["ba_param", "scope"],
	["sig", "s"],
]).toString();

// jsdom cannot reload. posthog-js reads location when it loads, so this stub
// comes after the imports.
const reloadMock = vi.fn<() => void>();
vi.stubGlobal("location", { search: `?${SIGNED_QUERY}`, reload: reloadMock });

const USER: SessionUser = {
	id: "user-1",
	email: "dev@wandit.test",
	emailVerified: true,
	name: "Dev",
	image: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
	displayEmail: null,
	onboardingCompletedAt: new Date(0),
	banned: false,
};

/** Answers the Better Auth routes. `signOutStatus` is the HTTP status of `POST /sign-out`. */
function stubAuthApi(signOutStatus: number) {
	fetchMock.mockImplementation(async (input) => {
		const url = new URL(input instanceof Request ? input.url : input);
		if (url.pathname.endsWith("/get-session")) {
			return Response.json({
				session: { id: "session-1", userId: USER.id, token: "token" },
				user: USER,
			});
		}
		if (url.pathname.endsWith("/sign-out")) {
			return Response.json(
				signOutStatus === 200 ? { success: true } : { message: "failed" },
				{ status: signOutStatus },
			);
		}
		return Response.json({ message: "not found" }, { status: 404 });
	});
}

/** The page in its providers. The client name is in the cache, so the card shows at once. */
function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
		},
	});
	queryClient.setQueryData(codingAgentKeys.publicClient(CLIENT_ID), {
		client_id: CLIENT_ID,
		client_name: "Claude Code",
	});
	// Both providers require children in their props type for createElement calls.
	const i18nProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(OAuthConsentPage, { initialUser: USER }),
	};
	const queryProps: ComponentProps<typeof QueryClientProvider> = {
		client: queryClient,
		children: createElement(I18nProvider, i18nProps),
	};
	render(createElement(QueryClientProvider, queryProps));
}

function isDisabled(name: string): boolean {
	const button = screen.getByRole("button", { name });
	return button instanceof HTMLButtonElement && button.disabled;
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	fetchMock.mockReset();
	reloadMock.mockReset();
	promptStash.clear();
});

describe("OAuthConsentPage", () => {
	it("keeps Allow disabled for 1 s after the card shows and after a window focus", async () => {
		vi.useFakeTimers();
		stubAuthApi(200);
		renderPage();
		// The session loads on a 0 ms timer.
		await act(() => vi.advanceTimersByTimeAsync(10));
		expect(isDisabled("Allow")).toBe(true);
		expect(isDisabled("Deny")).toBe(false);

		await act(() => vi.advanceTimersByTimeAsync(1000));
		expect(isDisabled("Allow")).toBe(false);

		// A closed popup gives the focus back to this window.
		act(() => {
			window.dispatchEvent(new Event("focus"));
		});
		expect(isDisabled("Allow")).toBe(true);
		await act(() => vi.advanceTimersByTimeAsync(1000));
		expect(isDisabled("Allow")).toBe(false);
	});

	it("does not reload and enables Switch account again when the sign-out request fails", async () => {
		stubAuthApi(500);
		renderPage();
		fireEvent.click(
			screen.getByRole("button", { name: "Not you? Switch account" }),
		);
		expect(isDisabled("Not you? Switch account")).toBe(true);

		await waitFor(() =>
			expect(isDisabled("Not you? Switch account")).toBe(false),
		);
		expect(reloadMock).not.toHaveBeenCalled();
	});

	it("clears the prompt stash of the old account before it reloads", async () => {
		stubAuthApi(200);
		promptStash.stash("Build a shop", undefined, { autostart: true });
		const stashAtReload: Array<string | undefined> = [];
		reloadMock.mockImplementation(() => {
			stashAtReload.push(promptStash.peek()?.prompt);
		});
		renderPage();
		fireEvent.click(
			screen.getByRole("button", { name: "Not you? Switch account" }),
		);

		await waitFor(() => expect(reloadMock).toHaveBeenCalled());
		expect(stashAtReload).toEqual([undefined]);
	});
});
