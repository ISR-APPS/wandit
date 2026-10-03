// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { CloudJob, CloudJobsResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { cloudKeys } from "../../api/cloud.queries";
import { JobsPanel } from "./jobs-panel";

const PROJECT_ID = crypto.randomUUID();

/** An active, named job with one finished run. */
const NIGHTLY_CLEANUP: CloudJob = {
	jobId: 3,
	name: "nightly-cleanup",
	schedule: "0 3 * * *",
	command: "delete from sessions where expires_at < now()",
	active: true,
	runs: [
		{
			runId: 41,
			status: "succeeded",
			startTime: "2026-10-03T03:00:00.000Z",
			endTime: "2026-10-03T03:00:01.000Z",
			returnMessage: "DELETE 4",
		},
	],
};

/** An inactive job with no name and no run yet. */
const UNNAMED_JOB: CloudJob = {
	jobId: 7,
	name: null,
	schedule: "*/5 * * * *",
	command: "select 1",
	active: false,
	runs: [],
};

// The cache holds the answer and nothing is stale or retried, so the panel
// never calls the API.
function renderPanel(jobs: CloudJobsResponse) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	queryClient.setQueryData(cloudKeys.jobs(PROJECT_ID), jobs);
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(JobsPanel, {
			projectId: PROJECT_ID,
			isActive: true,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
}

afterEach(cleanup);

describe("JobsPanel", () => {
	it("tells that pg_cron is off when the extension is not installed", () => {
		renderPanel({ installed: false, jobs: [] });

		expect(
			screen.getByText(
				"Scheduled jobs are off. The pg_cron extension is not on in the database of your app.",
			),
		).toBeTruthy();
	});

	it("shows the empty message when pg_cron has no jobs", () => {
		renderPanel({ installed: true, jobs: [] });

		expect(
			screen.getByText(
				"Your app has no scheduled jobs yet. Ask the agent to add one.",
			),
		).toBeTruthy();
	});

	it("names an unnamed job by its id and shows Never when it has no run", () => {
		renderPanel({ installed: true, jobs: [NIGHTLY_CLEANUP, UNNAMED_JOB] });

		const row = within(screen.getByRole("row", { name: /Job 7/ }));
		expect(row.getByText("Never")).toBeTruthy();
		expect(screen.getAllByText("Never")).toHaveLength(1);
	});

	it("shows Yes or No for the active state, and the status of the last run", () => {
		renderPanel({ installed: true, jobs: [NIGHTLY_CLEANUP, UNNAMED_JOB] });

		const nightly = within(
			screen.getByRole("row", { name: /nightly-cleanup/ }),
		);
		expect(nightly.getByText("Yes")).toBeTruthy();
		expect(nightly.getByText("succeeded")).toBeTruthy();
		expect(
			within(screen.getByRole("row", { name: /Job 7/ })).getByText("No"),
		).toBeTruthy();
	});
});
