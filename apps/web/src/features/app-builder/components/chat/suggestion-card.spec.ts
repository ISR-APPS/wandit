// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuggestionCard, type SuggestionCardProps } from "./suggestion-card";

function renderCard(props: Partial<SuggestionCardProps> = {}) {
	const onAccept = vi.fn();
	const onAlternatives = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(SuggestionCard, {
			title: "Want me to add a push reminder before expiry?",
			body: "Send a push 3 days before the plan ends, with a Renew now button that opens the payment screen.",
			confidence: "high",
			onAccept,
			onAlternatives,
			...props,
		}),
	};
	const { container } = render(createElement(I18nProvider, providerProps));
	return { container, onAccept, onAlternatives };
}

afterEach(cleanup);

describe("SuggestionCard", () => {
	it("renders the title, the body, and three filled bars for high confidence", () => {
		const { container } = renderCard();
		expect(
			screen.getByText("Want me to add a push reminder before expiry?"),
		).toBeTruthy();
		expect(
			screen.getByText(
				"Send a push 3 days before the plan ends, with a Renew now button that opens the payment screen.",
			),
		).toBeTruthy();
		expect(screen.getByText("High confidence")).toBeTruthy();
		expect(container.querySelectorAll("[data-filled]")).toHaveLength(3);
		expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(3);
	});

	it("fills one bar for low confidence", () => {
		const { container } = renderCard({ confidence: "low" });
		expect(screen.getByText("Low confidence")).toBeTruthy();
		expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(1);
		expect(container.querySelectorAll('[data-filled="false"]')).toHaveLength(2);
	});

	it("calls onAccept on Accept and onAlternatives on Alternatives", () => {
		const { onAccept, onAlternatives } = renderCard();
		fireEvent.click(screen.getByRole("button", { name: "Accept" }));
		expect(onAccept).toHaveBeenCalledOnce();
		expect(onAlternatives).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Alternatives" }));
		expect(onAlternatives).toHaveBeenCalledOnce();
		expect(onAccept).toHaveBeenCalledOnce();
	});
});
