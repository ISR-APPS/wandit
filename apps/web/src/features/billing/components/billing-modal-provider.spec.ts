// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LANDING_PLAN_SELECTION_STORAGE_KEY } from "../lib/landing-plan-selection";
import {
	BillingModalProvider,
	useBillingModal,
} from "./billing-modal-provider";

const state = vi.hoisted(() => ({
	openAuth: vi.fn(),
	pathname: "/",
	selectionAtAuth: null as string | null,
	session: null as { user: { id: string } } | null,
}));

vi.mock("@tanstack/react-router", () => ({
	useLocation: ({
		select,
	}: {
		select: (location: { pathname: string }) => string;
	}) => select({ pathname: state.pathname }),
}));

vi.mock("@/features/auth", () => ({
	useAuthModal: () => ({ open: state.openAuth }),
	useSession: () => ({ data: state.session }),
}));

vi.mock("@/features/workspaces/lib/workspace-provider", () => ({
	useWorkspace: () => ({ actorCanManageBilling: true, isPersonal: true }),
}));

vi.mock("../lib/billing-error-dispatch", () => ({
	subscribeToBillingErrors: () => () => undefined,
}));

vi.mock("./plan-picker-dialog", async () => {
	const { createElement } = await import("react");

	return {
		PlanPickerDialog: (props: {
			initialInterval?: string;
			initialPlan?: string;
			initialTierCredits?: number;
			open: boolean;
			surface: string;
		}) =>
			createElement("output", {
				"data-interval": props.initialInterval,
				"data-open": String(props.open),
				"data-plan": props.initialPlan,
				"data-surface": props.surface,
				"data-testid": "plan-picker",
				"data-tier": props.initialTierCredits,
			}),
	};
});

vi.mock(
	"@/features/workspaces/components/workspace-billing-notice-dialog",
	async () => {
		const { createElement } = await import("react");

		return {
			WorkspaceBillingNoticeDialog: () => createElement("div"),
		};
	},
);

function OpenLandingSelectionButton() {
	const { openPlanPicker } = useBillingModal();

	return createElement(
		"button",
		{
			onClick: () =>
				openPlanPicker("marketing_pricing", {
					interval: "year",
					plan: "pro",
					tierCredits: 1000,
				}),
			type: "button",
		},
		"Choose Pro",
	);
}

function renderProvider(queryClient: QueryClient) {
	return createElement(
		QueryClientProvider,
		{ client: queryClient },
		createElement(
			BillingModalProvider,
			null,
			createElement(OpenLandingSelectionButton),
		),
	);
}

describe("BillingModalProvider landing auth handoff", () => {
	beforeEach(() => {
		state.openAuth.mockReset();
		state.pathname = "/";
		state.selectionAtAuth = null;
		state.session = null;
		window.sessionStorage.clear();
		state.openAuth.mockImplementation(() => {
			state.selectionAtAuth = window.sessionStorage.getItem(
				LANDING_PLAN_SELECTION_STORAGE_KEY,
			);
		});
	});

	afterEach(cleanup);

	it("stashes before auth, then consumes once and opens the validated picker", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const view = render(renderProvider(queryClient));

		fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }));

		expect(state.openAuth).toHaveBeenCalledWith({ next: "/billing" });
		expect(state.selectionAtAuth).not.toBeNull();
		expect(screen.getByTestId("plan-picker").dataset.open).toBe("false");

		state.pathname = "/billing";
		state.session = { user: { id: "user-1" } };
		view.rerender(renderProvider(queryClient));

		await waitFor(() => {
			const picker = screen.getByTestId("plan-picker");
			expect(picker.dataset.open).toBe("true");
			expect(picker.dataset.plan).toBe("pro");
			expect(picker.dataset.tier).toBe("1000");
			expect(picker.dataset.interval).toBe("year");
			expect(picker.dataset.surface).toBe("marketing_pricing");
		});
		expect(
			window.sessionStorage.getItem(LANDING_PLAN_SELECTION_STORAGE_KEY),
		).toBeNull();
	});

	it("consumes after onboarding navigates to billing with the same session", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const view = render(renderProvider(queryClient));

		fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }));
		state.session = { user: { id: "user-1" } };
		state.pathname = "/onboarding";
		view.rerender(renderProvider(queryClient));

		await waitFor(() => {
			expect(screen.getByTestId("plan-picker").dataset.open).toBe("false");
		});
		expect(
			window.sessionStorage.getItem(LANDING_PLAN_SELECTION_STORAGE_KEY),
		).not.toBeNull();

		state.pathname = "/billing";
		view.rerender(renderProvider(queryClient));

		await waitFor(() => {
			expect(screen.getByTestId("plan-picker").dataset.open).toBe("true");
		});
		expect(
			window.sessionStorage.getItem(LANDING_PLAN_SELECTION_STORAGE_KEY),
		).toBeNull();
	});
});
