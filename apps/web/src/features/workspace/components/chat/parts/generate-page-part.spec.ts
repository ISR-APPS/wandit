// Static-markup tests for the page-build checklist card. The presentational
// view is pure (progress object in, markup out), so renderToStaticMarkup
// covers every lifecycle state without Realtime or a QueryClient; the
// subscription wrapper (PageBuildCard) is exercised in the browser instead.

import type { PageBuildProgress } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/store", () => ({
	useWorkspace: () => ({
		projectId: "project-1",
		setTab: () => undefined,
	}),
}));

import {
	GeneratePagePart,
	PageBuildProgressView,
	type PageBuildRunState,
} from "./generate-page-part";

function progressFixture(
	overrides: Partial<PageBuildProgress> = {},
): PageBuildProgress {
	return {
		done: false,
		findings: [],
		fixes: 0,
		headline: "Writing the page…",
		images: [],
		pageBytes: 0,
		percent: 42,
		phase: "writing",
		reviewPasses: 0,
		reviewTarget: 2,
		sections: [],
		shots: [],
		videos: 0,
		...overrides,
	};
}

function renderView(
	progress: PageBuildProgress | undefined,
	runState: PageBuildRunState = "building",
	versionNumber: number | undefined = 3,
) {
	return renderToStaticMarkup(
		createElement(PageBuildProgressView, {
			progress,
			runState,
			versionNumber,
		}),
	);
}

describe("PageBuildProgressView", () => {
	it("renders the writing phase with art thumbnails done above it", () => {
		const html = renderView(
			progressFixture({
				images: [
					{ role: "hero", url: "https://assets.example.com/img-1.png" },
					{ role: "texture", url: "https://assets.example.com/img-2.png" },
				],
			}),
		);

		expect(html).toContain("Building v3");
		expect(html).toContain("Writing the page…");
		expect(html).toContain("42%");
		expect(html).toContain("Generated the product art");
		expect(html).toContain("2 images");
		expect(html).toContain('src="https://assets.example.com/img-1.png"');
		// The review row is still waiting its turn.
		expect(html).toContain("Screenshot &amp; review the page");
	});

	it("renders review shots, findings, and the pass counter", () => {
		const html = renderView(
			progressFixture({
				findings: ["1 console error", "Horizontal overflow on mobile (14px)"],
				headline: "Screenshotting the page to review it…",
				pageBytes: 24_000,
				phase: "reviewing",
				sections: ["Hero", "Countdown", "COD form"],
				shots: [
					{
						url: "https://assets.example.com/p1-1.jpg",
						viewport: "desktop",
					},
					{ url: "https://assets.example.com/p1-5.jpg", viewport: "mobile" },
				],
			}),
		);

		expect(html).toContain("Screenshotting the page to review it…");
		expect(html).toContain("pass 1 of 2");
		expect(html).toContain("Wrote the page");
		expect(html).toContain("3 sections");
		expect(html).toContain(">Hero<");
		expect(html).toContain('src="https://assets.example.com/p1-1.jpg"');
		expect(html).toContain(
			"1 console error · Horizontal overflow on mobile (14px)",
		);
	});

	it("keeps the fix row done when review re-activates after a fix", () => {
		const html = renderView(
			progressFixture({
				fixes: 2,
				headline: "Reviewing the renders…",
				pageBytes: 24_000,
				phase: "reviewing",
				reviewPasses: 1,
			}),
		);

		expect(html).toContain("Applied 2 fixes");
		expect(html).toContain("×2");
	});

	it("renders the succeeded state with the Page-tab action and no tool chip", () => {
		const html = renderView(
			progressFixture({ done: true, phase: "finishing" }),
			"succeeded",
		);

		expect(html).toContain("v3 is ready");
		expect(html).toContain("It&#x27;s live in the Page tab.");
		expect(html).toContain("Open the Page tab");
		expect(html).toContain("Handed over — it&#x27;s in the Page tab");
		expect(html).toContain("100%");
		expect(html).not.toContain("tool · generate_page");
	});

	it("renders the failed state without a percent bar, pending rows, or chip", () => {
		const html = renderView(progressFixture(), "failed");

		expect(html).toContain("Build failed");
		expect(html).toContain("ask me to retry");
		expect(html).not.toContain("42%");
		expect(html).not.toContain("bg-gradient-ember");
		// Evidence-less to-do rows collapse on an ended run, and the
		// working-state tool chip disappears with them.
		expect(html).not.toContain("Screenshot &amp; review the page");
		expect(html).not.toContain("Final check &amp; handover");
		expect(html).not.toContain("tool · generate_page");
	});

	it("freezes the active spinner when the subscription dies", () => {
		const live = renderView(progressFixture({ phase: "writing" }), "building");
		const dead = renderView(
			progressFixture({ phase: "writing" }),
			"disconnected",
		);

		expect(live).toContain("animate-spin");
		expect(dead).not.toContain("animate-spin");
		expect(dead).toContain("Live progress lost");
	});

	it("shows the in-flight pass from currentPass while reviewing", () => {
		const html = renderView(
			progressFixture({
				currentPass: 2,
				headline: "Screenshotting the page to review it…",
				pageBytes: 24_000,
				phase: "reviewing",
				reviewPasses: 1,
			}),
		);

		expect(html).toContain("pass 2 of 2");
	});

	it("announces the build status to screen readers", () => {
		const html = renderView(progressFixture());

		expect(html).toContain('role="status"');
		expect(html).toContain("Building v3. Writing the page…");
	});

	it("singularizes the section badge", () => {
		const html = renderView(
			progressFixture({
				pageBytes: 12_000,
				phase: "reviewing",
				sections: ["Hero"],
			}),
		);

		expect(html).toContain("1 section");
		expect(html).not.toContain("1 sections");
	});

	it("renders a calm starting state before any metadata arrives", () => {
		const html = renderView(undefined);

		expect(html).toContain("Building v3");
		expect(html).toContain("Starting up…");
		expect(html).toContain("Write the page");
	});
});

describe("GeneratePagePart fallbacks", () => {
	it("keeps the static line for queued outputs without a realtime handle", () => {
		const part = {
			input: { brief: "b", title: "t" },
			output: {
				attemptId: "11111111-1111-4111-8111-111111111111",
				message: "Queued",
				status: "queued",
				versionNumber: 2,
			},
			state: "output-available",
			toolCallId: "call-1",
			type: "tool-generate_page",
		} as unknown as Parameters<typeof GeneratePagePart>[0]["part"];

		const html = renderToStaticMarkup(
			createElement(GeneratePagePart, { part }),
		);

		expect(html).toContain("Building v2 — it will appear in the Page tab.");
		expect(html).not.toContain("Final check");
	});

	it("relays the honest unavailable message", () => {
		const part = {
			input: { brief: "b", title: "t" },
			output: {
				message: "Page generation isn't configured on this server yet.",
				status: "unavailable",
			},
			state: "output-available",
			toolCallId: "call-1",
			type: "tool-generate_page",
		} as unknown as Parameters<typeof GeneratePagePart>[0]["part"];

		const html = renderToStaticMarkup(
			createElement(GeneratePagePart, { part }),
		);

		expect(html).toContain("isn&#x27;t configured");
	});
});
