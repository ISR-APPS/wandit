// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
	defaultLocale,
	fallbackDictionary,
} from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import type { AxiosAdapter } from "axios";
import { type ComponentProps, createElement } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BaseService } from "@/lib/BaseService";
import { UserReferralCapture } from "./user-referral-capture";

// The localStorage key of the invite code in lib/helpers.ts; copied on purpose.
const STORED_INVITE_CODE_KEY = "wandit_user_referral_code";
const INVITE_CODE = "abcd1234";
// The magic-link destination, and the address where the auth gate sends a user without onboarding.
const DESTINATION = `/dashboard?invite=${INVITE_CODE}`;
const ONBOARDING_ADDRESS = `/onboarding?next=${encodeURIComponent(DESTINATION)}`;

describe("UserReferralCapture", () => {
	const originalStorage = Object.getOwnPropertyDescriptor(
		window,
		"localStorage",
	);
	const stored = new Map<string, string>();
	// A Map-backed stand-in for the browser storage: Node 25 ships a stub without `setItem`.
	const fakeStorage = {
		getItem: (key: string) => stored.get(key) ?? null,
		setItem: (key: string, value: string) => {
			stored.set(key, value);
		},
		removeItem: (key: string) => {
			stored.delete(key);
		},
	};

	// The number of claims that reached the network layer in the current case.
	let claimCount = 0;
	// The API gives this answer to the first claim and to each repeat claim of the same code.
	const answerClaimed: AxiosAdapter = async (config) => {
		claimCount += 1;
		return {
			data: { outcome: "claimed", friendCredits: 10 },
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	};

	beforeEach(() => {
		stored.clear();
		claimCount = 0;
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: fakeStorage,
		});
		// The adapter is the network layer of axios. Vitest loads a new module copy for each spec file.
		BaseService.defaults.adapter = answerClaimed;
	});

	afterEach(() => {
		cleanup();
		if (originalStorage) {
			Object.defineProperty(window, "localStorage", originalStorage);
		}
	});

	/** Loads the app at one address with a signed-in user, as a full page load does. */
	function loadPageAt(address: string) {
		window.history.replaceState(null, "", address);
		const rootRoute = createRootRoute({
			component: () => createElement(UserReferralCapture, { userId: "user-1" }),
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				createRoute({ getParentRoute: () => rootRoute, path: "/onboarding" }),
				createRoute({ getParentRoute: () => rootRoute, path: "/dashboard" }),
			]),
		});
		// I18nProvider requires children in its props type for createElement calls.
		const i18nProps: ComponentProps<typeof I18nProvider> = {
			locale: defaultLocale,
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(RouterProvider, { router }),
		};
		render(
			createElement(
				QueryClientProvider,
				{ client: new QueryClient() },
				createElement(I18nProvider, i18nProps),
			),
		);
		return router;
	}

	it("drops an invite code that comes back in the address after its claim", async () => {
		// The friend opened the magic link in the browser that holds the code. The auth gate sent the new user here.
		stored.set(STORED_INVITE_CODE_KEY, INVITE_CODE);
		const router = loadPageAt(ONBOARDING_ADDRESS);

		// The claim runs on the onboarding page and the API gives its final answer.
		await waitFor(() => {
			expect(stored.has(STORED_INVITE_CODE_KEY)).toBe(false);
		});
		expect(claimCount).toBe(1);

		// Onboarding ends and goes to the magic-link destination, which holds the code again.
		await act(() => router.navigate({ href: DESTINATION }));

		await waitFor(() => {
			expect(window.location.search).toBe("");
		});
		expect(window.location.pathname).toBe("/dashboard");
		expect(stored.has(STORED_INVITE_CODE_KEY)).toBe(false);
		expect(claimCount).toBe(1);
	});

	it("claims a code that waits in `next`, and shows the bonus toast one time", async () => {
		// sonner keeps each toast in this list, also without a Toaster on the page.
		const toastCountAtStart = toast.getHistory().length;

		// The friend opened the magic link in a different browser. No code is in the storage.
		loadPageAt(ONBOARDING_ADDRESS);
		await waitFor(() => {
			expect(claimCount).toBe(1);
		});
		await waitFor(() => {
			expect(toast.getHistory().length).toBe(toastCountAtStart + 1);
		});

		// The friend loads the page again. `next` still holds the code, and the API answers `claimed` again.
		cleanup();
		loadPageAt(ONBOARDING_ADDRESS);
		await waitFor(() => {
			expect(claimCount).toBe(2);
		});
		// The answer handler removes the stored code before it decides on the toast.
		await waitFor(() => {
			expect(stored.has(STORED_INVITE_CODE_KEY)).toBe(false);
		});
		expect(toast.getHistory().length).toBe(toastCountAtStart + 1);
	});
});
