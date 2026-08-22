import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsFunnelStepUsersResponse } from "@/features/analytics/api/analytics.dto";
import { FunnelStepUsersSheetBody } from "@/features/analytics/components/funnel-step-users-sheet";

vi.mock("@tanstack/react-router", async () => {
	const { createElement: createReactElement } = await import("react");

	return {
		Link: ({
			children,
			className,
			params,
		}: {
			children: ReactNode;
			className?: string;
			params: { userId: string };
		}) =>
			createReactElement(
				"a",
				{ href: `/users/${params.userId}`, className },
				children,
			),
	};
});

function renderSheetBody(element: ReactElement) {
	return renderToStaticMarkup(element);
}

const response: AnalyticsFunnelStepUsersResponse = {
	updatedAt: "2026-08-15T12:00:00.000Z",
	step: "checkoutStarted",
	page: 1,
	pageSize: 10,
	total: 2,
	counts: {
		all: 2,
		contacted: 1,
		converted: 1,
	},
	items: [
		{
			id: "user-1",
			name: "Nadia Founder",
			email: "nadia@example.com",
			image: null,
			signedUpAt: "2026-08-01T08:00:00.000Z",
			firstEventAt: "2026-08-02T09:00:00.000Z",
			lastEventAt: "2026-08-03T10:00:00.000Z",
			eventCount: 2,
			converted: true,
			contact: {
				contactedAt: "2026-08-15T11:00:00.000Z",
				contactedBy: { id: "admin-1", name: "Admin User" },
			},
		},
		{
			id: "user-2",
			name: "Samir Builder",
			email: "samir@example.com",
			image: "https://example.com/samir.png",
			signedUpAt: "2026-08-04T08:00:00.000Z",
			firstEventAt: "2026-08-05T09:00:00.000Z",
			lastEventAt: "2026-08-06T10:00:00.000Z",
			eventCount: 1,
			converted: false,
			contact: null,
		},
	],
};

describe("funnel step users sheet body", () => {
	it("renders the server page without filtering its items on the client", () => {
		const html = renderSheetBody(
			createElement(FunnelStepUsersSheetBody, {
				data: response,
				filter: "contacted",
				pendingUserId: null,
				onFilterChange: vi.fn(),
				onPageChange: vi.fn(),
				onContactChange: vi.fn(),
			}),
		);

		expect(html).toContain("Nadia Founder");
		expect(html).toContain("nadia@example.com");
		expect(html).toContain("Samir Builder");
		expect(html).toContain("samir@example.com");
		expect(html).toContain('href="/users/user-1"');
		expect(html).toContain("by Admin User");
		expect(html).toContain(">Paid<");
		expect(html).toContain("Not yet");
		expect(html).toContain(">All<");
		expect(html).toContain("Not contacted");
		expect(html).toContain("Contacted");
		expect(html).toContain("2 events");
		expect(html).toContain("1 event");
		expect(html).not.toContain("1 events");
	});

	it("uses unfiltered counts for chips and tabs and filtered total for pagination", () => {
		const html = renderSheetBody(
			createElement(FunnelStepUsersSheetBody, {
				data: {
					...response,
					total: 12,
					counts: {
						all: 20,
						contacted: 12,
						converted: 9,
					},
				},
				filter: "contacted",
				pendingUserId: null,
				onFilterChange: vi.fn(),
				onPageChange: vi.fn(),
				onContactChange: vi.fn(),
			}),
		);

		expect(html).toContain(">20<");
		expect(html).toContain(">12<");
		expect(html).toContain(">8<");
		expect(html).toContain(">9<");
		expect(html).toContain("1–10 of 12");
		expect(html).toContain("Page 1 of 2");
		expect(html).not.toContain("Showing the first");
		expect(paginationButton(html, "Previous page")).toContain('disabled=""');
		expect(paginationButton(html, "Next page")).not.toContain('disabled=""');
	});

	it("keeps one-page pagination visible with both controls disabled", () => {
		const html = renderSheetBody(
			createElement(FunnelStepUsersSheetBody, {
				data: response,
				filter: "all",
				pendingUserId: null,
				onFilterChange: vi.fn(),
				onPageChange: vi.fn(),
				onContactChange: vi.fn(),
			}),
		);

		expect(html).toContain("1–2 of 2");
		expect(html).toContain("Page 1 of 1");
		expect(paginationButton(html, "Previous page")).toContain('disabled=""');
		expect(paginationButton(html, "Next page")).toContain('disabled=""');
	});

	it("disables only the pending user's contacted switch", () => {
		const html = renderSheetBody(
			createElement(FunnelStepUsersSheetBody, {
				data: response,
				filter: "all",
				pendingUserId: "user-1",
				onFilterChange: vi.fn(),
				onPageChange: vi.fn(),
				onContactChange: vi.fn(),
			}),
		);
		const switches = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
		const pendingSwitch = switches.find((button) =>
			button.includes("Nadia Founder"),
		);
		const availableSwitch = switches.find((button) =>
			button.includes("Samir Builder"),
		);

		expect(switches).toHaveLength(2);
		expect(pendingSwitch).toContain('disabled=""');
		expect(availableSwitch).not.toContain('disabled=""');
	});

	it("renders the all-users empty state", () => {
		const html = renderSheetBody(
			createElement(FunnelStepUsersSheetBody, {
				data: {
					...response,
					total: 0,
					counts: {
						all: 0,
						contacted: 0,
						converted: 0,
					},
					items: [],
				},
				filter: "all",
				pendingUserId: null,
				onFilterChange: vi.fn(),
				onPageChange: vi.fn(),
				onContactChange: vi.fn(),
			}),
		);

		expect(html).toContain("No users in this funnel step");
		expect(html).toContain(
			"No signup-cohort users reached this milestone for the selected filters.",
		);
	});
});

function paginationButton(html: string, label: string) {
	const labelIndex = html.indexOf(label);
	return html.slice(html.lastIndexOf("<button", labelIndex), labelIndex);
}
