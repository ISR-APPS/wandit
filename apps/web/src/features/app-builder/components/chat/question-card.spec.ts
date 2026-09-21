// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuestionCard, type QuestionCardProps } from "./question-card";

const OPTIONS = [
	"Card in the app · CIB and Edahabia through Chargily Pay",
	"Cash at the front desk",
	"Both",
];

function renderCard(props: Partial<QuestionCardProps> = {}) {
	const onAnswer = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(QuestionCard, {
			question: "How do members pay for the monthly plan?",
			options: OPTIONS,
			answer: null,
			onAnswer,
			...props,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return { onAnswer };
}

afterEach(cleanup);

describe("QuestionCard", () => {
	it("renders the question and the options with Continue disabled", () => {
		renderCard();
		expect(
			screen.getByText("How do members pay for the monthly plan?"),
		).toBeTruthy();
		expect(screen.getAllByRole("radio")).toHaveLength(3);
		expect(
			screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled"),
		).toBe(true);
	});

	it("enables Continue after a pick and answers with that option", () => {
		const { onAnswer } = renderCard();
		fireEvent.click(
			screen.getByRole("radio", { name: "Cash at the front desk" }),
		);
		const button = screen.getByRole("button", { name: "Continue" });
		expect(button.hasAttribute("disabled")).toBe(false);
		fireEvent.click(button);
		expect(onAnswer).toHaveBeenCalledWith("Cash at the front desk");
	});

	it("lets the trimmed typed text win over a picked option", () => {
		const { onAnswer } = renderCard();
		fireEvent.click(screen.getByRole("radio", { name: "Both" }));
		fireEvent.change(screen.getByRole("textbox", { name: "Something else…" }), {
			target: { value: "  Cash only  " },
		});
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(onAnswer).toHaveBeenCalledWith("Cash only");
	});

	it("shows only the answer once the question is closed", () => {
		renderCard({ answer: "Both" });
		expect(screen.getByText("Both")).toBeTruthy();
		expect(screen.queryAllByRole("radio")).toHaveLength(0);
		expect(screen.queryByRole("textbox")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
