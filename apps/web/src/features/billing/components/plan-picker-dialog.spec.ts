// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import {
	BILLING_CATALOG,
	type BillingPlanCatalogItem,
	priceLookupKey,
	purchasableTiersFor,
	type Subscription,
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
	subscription: null as Subscription | null,
}));

const pickerMutations = vi.hoisted(() => ({
	apply: vi.fn(),
	checkout: vi.fn(),
	preview: vi.fn(),
}));

const pickerCatalog = vi.hoisted(() => ({
	plans: [
		{
			basePer100Usd: 15,
			features: { seats: false, teamWorkspace: false },
			id: "starter",
			tiers: [
				{
					annualLookupKey: "starter_60_year",
					annualUsd: 90,
					monthlyLookupKey: "starter_60_month",
					monthlyUsd: 9,
					tierCredits: 60,
				},
			],
		},
		{
			basePer100Usd: 10,
			features: { seats: false, teamWorkspace: false },
			id: "pro",
			tiers: [
				{
					annualLookupKey: "pro_250_year",
					annualUsd: 250,
					monthlyLookupKey: "pro_250_month",
					monthlyUsd: 25,
					tierCredits: 250,
				},
			],
		},
		{
			basePer100Usd: 20,
			features: { seats: true, teamWorkspace: true },
			id: "business",
			tiers: [
				{
					annualLookupKey: "business_250_year",
					annualUsd: 500,
					monthlyLookupKey: "business_250_month",
					monthlyUsd: 50,
					tierCredits: 250,
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
			changeTitle: "Change your plan",
			changeDescription: "Preview your change",
			changeAppliedTitle: "Plan change confirmed",
			changesAtRenewal: "Changes at renewal",
			confirmChange: "Confirm change",
			close: "Close",
			continueToCheckout: "Continue",
			creditTier: "Credits",
			currentPlan: "Current subscriber",
			currentSelection: "Current plan",
			downgradeExplanation: "The lower plan begins at renewal.",
			downgradeAppliedBody: "Your lower plan is scheduled for renewal.",
			keepCurrentPlanExplanation:
				"Remove the scheduled change without a charge.",
			keepCurrentPlanAppliedBody: "Your current plan will renew normally.",
			previewChange: "Preview change",
			previewTitle: "Review plan change",
			previewDescription: "Review the charge before confirming.",
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
			: {
					balance: { settledBalance: 0 },
					subscription: pickerState.subscription,
				},
		isError: pickerState.subscriptionError,
		isPending: false,
	}),
}));

vi.mock("@/features/billing/api/billing.mutations", () => {
	const mutation = () => ({ isPending: false, mutateAsync: vi.fn() });

	return {
		useChangeBillingSubscription: () => ({
			isPending: false,
			mutateAsync: pickerMutations.apply,
		}),
		useCreateBillingCheckout: () => ({
			isPending: false,
			mutateAsync: pickerMutations.checkout,
		}),
		useCreateBillingPortal: mutation,
		useCreateBillingTopupCheckout: mutation,
		usePreviewBillingSubscriptionChange: () => ({
			isPending: false,
			mutateAsync: pickerMutations.preview,
		}),
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
		t: (key: string, values?: { count?: number }) =>
			key === "credits.creditUnit" ? `${values?.count} credits` : key,
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
		).toBe(60);
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, null)?.tierCredits,
		).toBe(250);
	});

	it("keeps a selected plan and purchasable tier paired", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), { pro: 1000 }, null)?.tierCredits,
		).toBe(1000);
		expect(
			resolveSelectedTier(catalogPlan("starter"), { pro: 1000 }, null)
				?.tierCredits,
		).toBe(60);
	});

	it("does not surface an invalid or legacy initial tier", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), { pro: 175 }, null)?.tierCredits,
		).toBe(250);
	});

	it("keeps an independent selected tier for every plan card", () => {
		const selections = { pro: 1000, starter: 60 } as const;

		expect(
			resolveSelectedTier(catalogPlan("pro"), selections, null)?.tierCredits,
		).toBe(1000);
		expect(
			resolveSelectedTier(catalogPlan("starter"), selections, null)
				?.tierCredits,
		).toBe(60);
	});

	it("falls back from a legacy subscriber tier to the first active target", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, {
				plan: "pro",
				tierCredits: 175,
			})?.tierCredits,
		).toBe(250);
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, {
				plan: "pro",
				tierCredits: 8750,
			})?.tierCredits,
		).toBe(250);
	});

	it("keeps an active subscriber tier selected for its current plan", () => {
		expect(
			resolveSelectedTier(catalogPlan("pro"), null, {
				plan: "pro",
				tierCredits: 1000,
			})?.tierCredits,
		).toBe(1000);
	});
});

