// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BillingPlanCatalogItem } from "@wandit/contracts";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualPaymentRequestPanel } from "./manual-payment-request-panel";

const dictionary = vi.hoisted(() => ({
	billing: {
		planPicker: {
			back: "Back",
			billingCycle: "Billing cycle",
			businessFeatures: ["Business feature"],
			businessName: "Business",
			businessTagline: "For teams",
			creditTier: "Credits per month",
			monthly: "Monthly",
			offline: {
				continue: "Continue",
				form: { required: "Required" },
				localPriceNote: "Local price",
				pending: { planLabel: "Plan" },
				steps: { plan: "Choose your plan" },
			},
			perMonth: "/ month",
			perYear: "/ year",
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

vi.mock("@/features/billing/api/billing.queries", () => ({
	useManualSubscriptionRequestQuery: () => ({
		data: { request: null },
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@/features/billing/api/billing.mutations", () => ({
	useCancelManualSubscriptionRequest: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
	useCreateManualSubscriptionRequest: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
}));

vi.mock("@/lib/i18n", () => ({
	useDictionary: () => dictionary,
	useTranslation: () => ({ locale: "en", t: (key: string) => key }),
}));

vi.mock("./plan-card", async () => {
	const { createElement } = await import("react");

	return {
		PlanCard: (props: {
			interval: "month" | "year";
			name: string;
			onSelectTier: (tierCredits: 700) => void;
			tier: { tierCredits: number };
			tiers: readonly { tierCredits: number }[];
		}) =>
			createElement(
				"div",
				{
					"data-selection": `${props.name}:${props.tier.tierCredits}:${props.interval}`,
					"data-testid": "manual-plan-card",
				},
				props.tiers.some((tier) => tier.tierCredits === 700)
					? createElement(
							"button",
							{
								onClick: () => props.onSelectTier(700),
								type: "button",
							},
							"Choose 700 credits",
						)
					: null,
			),
	};
});

const plans: BillingPlanCatalogItem[] = [
	{
		basePer100Usd: 16,
		features: { seats: false, teamWorkspace: false },
		id: "starter",
		tiers: [
			{
				annualLookupKey: "starter_50_year",
				annualUsd: 80,
				monthlyLookupKey: "starter_50_month",
				monthlyUsd: 8,
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
];

describe("ManualPaymentRequestPanel selection changes", () => {
	afterEach(cleanup);

	it("reports a coherent Pro yearly tier selection to its owner", () => {
		const onSelectionChange = vi.fn();
		render(
			createElement(ManualPaymentRequestPanel, {
				defaultFullName: "Ada",
				onClose: vi.fn(),
				onSelectionChange,
				plans,
				subscription: null,
				surface: "marketing_pricing",
			}),
		);

		fireEvent.click(screen.getByRole("radio", { name: "Pro" }));
		expect(onSelectionChange).toHaveBeenLastCalledWith({
			interval: "month",
			planId: "pro",
			tierCredits: 175,
		});

		fireEvent.click(screen.getByRole("radio", { name: /Yearly/ }));
		expect(onSelectionChange).toHaveBeenLastCalledWith({
			interval: "year",
			planId: "pro",
			tierCredits: 175,
		});

		fireEvent.click(screen.getByRole("button", { name: "Choose 700 credits" }));
		expect(onSelectionChange).toHaveBeenLastCalledWith({
			interval: "year",
			planId: "pro",
			tierCredits: 700,
		});
		expect(screen.getByTestId("manual-plan-card").dataset.selection).toBe(
			"Pro:700:year",
		);
	});
});
