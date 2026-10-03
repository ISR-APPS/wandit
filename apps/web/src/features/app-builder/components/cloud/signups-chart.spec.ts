// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { CloudSignupsResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { SignupsChart } from "./signups-chart";

/** Three UTC days: the busiest day, a day with half its count, and an empty day. */
const DAYS: CloudSignupsResponse["days"] = [
	{ date: "2026-10-01", count: 4 },
	{ date: "2026-10-02", count: 2 },
	{ date: "2026-10-03", count: 0 },
];

function renderChart(days: CloudSignupsResponse["days"]) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(SignupsChart, { days }),
	};
	render(createElement(I18nProvider, providerProps));
}

function barHeights(): (string | null)[] {
	return screen
		.getAllByTestId("signup-bar")
		.map((bar) => bar.getAttribute("height"));
}

// West of UTC, midnight UTC of "2026-10-01" is still September 30. Without
// the UTC time zone in the format, the labels then show the day before.
const originalTimeZone = process.env.TZ;
beforeAll(() => {
	process.env.TZ = "America/Los_Angeles";
});
afterAll(() => {
	if (originalTimeZone === undefined) {
		delete process.env.TZ;
	} else {
		process.env.TZ = originalTimeZone;
	}
});

afterEach(cleanup);

describe("SignupsChart", () => {
	it("scales each bar to the busiest day", () => {
		renderChart(DAYS);

		expect(barHeights()).toEqual(["100", "50", "2"]);
		// A bar grows up from the baseline, so its top is the chart height minus its height.
		expect(screen.getAllByTestId("signup-bar")[1]?.getAttribute("y")).toBe(
			"50",
		);
	});

	it("keeps a muted stub for a day without sign-ups", () => {
		renderChart(DAYS);

		const emptyDayBar = screen.getAllByTestId("signup-bar")[2];
		expect(emptyDayBar?.getAttribute("height")).toBe("2");
		expect(emptyDayBar?.classList.contains("fill-muted-foreground/30")).toBe(
			true,
		);
		expect(
			screen
				.getAllByTestId("signup-bar")[0]
				?.classList.contains("fill-muted-foreground/30"),
		).toBe(false);
	});

	it("labels the first and the last day with their UTC dates", () => {
		renderChart(DAYS);

		const labels = Array.from(
			document.querySelectorAll("figcaption span"),
			(label) => label.textContent,
		);
		expect(labels).toEqual(["Oct 1, 2026", "Oct 3, 2026"]);
	});

	it("renders an empty chart with no caption when no day comes back", () => {
		renderChart([]);

		expect(
			screen.getByRole("img", {
				name: "Bar chart of the sign-ups per day in the last 30 days",
			}),
		).toBeTruthy();
		expect(screen.queryAllByTestId("signup-bar")).toHaveLength(0);
		expect(document.querySelector("figcaption")).toBeNull();
	});
});
