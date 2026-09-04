// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import {
	BILLING_CATALOG,
	type BillingPlanCatalogItem,
	priceLookupKey,
	purchasableTiersFor,
} from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSelectedTier } from "../lib/plan-selection";
import { PlanPickerDialog } from "./plan-picker-dialog";

const pickerState = vi.hoisted(() => ({
	manualPaymentsEnabled: false,
	organizationsEnabled: true,
	paidSubscriptionsEnabled: true,
	plansError: false,
	settingsDataOnError: false,
	settingsError: false,
	subscriptionError: false,
}));

const pickerCatalog = vi.hoisted(() => ({
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

const pickerDictionary = vi.hoisted(() => ({
	billing: {
		planPicker: {
			betaBadge: "Beta",
			betaBody: "Paid plans are unavailable.",
			betaTitle: "Paid plans coming soon",
			billingCycle: "Billing cycle",
			businessFeatures: ["Business feature"],
			businessName: "Business",
			businessTagline: "For teams",
			chooseDescription: "Choose a plan",
			chooseTitle: "Choose your plan",
			close: "Close",
			continueToCheckout: "Continue",
			creditTier: "Credits",
			loadErrorBody: "Try again later.",
			loadErrorTitle: "Plans could not load",
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
			perMonth: "per month",
			perYear: "per year",
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
		data: pickerState.plansError ? undefined : pickerCatalog,
		isError: pickerState.plansError,
		isPending: false,
	}),
	useBillingSubscriptionQuery: () => ({
		data: pickerState.subscriptionError
			? undefined
			: { balance: { settledBalance: 0 }, subscription: null },
		isError: pickerState.subscriptionError,
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
		data:
			pickerState.settingsError && !pickerState.settingsDataOnError
				? undefined
				: {
						manualPaymentsEnabled: pickerState.manualPaymentsEnabled,
						organizationsEnabled: pickerState.organizationsEnabled,
						paidSubscriptionsEnabled: pickerState.paidSubscriptionsEnabled,
						topupsEnabled: false,
					},
		isError: pickerState.settingsError,
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
	useDictionary: () => pickerDictionary,
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
		DialogDescription: ({ children }: { children?: ReactNode }) =>
			createElement("p", null, children),
		DialogFooter: Wrapper,
		DialogHeader: Wrapper,
		DialogTitle: ({ children }: { children?: ReactNode }) =>
			createElement("h1", null, children),
	};
});

vi.mock("./manual-payment-request-panel", () => ({
	ManualPaymentRequestPanel: () => null,
}));

vi.mock("./plan-card", async () => {
	const { createElement } = await import("react");

	return {
		PlanCard: ({ action, name }: { action: ReactNode; name: string }) =>
			createElement("article", null, createElement("h2", null, name), action),
	};
});

function catalogPlan(
	planId: "starter" | "pro" | "business",
): BillingPlanCatalogItem {
	const catalog = BILLING_CATALOG.plans[planId];

	return {
		basePer100Usd: catalog.basePer100Usd,
		features: catalog.features,
		id: planId,
		tiers: purchasableTiersFor(planId).map((tierCredits) => {
			const monthlyUsd = (
				catalog.monthlyPricesUsd as Readonly<Record<number, number>>
			)[tierCredits];

			return {
				annualLookupKey: priceLookupKey(planId, tierCredits, "year"),
				annualUsd: monthlyUsd * BILLING_CATALOG.yearlyPriceMultiplier,
				monthlyLookupKey: priceLookupKey(planId, tierCredits, "month"),
				monthlyUsd,
				tierCredits,
			};
		}),
	};
}

describe("plan picker tier selection", () => {
	it("falls back to each plan's first purchasable tier", () => {
		expect(
			resolveSelectedTier(catalogPlan("starter"), null, null)?.tierCredits,
		).toBe(50);
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, null)?.tierCredits,
		).toBe(175);
	});

	it("keeps a selected plan and purchasable tier paired", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), { pro: 700 }, null)?.tierCredits,
		).toBe(700);
		expect(
			resolveSelectedTier(catalogPlan("starter"), { pro: 700 }, null)
				?.tierCredits,
		).toBe(50);
	});

	it("does not surface an invalid or legacy initial tier", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), { pro: 250 }, null)?.tierCredits,
		).toBe(175);
	});

	it("keeps an independent selected tier for every plan card", () => {
		const selections = { pro: 700, starter: 50 } as const;

		expect(
			resolveSelectedTier(catalogPlan("pro"), selections, null)?.tierCredits,
		).toBe(700);
		expect(
			resolveSelectedTier(catalogPlan("starter"), selections, null)
				?.tierCredits,
		).toBe(50);
	});

	it("falls back from a legacy subscriber tier to the first active target", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, {
				plan: "pro",
				tierCredits: 250,
			})?.tierCredits,
		).toBe(175);
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, {
				plan: "pro",
				tierCredits: 12500,
			})?.tierCredits,
		).toBe(175);
	});

	it("keeps an active subscriber tier selected for its current plan", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, {
				plan: "pro",
				tierCredits: 700,
			})?.tierCredits,
		).toBe(700);
	});
});

describe("plan picker query resilience", () => {
	beforeEach(() => {
		pickerState.manualPaymentsEnabled = false;
		pickerState.organizationsEnabled = true;
		pickerState.paidSubscriptionsEnabled = true;
		pickerState.plansError = false;
		pickerState.settingsDataOnError = false;
		pickerState.settingsError = false;
		pickerState.subscriptionError = false;
	});

	afterEach(cleanup);

	function renderPicker() {
		return render(
			createElement(PlanPickerDialog, {
				onOpenChange: vi.fn(),
				open: true,
				surface: "marketing_pricing",
			}),
		);
	}

	it.each([
		{ cached: false, label: "without cached data" },
		{ cached: true, label: "with stale cached data" },
	])("keeps personal card checkout available when public settings fail $label", ({
		cached,
	}) => {
		pickerState.settingsError = true;
		pickerState.settingsDataOnError = cached;
		if (cached) {
			pickerState.manualPaymentsEnabled = true;
			pickerState.paidSubscriptionsEnabled = false;
		}

		renderPicker();

		expect(screen.getByRole("heading", { name: "Starter" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Pro" })).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "Continue" })).toHaveLength(2);
		expect(screen.queryByRole("heading", { name: "Business" })).toBeNull();
		expect(screen.queryByRole("tab", { name: "Cash / transfer" })).toBeNull();
		expect(screen.queryByText("Plans could not load")).toBeNull();
	});

	it("still honors a valid paid-subscriptions switch", () => {
		pickerState.paidSubscriptionsEnabled = false;

		renderPicker();

		expect(
			screen.getByRole("heading", { name: "Paid plans coming soon" }),
		).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Starter" })).toBeNull();
	});

	it.each([
		"plans",
		"subscription",
	] as const)("keeps the load error for %s query failures", (failedQuery) => {
		if (failedQuery === "plans") {
			pickerState.plansError = true;
		} else {
			pickerState.subscriptionError = true;
		}

		renderPicker();

		expect(
			screen.getByRole("heading", { name: "Plans could not load" }),
		).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Starter" })).toBeNull();
	});
});
