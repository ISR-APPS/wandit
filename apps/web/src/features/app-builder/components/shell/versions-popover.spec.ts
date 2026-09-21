// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { AppCommit, VersionDiffResponse } from "@wandit/contracts";
import { fallbackDictionary } from "@wandit/internationalization";
import { I18nProvider } from "@wandit/internationalization/react";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appBuilderKeys } from "../../api/app-builder.queries";
import { VersionsList } from "./versions-popover";

const PROJECT_ID = crypto.randomUUID();
const HEAD_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const MID_SHA = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
const OLD_SHA = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

function commit(sha: string, source: AppCommit["source"]): AppCommit {
	return {
		sha,
		parentSha: null,
		message: "Saved the version",
		source,
		restoredFromSha: null,
		turnId: null,
		messageId: null,
		numstat: null,
		createdAt: "2026-09-17T10:00:00.000Z",
	};
}

// Three commits as the API lists them: newest first.
const VERSIONS = [
	commit(HEAD_SHA, "agent"),
	commit(MID_SHA, "wip"),
	commit(OLD_SHA, "agent"),
] satisfies AppCommit[];

// The Diff toggle mounts VersionDiff, which reads versionDiffQuery, so every
// render needs a query client even when no test opens a diff.
function renderList(
	versions: AppCommit[],
	queryClient = new QueryClient(),
	isRestoring = false,
) {
	const onRestore = vi.fn<(sha: string) => void>();
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(VersionsList, {
			versions,
			onRestore,
			projectId: PROJECT_ID,
			isRestoring,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
	return { onRestore };
}

/** The `<li>` that holds the short sha, for example "a1b2c3d". */
function rowOf(shortSha: string): HTMLElement {
	const row = screen.getByText(shortSha).closest("li");
	if (!row) throw new Error(`No row for ${shortSha}`);
	return row;
}

afterEach(cleanup);

describe("VersionsList", () => {
	it("renders the source badge and Current on the first row", () => {
		renderList(VERSIONS);
		// The first row is the current version: no Diff and no Restore.
		const head = rowOf("a1b2c3d");
		expect(head.textContent).toContain("Turn");
		expect(head.textContent).toContain("Current");
		expect(within(head).queryByRole("button", { name: "Restore" })).toBeNull();
		expect(within(head).queryByRole("button", { name: "Diff" })).toBeNull();
		// The older rows carry their source badge and both actions.
		expect(rowOf("b2c3d4e").textContent).toContain("Work in progress");
		expect(rowOf("c3d4e5f").textContent).toContain("Turn");
		expect(screen.getAllByRole("button", { name: "Diff" })).toHaveLength(2);
		expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
	});

	it("shows the empty note when the project has no version yet", () => {
		renderList([]);
		expect(
			screen.getByText("No version yet. The first turn creates one."),
		).toBeTruthy();
	});

	it("disables every Restore button while a restore runs", () => {
		renderList(VERSIONS, new QueryClient(), true);
		const buttons = screen.getAllByRole("button", { name: "Restore" });
		expect(buttons).toHaveLength(2);
		expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(
			true,
		);
		// The Diff toggle stays usable.
		expect(
			screen
				.getAllByRole("button", { name: "Diff" })[0]
				.hasAttribute("disabled"),
		).toBe(false);
	});

	it("opens the confirm dialog and calls onRestore with the row sha", async () => {
		const { onRestore } = renderList(VERSIONS);
		fireEvent.click(
			within(rowOf("c3d4e5f")).getByRole("button", { name: "Restore" }),
		);

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText("Restore this version?")).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "Restore" }));

		expect(onRestore).toHaveBeenCalledWith(OLD_SHA);
	});

	it("opens the diff under the row with the numstat line and one card per file", async () => {
		const queryClient = new QueryClient();
		// The diff answer of the oldest version, seeded fresh so no fetch runs.
		queryClient.setQueryData(appBuilderKeys.versionDiff(PROJECT_ID, OLD_SHA), {
			sha: OLD_SHA,
			patch: DIFF_PATCH,
			numstat: [
				{ path: "app/(tabs)/home.tsx", insertions: 2, deletions: 0 },
				{ path: "app/(tabs)/old.tsx", insertions: 0, deletions: 1 },
			],
		} satisfies VersionDiffResponse);
		renderList(VERSIONS, queryClient);

		fireEvent.click(
			within(rowOf("c3d4e5f")).getByRole("button", { name: "Diff" }),
		);

		expect(await screen.findByText("+2 −1")).toBeTruthy();
		expect(screen.getByText("app/(tabs)/home.tsx")).toBeTruthy();
		expect(screen.getByText("app/(tabs)/old.tsx")).toBeTruthy();
	});

	it("shows the empty-diff note when the patch holds no file", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(appBuilderKeys.versionDiff(PROJECT_ID, MID_SHA), {
			sha: MID_SHA,
			patch: "",
			numstat: [],
		} satisfies VersionDiffResponse);
		renderList(VERSIONS, queryClient);

		fireEvent.click(
			within(rowOf("b2c3d4e")).getByRole("button", { name: "Diff" }),
		);

		expect(
			await screen.findByText("This version changed no file."),
		).toBeTruthy();
	});
});

// A `git show` patch with two files: two added lines in one, one removed line in the other.
const DIFF_PATCH = [
	"diff --git a/app/(tabs)/home.tsx b/app/(tabs)/home.tsx",
	"index 1111111..2222222 100644",
	"--- a/app/(tabs)/home.tsx",
	"+++ b/app/(tabs)/home.tsx",
	"@@ -1,1 +1,3 @@",
	" export function Home() {",
	'+import { Banner } from "./banner";',
	'+import { Footer } from "./footer";',
	"diff --git a/app/(tabs)/old.tsx b/app/(tabs)/old.tsx",
	"index 3333333..4444444 100644",
	"--- a/app/(tabs)/old.tsx",
	"+++ b/app/(tabs)/old.tsx",
	"@@ -1,2 +1,1 @@",
	'-import { Old } from "./old";',
	" export function Old() {",
].join("\n");
