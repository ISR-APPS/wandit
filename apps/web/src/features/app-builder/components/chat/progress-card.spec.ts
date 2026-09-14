// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { BuilderProgressStep } from "../../api/dto";
import { ProgressCard, type ProgressCardProps } from "./progress-card";

const STEPS: BuilderProgressStep[] = [
	{ id: "s1", label: "Pass screen · name, plan, expiry", state: "done" },
	{ id: "s2", label: "Signed QR token · rotates daily", state: "done" },
	{ id: "s3", label: "Door scanner in the admin app", state: "active" },
	{ id: "s4", label: "Push reminder before expiry", state: "pending" },
];

function renderCard(props: Partial<ProgressCardProps> = {}) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(ProgressCard, {
			title: "Building QR pass",
			percent: 64,
			steps: STEPS,
			...props,
		}),
	};
	return render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("ProgressCard", () => {
	it("renders the title, the percent, the bar, and every step", () => {
		const { container } = renderCard();
		expect(screen.getByText("Building QR pass")).toBeTruthy();
		expect(screen.getByText("64%")).toBeTruthy();
		// The kit's Progress moves the indicator by the missing percent.
		const indicator = container.querySelector<HTMLElement>(
			'[data-slot="progress-indicator"]',
		);
		expect(indicator?.style.transform).toBe("translateX(-36%)");
		expect(container.querySelectorAll("li")).toHaveLength(4);
		expect(container.querySelectorAll('[data-step-state="done"]')).toHaveLength(
			2,
		);
		expect(
			container.querySelectorAll('[data-step-state="active"] .animate-caret'),
		).toHaveLength(1);
		expect(
			container.querySelector('[data-step-state="active"] svg'),
		).toBeNull();
		expect(
			container.querySelector('[data-step-state="pending"] svg'),
		).not.toBeNull();
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("stops the spinner at 100 percent", () => {
		const { container } = renderCard({ percent: 100 });
		expect(screen.getByText("100%")).toBeTruthy();
		expect(container.querySelector(".animate-spin")).toBeNull();
	});
});
