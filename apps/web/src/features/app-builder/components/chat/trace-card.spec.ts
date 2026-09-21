// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { BuilderTraceStep } from "../../api/dto";
import { TraceCard } from "./trace-card";

const STEPS: BuilderTraceStep[] = [
	{ label: "Read the project brief", detail: null },
	{ label: "Planned the data model", detail: "5 tables" },
	{ label: "Chose phone OTP sign-in", detail: null },
	{ label: "Connected Chargily Pay", detail: "CIB, Edahabia" },
];

function renderTrace() {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(TraceCard, { seconds: 6, steps: STEPS }),
	};
	return render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("TraceCard", () => {
	it("renders the label and every step with its detail, open by default", () => {
		const { container } = renderTrace();
		const toggle = screen.getByRole("button", { name: "Thought for 6s" });
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(container.querySelectorAll("li")).toHaveLength(4);
		expect(screen.getByText("Read the project brief")).toBeTruthy();
		expect(screen.getByText("5 tables")).toBeTruthy();
		expect(screen.getByText("CIB, Edahabia")).toBeTruthy();
		// Only the two steps with a detail get the small muted span.
		expect(container.querySelectorAll("li .text-xs")).toHaveLength(2);
	});

	it("hides the steps on a click and shows them again on a second click", () => {
		const { container } = renderTrace();
		const toggle = screen.getByRole("button", { name: "Thought for 6s" });
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(container.querySelector("ul")).toBeNull();
		expect(screen.queryByText("Planned the data model")).toBeNull();
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(container.querySelectorAll("li")).toHaveLength(4);
	});
});
