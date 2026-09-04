// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanPickerDialog } from "./plan-picker-dialog";

const catalog = vi.hoisted(() => ({
	plans: [
		{
			basePer100Usd: 18,
			features: { seats: false, teamWorkspace: false },
			id: "starter",
			tiers: [
				{
					annualLookupKey: "starter_50_year",
					annualUsd: 90,
					monthlyLookupKey: "starter_50_month",
					monthlyUsd: 9,
					tierCredits: 50,
				},
			],
		},
		{
			basePer100Usd: (25 / 175) * 100,
			features: { seats: false, teamWorkspace: false },
			id: "pro",
			tiers: [
				{
					annualLookupKey: "pro_175_year",
					annualUsd: 250,
					monthlyLookupKey: "pro_175_month",
					monthlyUsd: 25,
					tierCredits: 175,
				},
				{
					annualLookupKey: "pro_700_year",
					annualUsd: 1000,
					monthlyLookupKey: "pro_700_month",
					monthlyUsd: 100,
					tierCredits: 700,
				},
			],
		},
		{
			basePer100Usd: (50 / 175) * 100,
			features: { seats: true, teamWorkspace: true },
			id: "business",
			tiers: [
				{
					annualLookupKey: "business_175_year",
					annualUsd: 500,
					monthlyLookupKey: "business_175_month",
					monthlyUsd: 50,
					tierCredits: 175,
				},
			],
		},
	],
	topupPacks: [],
}));

const dictionary = vi.hoisted(() => ({
	billing: {
		planPicker: {
			billingCycle: "Billing cycle",
			businessFeatures: ["Business feature"],
			businessName: "Business",
			businessTagline: "For teams",
			chooseDescription: "Choose a plan",
			chooseTitle: "Choose your plan",
			close: "Close",
			continueToCheckout: "Continue",
			creditTier: "Credits",
			monthly: "Monthly",
			offline: {
				description: "Choose a plan and payment method",
				tabs: {
					ariaLabel: "Payment method",
					card: "Card",
					offline: "Cash / transfer",
				},
				title: "Cash or transfer",
			},
			popularBadge: "Popular",
			proFeatures: ["Pro feature"],
			proName: "Pro",
			proTagline: "For creators",
			starterFeatures: ["Starter feature"],
			starterName: "Starter",
			starterTagline: "Start small",
			twoMonthsFree: "2 months free",
			yearly: "Yearly",
		},
	},
}));

vi.mock("@/features/auth", () => ({
	useSession: () => ({
		data: { user: { id: "user-1", name: "Ada" } },
		isPending: false,
	}),
}));

vi.mock("@/features/billing/api/billing.queries", () => ({
	useBillingPlansQuery: () => ({
		data: catalog,
		isError: false,
		isPending: false,
	}),
	useBillingSubscriptionQuery: () => ({
		data: { balance: { settledBalance: 0 }, subscription: null },
		isError: false,
		isPending: false,
	}),
}));

vi.mock("@/features/billing/api/billing.mutations", () => {
	const mutation = () => ({ isPending: false, mutateAsync: vi.fn() });

	return {
		useChangeBillingSubscription: mutation,
		useCreateBillingCheckout: mutation,
		useCreateBillingPortal: mutation,
		useCreateBillingTopupCheckout: mutation,
		usePreviewBillingSubscriptionChange: mutation,
		useResumeBillingSubscription: mutation,
	};
});

vi.mock("@/features/credits/components/credits-elsewhere-notice", () => ({
	CreditsElsewhereNotice: () => null,
}));

vi.mock("@/features/product-events", () => ({
	emitPricingViewed: vi.fn(),
	getProductEventSessionState: () => "authenticated",
}));

vi.mock("@/features/settings/api/settings.queries", () => ({
	usePublicSettingsQuery: () => ({
		data: {
			manualPaymentsEnabled: true,
			organizationsEnabled: false,
			paidSubscriptionsEnabled: true,
			topupsEnabled: false,
		},
		isError: false,
		isPending: false,
	}),
}));

