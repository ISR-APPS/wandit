// Static-markup tests for the page-build checklist card. The presentational
// views are pure (props in, markup out), so renderToStaticMarkup covers
// every lifecycle state without Realtime or a QueryClient; the subscription
// wrapper (PageBuildCard) is exercised in the browser instead.

import type { PageBuildProgress } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			(
				({
					"workspace.chat.pageBuild.failedHeadline":
						"The build stopped before the page was ready.",
					"workspace.chat.pageBuild.failedTitle": "Page build failed",
				}) as Record<string, string>
			)[key] ?? key,
	}),
}));

vi.mock("../../../lib/store", () => ({
	useWorkspace: () => ({
		projectId: "project-1",
		setTab: () => undefined,
	}),
}));

const openPlanPicker = vi.fn();
vi.mock("@/features/billing/components/billing-modal-provider", () => ({
	useBillingModal: () => ({ openPlanPicker }),
}));

// FailedBuildCard reads the purchases kill switch; static markup needs no
// QueryClient, so stub it (default: purchases possible).
let purchasesEnabled: boolean | undefined = true;
vi.mock("@/features/billing/lib/purchases", () => ({
	usePurchasesEnabled: () => purchasesEnabled,
}));

import {
	FailedBuildCard,
	GeneratePagePart,
	PageBuildProgressView,
	type PageBuildRunState,
	StoppedBuildCard,
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

	it("never shows the internal tool chip, even while building", () => {
		const html = renderView(progressFixture());

		expect(html).not.toContain("tool · generate_page");
		expect(html).not.toContain("tool ·");
	});

	it("runs the elapsed clock while building and hides it when ended", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-07T10:01:05.000Z"));

		const building = renderToStaticMarkup(
			createElement(PageBuildProgressView, {
				progress: progressFixture(),
				runState: "building",
				startedAt: "2026-08-07T10:00:00.000Z",
				versionNumber: 3,
			}),
		);
		const succeeded = renderToStaticMarkup(
			createElement(PageBuildProgressView, {
				progress: progressFixture({ done: true }),
				runState: "succeeded",
				startedAt: "2026-08-07T10:00:00.000Z",
				versionNumber: 3,
			}),
		);

		vi.useRealTimers();

		expect(building).toContain("1:05");
		expect(succeeded).not.toContain("1:05");
	});
});

describe("StoppedBuildCard (design card 16)", () => {
	it("renders the frozen percent, the stop line, and both actions", () => {
		const html = renderToStaticMarkup(
			createElement(StoppedBuildCard, {
				onDiscard: () => undefined,
				onResume: () => undefined,
				percent: 62,
				versionNumber: 4,
			}),
		);

		expect(html).toContain("Stopped");
		expect(html).toContain("Landing page · v4");
		expect(html).toContain("62%");
		expect(html).toContain("You stopped this build.");
		expect(html).toContain("Resume");
		expect(html).toContain("Discard");
	});

	it("clamps a wire percent above 100", () => {
		const html = renderToStaticMarkup(
			createElement(StoppedBuildCard, {
				onDiscard: undefined,
				onResume: undefined,
				percent: 140,
				versionNumber: undefined,
			}),
		);

		expect(html).toContain("100%");
		expect(html).toContain("Your page");
		expect(html).not.toContain("Resume");
	});
});

describe("FailedBuildCard (design card 12)", () => {
	function renderFailed(
		failureCode: Parameters<typeof FailedBuildCard>[0]["failureCode"],
	) {
		return renderToStaticMarkup(
			createElement(FailedBuildCard, {
				failureCode,
				onDismiss: () => undefined,
				onRetry: () => undefined,
			}),
		);
	}

	it("blames the provider — not Wandit — for a rate limit, with Retry", () => {
		const html = renderFailed("provider_rate_limited");

		expect(html).toContain("Provider issue");
		expect(html).toContain("The AI provider is busy right now.");
		expect(html).toContain("isn&#x27;t a Wandit problem");
		expect(html).toContain("error · provider_rate_limited");
		expect(html).toContain("Retry");
		expect(html).toContain("Dismiss");
	});

	it("owns our-side failures honestly and keeps the last-version reassurance", () => {
		const html = renderFailed("storage_failure");

		expect(html).toContain("Saving the finished page failed.");
		expect(html).toContain("on our side");
		expect(html).toContain("Your last version is safe");
		expect(html).toContain("Retry");
	});

	it("renders the wallet card for insufficient credits (design card 09)", () => {
		const html = renderFailed("insufficient_credits");

		expect(html).toContain("Can&#x27;t generate");
		expect(html).toContain("You&#x27;re out of credits.");
		expect(html).toContain("Top up wallet");
		expect(html).toContain("Retry");
	});

	it("falls back to Retry when purchases are paused (beta kill switch)", () => {
		purchasesEnabled = false;
		try {
			const html = renderFailed("insufficient_credits");

			expect(html).not.toContain("Top up wallet");
			expect(html).toContain("Retry");
			expect(html).toContain("Dismiss");
		} finally {
			purchasesEnabled = true;
		}
	});

	it("offers no retry for a member credit limit — only the admin can fix it", () => {
		const html = renderFailed("member_limit");

		expect(html).toContain("Your member credit limit was reached.");
		expect(html).toContain("workspace admin");
		expect(html).not.toContain("Retry");
		expect(html).toContain("Dismiss");
	});

	it("degrades an unknown/legacy failure to the generic copy without a code line", () => {
		const html = renderFailed(null);

		expect(html).toContain("The build stopped unexpectedly.");
		expect(html).not.toContain("error ·");
		expect(html).toContain("Retry");
	});
});

describe("PageBuildProgressView stop control", () => {
	it("renders the Stop chip while building when onStop is provided", () => {
		const html = renderToStaticMarkup(
			createElement(PageBuildProgressView, {
				onStop: () => undefined,
				progress: progressFixture(),
				runState: "building",
				versionNumber: 3,
			}),
		);

		expect(html).toContain(">Stop</button>");
	});

	it("hides the Stop chip once the run ended", () => {
		const html = renderToStaticMarkup(
			createElement(PageBuildProgressView, {
				onStop: () => undefined,
				progress: progressFixture({ done: true }),
				runState: "succeeded",
				versionNumber: 3,
			}),
		);

		expect(html).not.toContain(">Stop</button>");
	});
});

describe("GeneratePagePart fallbacks", () => {
	it("keeps the static line for legacy outputs without attempt or realtime", () => {
		const part = {
			input: { brief: "b", title: "t" },
			output: {
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

	it("relays the needs-input message instead of showing a build card", () => {
		const part = {
			input: { brief: "b", title: "t" },
			output: {
				message: "Ask the user for the merchant's exact product SKU first.",
				status: "needs-input",
			},
			state: "output-available",
			toolCallId: "call-1",
			type: "tool-generate_page",
		} as unknown as Parameters<typeof GeneratePagePart>[0]["part"];

		const html = renderToStaticMarkup(
			createElement(GeneratePagePart, { part }),
		);

		expect(html).toContain("merchant&#x27;s exact product SKU");
		expect(html).not.toContain("Building v");
	});
});
