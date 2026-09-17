// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard, type ApprovalCardProps } from "./approval-card";

function renderCard(props: Partial<ApprovalCardProps> = {}) {
	const onDecide = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(ApprovalCard, {
			toolName: "Bash",
			input: '{"command":"pnpm db:push"}',
			decision: null,
			isOpen: true,
			onDecide,
			...props,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return { onDecide };
}

afterEach(cleanup);

describe("ApprovalCard", () => {
	it("shows the title and the input, and sends the decision from each button", () => {
		const { onDecide } = renderCard();
		expect(screen.getByText("Wandit asks permission to run Bash")).toBeTruthy();
		expect(screen.getByText('{"command":"pnpm db:push"}')).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(onDecide).toHaveBeenCalledWith(true);
		fireEvent.click(screen.getByRole("button", { name: "Deny" }));
		expect(onDecide).toHaveBeenCalledWith(false);
	});

	it("shows the denied line and no button once denied", () => {
		renderCard({ isOpen: false, decision: "denied" });
		expect(screen.getByText("Denied")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("shows the answered line when the decision is unknown after a reload", () => {
		renderCard({ isOpen: false, decision: null });
		expect(screen.getByText("Answered")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
