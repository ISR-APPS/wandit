// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard, type ApprovalCardProps } from "./approval-card";

const NETWORK_INPUT =
	'{"host":"api.github.com","reason":"Load the repositories of the user."}';

function renderCard(props: Partial<ApprovalCardProps> = {}) {
	const onDecide = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(ApprovalCard, {
			toolName: "request_network_host",
			input: NETWORK_INPUT,
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
	it("names the host and the reason, and sends the decision from each button", () => {
		const { onDecide } = renderCard();
		expect(
			screen.getByText("Allow the app to reach api.github.com?"),
		).toBeTruthy();
		expect(screen.getByText("Load the repositories of the user.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Approve" }));
		expect(onDecide).toHaveBeenCalledWith(true);
		fireEvent.click(screen.getByRole("button", { name: "Deny" }));
		expect(onDecide).toHaveBeenCalledWith(false);
	});

	it("keeps the raw input behind Details", () => {
		renderCard();
		expect(screen.queryByText(NETWORK_INPUT)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Details" }));
		expect(screen.getByText(NETWORK_INPUT)).toBeTruthy();
	});

	it("gives a database write its own title", () => {
		renderCard({
			toolName: "run_sql_write",
			input: '{"query":"delete from notes"}',
		});
		expect(screen.getByText("Change data in your database?")).toBeTruthy();
	});

	it("falls back to the generic title for broken JSON text", () => {
		renderCard({ input: "{not json" });
		expect(screen.getByText("Allow Wandit to run this action?")).toBeTruthy();
	});

	it("shows the denied line and no decision button once denied", () => {
		renderCard({ isOpen: false, decision: "denied" });
		expect(screen.getByText("Denied")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
	});

	it("shows the answered line when the decision is unknown after a reload", () => {
		renderCard({ isOpen: false, decision: null });
		expect(screen.getByText("Answered")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Deny" })).toBeNull();
	});
});
