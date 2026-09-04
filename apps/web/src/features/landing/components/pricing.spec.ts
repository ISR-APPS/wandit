// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Pricing } from "./pricing";

const state = vi.hoisted(() => ({
	openPlanPicker: vi.fn(),
	settings: {
		data: {
			manualPaymentsEnabled: false,
			organizationsEnabled: true,
			paidSubscriptionsEnabled: true,
			signupGrantCredits: 7,
			signupGrantEnabled: true,
		},
		isSuccess: true,
	},
}));

const dictionary = vi.hoisted(() => ({
	landing: {
		pricing: {
			beta: { badge: "Beta", cta: "Join the beta" },
			business: {
				cta: "Create a team workspace",
				features: ["Everything in Pro"],
				fromPrice: "From {price}",
				name: "Business",
				perMonth: "/ month",
				tagline: "For teams",
			},
			free: {
				creditsFallback: "Signup credits when available",
				cta: "Start free",
				features: ["Publishing always free"],
				name: "Free",
				price: "Free",
				tagline: "For first projects",
			},
			kicker: "Pricing",
			note: "Publishing is always free.",
			pro: {
				badge: "Popular",
				catalogUnavailable: "Pricing unavailable",
				creditsUnit: "credits",
				cta: "Choose Pro",
				features: ["Nine credit tiers"],
				intervalLabel: "Billing interval",
				loading: "Loading prices",
				monthly: "Monthly",
				name: "Pro",
				perMonth: "/ month",
				perYear: "/ year",
				savings: "Save {percent}%",
				tagline: "For growing sellers",
				tierLabel: "Monthly credit allowance",
				twoMonthsFree: "2 months free",
				yearly: "Yearly",
			},
			starter: {
				creditsLine: "50 credits every month",
				cta: "Choose Starter",
				features: [
					"AI product images and marketing copy",
					"Custom domains",
					"Publishing always free",
				],
				name: "Starter",
				perMonth: "/ month",
				perYear: "/ year",
				tagline: "For your first store and first campaigns",
			},
			title: "Start small. Grow when you need more.",
		},
	},
}));

const plans = vi.hoisted(() => [
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
]);

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("@wandit/internationalization/react", () => ({
	useDictionary: () => dictionary,
	useTranslation: () => ({
		locale: "en",
		t: (key: string, params?: { count?: number; countDisplay?: string }) =>
			key === "landing.pricing.free.creditsLine"
				? `${params?.countDisplay ?? params?.count} free credits`
				: key,
	}),
}));

vi.mock("@/features/auth", () => ({
	useAuthModal: () => ({ open: vi.fn() }),
	useSession: () => ({ data: null }),
}));

vi.mock("@/features/billing/api/billing.queries", () => ({
	useBillingPlansQuery: () => ({
		data: { plans },
		isError: false,
		isSuccess: true,
	}),
}));

vi.mock("@/features/billing/components/billing-modal-provider", () => ({
	useBillingModal: () => ({ openPlanPicker: state.openPlanPicker }),
}));

vi.mock("@/features/settings/api/settings.queries", () => ({
	usePublicSettingsQuery: () => state.settings,
}));

vi.mock("@/features/workspaces/components/create-workspace-dialog", () => ({
	CreateWorkspaceDialog: () => null,
}));

vi.mock("./reveal", async () => {
	const { createElement } = await import("react");

	return {
		Reveal: ({
			children,
			className,
		}: {
			children: ReactNode;
			className?: string;
		}) => createElement("div", { className }, children),
	};
});

describe("landing pricing", () => {
	beforeEach(() => {
		state.openPlanPicker.mockReset();
		state.settings.data.manualPaymentsEnabled = false;
		state.settings.data.organizationsEnabled = true;
		state.settings.data.paidSubscriptionsEnabled = true;
		state.settings.data.signupGrantCredits = 7;
		state.settings.data.signupGrantEnabled = true;
	});

	afterEach(cleanup);

	it("shows all four cards and the live signup grant", () => {
		render(createElement(Pricing));

		for (const plan of ["Free", "Starter", "Pro", "Business"]) {
			expect(screen.getByRole("heading", { name: plan })).toBeTruthy();
		}
		expect(screen.getByText("7 free credits")).toBeTruthy();
		expect(screen.getByText("50 credits every month")).toBeTruthy();
		expect(screen.getByText("AI product images and marketing copy")).toBeTruthy();
		expect(screen.getByText("Custom domains")).toBeTruthy();
		expect(screen.getByText("$9")).toBeTruthy();
	});

	it("formats a fractional signup grant without rounding it", () => {
		state.settings.data.signupGrantCredits = 0.5;

		render(createElement(Pricing));

		expect(screen.getByText("0.5 free credits")).toBeTruthy();
	});

	it("shows the fallback copy when the signup grant is zero", () => {
		state.settings.data.signupGrantCredits = 0;

		render(createElement(Pricing));

		expect(screen.getByText("Signup credits when available")).toBeTruthy();
		expect(screen.queryByText("0 free credits")).toBeNull();
	});

	it("shows the fallback copy when signup grants are disabled", () => {
		state.settings.data.signupGrantEnabled = false;

		render(createElement(Pricing));

		expect(screen.getByText("Signup credits when available")).toBeTruthy();
		expect(screen.queryByText("7 free credits")).toBeNull();
	});

	it("keeps the Business showcase visible when team creation is disabled", () => {
		state.settings.data.organizationsEnabled = false;

		render(createElement(Pricing));

		expect(screen.getByRole("heading", { name: "Business" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Create a team workspace" }),
		).toBeNull();
	});

	it("opens the plan picker with the Starter plan and tier selected", () => {
		render(createElement(Pricing));

		fireEvent.click(screen.getByRole("button", { name: "Choose Starter" }));

		expect(state.openPlanPicker).toHaveBeenCalledWith("marketing_pricing", {
			interval: "month",
			plan: "starter",
			tierCredits: 50,
		});
	});

	it("shows the annual Starter price when yearly billing is selected", () => {
		render(createElement(Pricing));

		expect(screen.getByText("$9")).toBeTruthy();
		fireEvent.click(screen.getByRole("radio", { name: /Yearly/ }));

		expect(screen.getByText("$90")).toBeTruthy();
	});
});
