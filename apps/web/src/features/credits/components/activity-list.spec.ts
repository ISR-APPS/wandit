// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { CreditActivityItem } from "@wandit/contracts";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityList } from "./activity-list";

vi.mock("@/lib/i18n", () => {
	const messages: Record<string, string> = {
		"credits.activityLoadError": "Credit activity could not load.",
		"credits.activityOperations.chat": "AI message",
		"credits.activityOperations.image": "Image",
		"credits.activityStatus.inProgress": "In progress",
		"credits.activityStatus.refunded": "Refunded",
		"credits.emptyActivity": "No activity yet.",
		"credits.ledgerKinds.grant": "Credits granted",
	};
	return {
		useTranslation: () => ({
			locale: "en",
			t: (key: string) => messages[key] ?? key,
		}),
	};
});

vi.mock("@/lib/relative-time", () => ({
	relativeTime: () => "just now",
}));

function item(overrides: Partial<CreditActivityItem>): CreditActivityItem {
	return {
		id: "6f1c2a4e-1b2c-4d3e-8f90-a1b2c3d4e5f6",
		kind: "usage",
		operation: "chat",
		status: "settled",
		credits: -0.39,
		ledgerKind: null,
		bucket: null,
		reason: null,
		createdAt: "2026-08-22T10:00:00.000Z",
		finalizedAt: "2026-08-22T10:00:05.000Z",
		...overrides,
	};
}

afterEach(() => {
	cleanup();
});

describe("ActivityList", () => {
	it("renders an in-progress row with its label and no amount", () => {
		render(
			createElement(ActivityList, {
				items: [item({ status: "in_progress", credits: null })],
			}),
		);

		expect(screen.getByText("AI message")).toBeTruthy();
		expect(screen.getByText("In progress")).toBeTruthy();
		expect(screen.queryByText(/0\.39/)).toBeNull();
	});

	it("renders a settled usage spend as one signed net amount", () => {
		render(createElement(ActivityList, { items: [item({})] }));

		expect(screen.getByText("AI message")).toBeTruthy();
		expect(screen.getByText("-0.39")).toBeTruthy();
	});

	it("renders a ledger grant with a plus sign and two decimals", () => {
		render(
			createElement(ActivityList, {
				items: [
					item({
						id: "7a2d3b5f-2c3d-4e4f-9a01-b2c3d4e5f6a7",
						kind: "ledger",
						operation: null,
						credits: 50,
						ledgerKind: "grant",
						bucket: "promo",
					}),
				],
			}),
		);

		expect(screen.getByText("Credits granted")).toBeTruthy();
		expect(screen.getByText("+50.00")).toBeTruthy();
		expect(screen.queryByText(/promo/i)).toBeNull();
	});

	it("marks a refunded row in the sublabel", () => {
		render(
			createElement(ActivityList, {
				items: [item({ operation: "image", status: "refunded", credits: 0 })],
			}),
		);

		expect(screen.getByText("Image")).toBeTruthy();
		expect(screen.getByText(/Refunded/)).toBeTruthy();
	});

	it("shows the empty and error states", () => {
		const { unmount } = render(createElement(ActivityList, { items: [] }));
		expect(screen.getByText("No activity yet.")).toBeTruthy();
		unmount();

		render(createElement(ActivityList, { items: [], isError: true }));
		expect(screen.getByRole("alert").textContent).toBe(
			"Credit activity could not load.",
		);
	});
});