vi.mock("@/features/workspaces/components/create-workspace-dialog", () => ({
	CreateWorkspaceDialog: () => null,
}));

vi.mock("@/features/workspaces/lib/workspace-provider", () => ({
	useWorkspace: () => ({ isPersonal: true }),
}));

vi.mock("@/lib/i18n", () => ({
	useDictionary: () => dictionary,
	useTranslation: () => ({
		locale: "en",
		t: (key: string) => key,
	}),
}));

vi.mock("@wandit/ui/components/dialog", async () => {
	const { createElement } = await import("react");
	const Wrapper = ({ children }: { children?: ReactNode }) =>
		createElement("div", null, children);

	return {
		Dialog: ({ children, open }: { children?: ReactNode; open: boolean }) =>
			open ? createElement("div", null, children) : null,
		DialogContent: Wrapper,
		DialogDescription: Wrapper,
		DialogFooter: Wrapper,
		DialogHeader: Wrapper,
		DialogTitle: Wrapper,
	};
});

vi.mock("./plan-card", async () => {
	const { createElement } = await import("react");

	return {
		PlanCard: ({ name }: { name: string }) => createElement("div", null, name),
	};
});

vi.mock("./manual-payment-request-panel", async () => {
	const { createElement, useState } = await import("react");

	return {
		ManualPaymentRequestPanel: (props: {
			initialInterval?: "month" | "year";
			initialPlan?: "starter" | "pro" | "business";
			initialTierCredits?: number;
			onSelectionChange: (selection: {
				interval: "month" | "year";
				planId: "starter" | "pro" | "business";
				tierCredits: 50 | 175 | 700;
			}) => void;
			plans: typeof catalog.plans;
		}) => {
			const firstPlan = props.plans[0];
			const initialPlan =
				props.plans.find((plan) => plan.id === props.initialPlan) ?? firstPlan;
			const [selection, setSelection] = useState(() => ({
				interval: props.initialInterval ?? "month",
				planId: initialPlan?.id ?? "starter",
				tierCredits:
					props.initialTierCredits ?? initialPlan?.tiers[0]?.tierCredits ?? 50,
			}));

			return createElement(
				"div",
				{
					"data-selection": `${selection.planId}:${selection.tierCredits}:${selection.interval}`,
					"data-testid": "offline-selection",
				},
				createElement(
					"button",
					{
						onClick: () => {
							const next = {
								interval: "year" as const,
								planId: "pro" as const,
								tierCredits: 700 as const,
							};
							setSelection(next);
							props.onSelectionChange(next);
						},
						type: "button",
					},
					"Choose Pro yearly",
				),
			);
		},
	};
});

describe("plan picker offline state", () => {
	afterEach(cleanup);

	it("keeps a Pro yearly cash selection through Card and back", () => {
		render(
			createElement(PlanPickerDialog, {
				initialPaymentMethod: "card",
				onOpenChange: vi.fn(),
				open: true,
				surface: "marketing_pricing",
			}),
		);

		const offlinePanel = screen.getByTestId("offline-selection");
		const offlineContent = offlinePanel.closest('[data-slot="tabs-content"]');
		expect(offlineContent?.getAttribute("data-state")).toBe("inactive");
		expect(offlineContent?.className).toContain("data-[state=inactive]:hidden");

		fireEvent.click(screen.getByRole("tab", { name: "Cash / transfer" }));
		fireEvent.click(screen.getByRole("button", { name: "Choose Pro yearly" }));
		expect(offlinePanel.dataset.selection).toBe("pro:700:year");

		fireEvent.click(screen.getByRole("tab", { name: "Card" }));
		expect(screen.getByTestId("offline-selection")).toBe(offlinePanel);
		expect(offlineContent?.getAttribute("data-state")).toBe("inactive");

		fireEvent.click(screen.getByRole("tab", { name: "Cash / transfer" }));
		expect(screen.getByTestId("offline-selection").dataset.selection).toBe(
			"pro:700:year",
		);
	});
});