describe("plan picker query resilience", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pickerState.manualPaymentsEnabled = false;
		pickerState.organizationsEnabled = true;
		pickerState.paidSubscriptionsEnabled = true;
		pickerState.plansError = false;
		pickerState.settingsDataOnError = false;
		pickerState.settingsError = false;
		pickerState.subscriptionError = false;
		pickerState.subscription = null;
		pickerMutations.preview.mockResolvedValue({
			amountDueMinor: 0,
			creditsDelta: 0,
			currency: "usd",
			expiresAt: "2026-09-04T13:00:00.000Z",
			intentId: "f9d95c15-c50a-4157-896d-e79b868c0699",
		});
	});

	afterEach(cleanup);

	function renderPicker(initialInterval?: "month" | "year") {
		return render(
			createElement(PlanPickerDialog, {
				initialInterval,
				onOpenChange: vi.fn(),
				open: true,
				surface: "marketing_pricing",
			}),
		);
	}

	function subscribeToPro(pending = false) {
		pickerState.subscription = {
			cancelAtPeriodEnd: false,
			createdAt: "2026-09-01T00:00:00.000Z",
			currentPeriodEnd: "2026-10-01T00:00:00.000Z",
			currentPeriodStart: "2026-09-01T00:00:00.000Z",
			entitled: true,
			id: "2d8aa13f-512f-41cd-be6d-bd76310cae02",
			interval: "month",
			organizationId: null,
			pendingInterval: pending ? "year" : null,
			pendingPlan: pending ? "starter" : null,
			pendingTierCredits: pending ? 60 : null,
			plan: "pro",
			priceLookupKey: "pro_250_month",
			provider: "stripe",
			providerSubscriptionId: "sub_pro",
			status: "active",
			tierCredits: 250,
			updatedAt: "2026-09-01T00:00:00.000Z",
			userId: "user-1",
		};
	}

	it.each([
		"month",
		"year",
	] as const)("changes existing Pro to Starter %s at renewal without checkout", async (interval) => {
		subscribeToPro();
		pickerMutations.apply.mockImplementation(async () => {
			pickerState.subscription = {
				...(pickerState.subscription as Subscription),
				pendingInterval: interval,
				pendingPlan: "starter",
				pendingTierCredits: 60,
			};
			return {
				outcome: "applied",
				subscription: pickerState.subscription,
				balance: { settledBalance: 250 },
			};
		});
		renderPicker(interval);
		const starter = screen
			.getByRole("heading", { name: "Starter" })
			.closest("article");
		expect(starter).not.toBeNull();
		fireEvent.click(
			within(starter as HTMLElement).getByRole("button", {
				name: "Preview change",
			}),
		);

		await screen.findByRole("heading", { name: "Review plan change" });
		expect(pickerMutations.preview).toHaveBeenCalledWith({
			interval,
			plan: "starter",
			tierCredits: 60,
		});
		expect(pickerMutations.checkout).not.toHaveBeenCalled();
		expect(screen.getByText("The lower plan begins at renewal.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
		expect(
			await screen.findByText("Your lower plan is scheduled for renewal."),
		).toBeTruthy();
		expect(pickerState.subscription?.plan).toBe("pro");
	});

	it("shows scheduled Starter separately from current Pro and lets the user keep Pro", async () => {
		subscribeToPro(true);
		pickerMutations.apply.mockImplementation(async () => {
			pickerState.subscription = {
				...(pickerState.subscription as Subscription),
				pendingPlan: null,
				pendingTierCredits: null,
				pendingInterval: null,
			};
			return {
				outcome: "applied",
				subscription: pickerState.subscription,
				balance: { settledBalance: 250 },
			};
		});
		renderPicker();
		expect(
			screen.getByText("Current subscriber: Pro · 250 credits"),
		).toBeTruthy();
		expect(
			screen.getByText("Changes at renewal: Starter · 60 credits · Yearly"),
		).toBeTruthy();
		const pro = screen.getByRole("heading", { name: "Pro" }).closest("article");
		expect(pro).not.toBeNull();
		fireEvent.click(
			within(pro as HTMLElement).getByRole("button", {
				name: "Preview change",
			}),
		);

		await screen.findByText("Remove the scheduled change without a charge.");
		expect(pickerMutations.preview).toHaveBeenCalledWith({
			interval: "month",
			plan: "pro",
			tierCredits: 250,
		});
		fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
		await waitFor(() =>
			expect(pickerMutations.apply).toHaveBeenCalledWith({
				intentId: "f9d95c15-c50a-4157-896d-e79b868c0699",
			}),
		);
		expect(
			await screen.findByText("Your current plan will renew normally."),
		).toBeTruthy();
	});

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
