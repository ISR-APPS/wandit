// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary } from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StarterCancelOffer } from "../lib/billing-ui-policy";
import { CancelSubscriptionDialog } from "./cancel-subscription-dialog";

function renderDialog(starterOffer: StarterCancelOffer | null) {
	const onConfirm = vi.fn();
	const onAcceptStarterOffer = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(CancelSubscriptionDialog, {
			pending: false,
			onConfirm,
			onAcceptStarterOffer,
			starterOffer,
			periodEnd: "2026-10-01T12:00:00.000Z",
			locale: "en",
		}),
	};
	render(createElement(I18nProvider, providerProps));
	fireEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
	return { onConfirm, onAcceptStarterOffer };
}

afterEach(cleanup);

describe("cancel subscription dialog", () => {
	it.each([
		{ interval: "month", priceUsd: 9, price: "$9", period: "/ month" },
		{ interval: "year", priceUsd: 90, price: "$90", period: "/ year" },
	] as const)("offers Starter at the $interval price without canceling", ({
		interval,
		priceUsd,
		price,
		period,
	}) => {
		const { onAcceptStarterOffer, onConfirm } = renderDialog({
			interval,
			plan: "starter",
			priceUsd,
			tierCredits: 60,
		});
		expect(
			screen.getByRole("region", { name: "Try Starter instead" }),
		).toBeTruthy();
		expect(screen.getByText("Starter")).toBeTruthy();
		expect(screen.getByText(price)).toBeTruthy();
		expect(screen.getByText(period)).toBeTruthy();
		expect(screen.getByText("60 credits every month")).toBeTruthy();
		expect(
			screen.getByText(
				"Your current plan stays active until Oct 1, 2026. Starter starts at renewal. Cancel anytime.",
			),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("radio", { name: "Other" }));
		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "A prior reason" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Switch to Starter instead" }),
		);
		expect(onAcceptStarterOffer).toHaveBeenCalledOnce();
		expect(onConfirm).not.toHaveBeenCalled();
		expect(screen.queryByRole("alertdialog")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Cancel plan" }));
		expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("");
		expect(
			screen
				.getByRole("button", { name: "Cancel at period end" })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("keeps the parsed cancellation flow when no offer is available", () => {
		const { onConfirm, onAcceptStarterOffer } = renderDialog(null);
		expect(
			screen.queryByRole("region", { name: "Try Starter instead" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Switch to Starter instead" }),
		).toBeNull();
		expect(screen.queryByText("Or tell us why you are leaving")).toBeNull();
		fireEvent.click(screen.getByRole("radio", { name: "Other" }));
		expect(
			screen
				.getByRole("button", { name: "Cancel at period end" })
				.hasAttribute("disabled"),
		).toBe(true);
		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "  I need a break.  " },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Cancel at period end" }),
		);
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onConfirm).toHaveBeenCalledWith({
			reason: "other",
			details: "I need a break.",
		});
		expect(onAcceptStarterOffer).not.toHaveBeenCalled();
	});
});
