// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import type { ProjectSecretSummary } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import type { setSecret } from "../../api/cloud.services";
import { SecretsPanel } from "./secrets-panel";

const PROJECT_ID = crypto.randomUUID();

/** A Supabase key that server code writes. The user can never delete it. */
const SERVICE_ROLE_KEY: ProjectSecretSummary = {
	name: "SUPABASE_SERVICE_ROLE_KEY",
	kind: "system",
	createdAt: "2026-10-01T10:00:00.000Z",
	updatedAt: "2026-10-01T10:00:00.000Z",
};

/** A secret the user set in the panel. */
const STRIPE_KEY: ProjectSecretSummary = {
	name: "STRIPE_API_KEY",
	kind: "user",
	createdAt: "2026-10-02T10:00:00.000Z",
	updatedAt: "2026-10-02T10:00:00.000Z",
};

const NAME_INVALID =
	"Use A to Z, 0 to 9, and _. Start with a letter. Use 64 characters or fewer. Names that start with SUPABASE_ are reserved.";

// The cache holds the list and nothing is stale or retried, so the panel
// never calls the API. A save goes to the `putSecret` fake; no case
// confirms a delete, because the delete hook calls the API.
function renderPanel(
	secrets: ProjectSecretSummary[],
	putSecret?: typeof setSecret,
) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	queryClient.setQueryData(cloudKeys.secrets(PROJECT_ID), secrets);
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(SecretsPanel, {
			projectId: PROJECT_ID,
			isActive: true,
			putSecret,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				TooltipProvider,
				null,
				createElement(I18nProvider, providerProps),
			),
		),
	);
	return { queryClient };
}

function typeName(text: string): void {
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: text },
	});
}

function typeValue(text: string): void {
	fireEvent.change(screen.getByLabelText("Value"), {
		target: { value: text },
	});
}

function saveButton(): HTMLElement {
	return screen.getByRole("button", { name: "Save secret" });
}

afterEach(cleanup);

describe("SecretsPanel", () => {
	it("lists the names and gives a delete button only to a user secret", () => {
		renderPanel([SERVICE_ROLE_KEY, STRIPE_KEY]);

		const systemRow = within(
			screen.getByRole("row", { name: /SUPABASE_SERVICE_ROLE_KEY/ }),
		);
		expect(systemRow.getByText("Wandit")).toBeTruthy();
		expect(systemRow.queryByRole("button")).toBeNull();
		const userRow = within(screen.getByRole("row", { name: /STRIPE_API_KEY/ }));
		expect(userRow.getByText("You")).toBeTruthy();
		expect(
			userRow.getByRole("button", { name: "Delete STRIPE_API_KEY" }),
		).toBeTruthy();
	});

	it("asks before a delete and names the secret, and deletes nothing yet", async () => {
		const { queryClient } = renderPanel([SERVICE_ROLE_KEY, STRIPE_KEY]);

		fireEvent.click(
			screen.getByRole("button", { name: "Delete STRIPE_API_KEY" }),
		);

		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText(
				"Your app can no longer use STRIPE_API_KEY. You cannot undo it.",
			),
		).toBeTruthy();
		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});

	it("upper-cases a typed name and allows the save of a valid secret", () => {
		renderPanel([]);

		typeName("stripe_key");
		typeValue("sk_test_123");

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "STRIPE_KEY");
		expect(screen.queryByText(NAME_INVALID)).toBeNull();
		expect(saveButton().hasAttribute("disabled")).toBe(false);
	});

	it("sends the name and the value once, then keeps the value nowhere", async () => {
		const putSecret = vi.fn<typeof setSecret>(async () => undefined);
		const { queryClient } = renderPanel([], putSecret);

		typeName("stripe_key");
		typeValue("sk_test_123");
		fireEvent.click(saveButton());

		await waitFor(() =>
			expect(screen.getByLabelText("Value")).toHaveProperty("value", ""),
		);
		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(putSecret).toHaveBeenCalledWith(PROJECT_ID, "STRIPE_KEY", {
			value: "sk_test_123",
		});
		// The mutation variables hold the value, so the cache must drop them.
		await waitFor(() =>
			expect(queryClient.getMutationCache().getAll()).toHaveLength(0),
		);
	});

	it.each([
		{ typed: "1abc", shown: "1ABC" },
		// Security: the name of a Supabase key that provisioning stores.
		{ typed: "supabase_service_role_key", shown: "SUPABASE_SERVICE_ROLE_KEY" },
	])("refuses the name $shown", ({ typed, shown }) => {
		renderPanel([]);

		typeName(typed);
		typeValue("sk_test_123");

		expect(screen.getByLabelText("Name")).toHaveProperty("value", shown);
		expect(screen.getByText(NAME_INVALID)).toBeTruthy();
		expect(saveButton().hasAttribute("disabled")).toBe(true);
	});

	it("hides the value in a password field", () => {
		renderPanel([]);

		expect(screen.getByLabelText("Value").getAttribute("type")).toBe(
			"password",
		);
	});

	it("shows the list with no backend state in the cache", () => {
		const { queryClient } = renderPanel([STRIPE_KEY]);

		expect(screen.getByText("STRIPE_API_KEY")).toBeTruthy();
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID)),
		).toBeUndefined();
	});
});
