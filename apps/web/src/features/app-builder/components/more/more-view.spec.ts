// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CloudBackendResponse, CloudFunction } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { appBuilderKeys } from "../../api/app-builder.queries";
import { cloudKeys } from "../../api/cloud.queries";
import type { AppProject, CodeFile, CodeSnapshot } from "../../api/dto";
import type { ProjectPanel } from "../../lib/constants";
import { MoreView } from "./more-view";

const PROJECT: AppProject = {
	id: crypto.randomUUID(),
	name: "Nadi Fitness",
	kind: "web",
	languages: ["en"],
	templateVersion: "1.0.0",
	engine: "v2_app",
	versionNumber: 4,
	unpublishedChanges: 3,
	hasCodeChanges: true,
};

const ACTIVE_BACKEND: CloudBackendResponse = {
	status: "active",
	ref: "abcdefghijklmnopqrst",
	region: "eu-west-3",
	failureCode: null,
};

const SEND_EMAIL: CloudFunction = {
	id: "fn-send-email",
	slug: "send-email",
	name: "send-email",
	status: "ACTIVE",
	version: 3,
	lastDeployedAt: "2026-10-02T09:30:00.000Z",
	invocations24h: 12,
};

const SNAPSHOT: CodeSnapshot = {
	branch: "main",
	defaultFilePath: "src/app.tsx",
	tree: [
		{
			kind: "folder",
			path: "src",
			name: "src",
			children: [{ kind: "file", path: "src/app.tsx", name: "app.tsx" }],
		},
	],
};

const APP_FILE: CodeFile = {
	kind: "text",
	path: "src/app.tsx",
	content: "export const app = 1;\n",
	size: 22,
};

// The code screen reads the snapshot and its default file from the cache, with no API call.
function seedCode(queryClient: QueryClient): void {
	queryClient.setQueryData(appBuilderKeys.code(PROJECT.id), SNAPSHOT);
	queryClient.setQueryData(
		appBuilderKeys.codeFile(PROJECT.id, APP_FILE.path),
		APP_FILE,
	);
}

/** True when the element sits inside a wrapper that the view hides with the `hidden` class. */
function isHidden(element: HTMLElement): boolean {
	return element.closest(".hidden") !== null;
}

// The cache holds every answer a case puts in it, and nothing is stale or
// retried, so the view never calls the API for that data.
function cachedClient(): QueryClient {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	// The view refetches the snapshot at each open of the code screen. The
	// resolved mock stops that refetch, so no case makes an API call.
	vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();
	return queryClient;
}

function renderView(
	panel: ProjectPanel,
	isActive: boolean,
	queryClient = cachedClient(),
) {
	const onSelectPanel = vi.fn();
	function view(openPanel: ProjectPanel, isViewActive: boolean) {
		// I18nProvider requires children in its props type for createElement calls.
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(MoreView, {
				project: PROJECT,
				panel: openPanel,
				isActive: isViewActive,
				showBackendGroup: true,
				onSelectPanel,
				codeFilePath: undefined,
				onSelectCodeFile: vi.fn(),
				isTurnRunning: false,
			}),
		};
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(
				TooltipProvider,
				null,
				createElement(I18nProvider, providerProps),
			),
		);
	}
	const { rerender } = render(view(panel, isActive));
	// The page owns the open panel, so a case shows another panel with a new render.
	function showPanel(nextPanel: ProjectPanel, isViewActive: boolean): void {
		rerender(view(nextPanel, isViewActive));
	}
	return { queryClient, onSelectPanel, showPanel };
}

/** The `query` part of every logs query key in the cache, in creation order. */
function logsQueries(queryClient: QueryClient) {
	return queryClient
		.getQueryCache()
		.findAll({ queryKey: [...cloudKeys.all(PROJECT.id), "logs"] })
		.map((query) => query.queryKey.at(-1));
}

// jsdom has no layout and no media queries. The code screen scrolls the
// tree, reads visibility, and asks useIsMobile; its 1024 px window is a desktop.
beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.checkVisibility = () => true;
	window.matchMedia = (media: string) =>
		// SAFETY: useIsMobile reads only `matches` and the change listener
		// methods, which EventTarget and these fields provide.
		Object.assign(new EventTarget(), {
			matches: false,
			media,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
		}) as MediaQueryList;
});

afterEach(cleanup);

describe("MoreView", () => {
	it("opens a More panel inside its shell, with the panel title", () => {
		renderView("payments", true);

		expect(
			screen.getByRole("heading", { level: 1, name: "Payments" }),
		).toBeTruthy();
		expect(screen.getByText("Payments are coming soon")).toBeTruthy();
	});

	it("opens a Cloud panel in the shell, with its Cloud title", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.secrets(PROJECT.id), []);
		renderView("secrets", true, queryClient);

		expect(screen.getByText("This project has no secrets yet.")).toBeTruthy();
		expect(
			screen.getByRole("heading", { level: 1, name: "Secrets" }),
		).toBeTruthy();
	});

	it("opens Logs on the functions source and the slug from View logs", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT.id), ACTIVE_BACKEND);
		queryClient.setQueryData(cloudKeys.functions(PROJECT.id), [SEND_EMAIL]);
		const { onSelectPanel, showPanel } = renderView(
			"functions",
			true,
			queryClient,
		);

		fireEvent.click(screen.getByRole("button", { name: "View logs" }));

		expect(onSelectPanel).toHaveBeenCalledWith("logs");

		// A hidden view reads nothing, so the logs query enters the cache with no API call.
		showPanel("logs", false);

		expect(logsQueries(queryClient)).toHaveLength(1);
		expect(logsQueries(queryClient)[0]).toMatchObject({
			source: "functions",
			search: "send-email",
		});
	});

	it("hides the nav and the shell under the code screen, and Back opens the last panel", async () => {
		const queryClient = cachedClient();
		seedCode(queryClient);
		const { onSelectPanel, showPanel } = renderView(
			"payments",
			true,
			queryClient,
		);

		showPanel("code", true);

		expect(
			await screen.findByRole("treeitem", { name: "app.tsx" }),
		).toBeTruthy();
		expect(
			isHidden(screen.getByRole("navigation", { name: "App sections" })),
		).toBe(true);
		expect(
			isHidden(screen.getByRole("heading", { level: 1, name: "Payments" })),
		).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		expect(onSelectPanel).toHaveBeenLastCalledWith("payments");
	});

	it("mounts the code screen at its first open and keeps it, hidden, when another panel opens", async () => {
		const queryClient = cachedClient();
		seedCode(queryClient);
		const { showPanel } = renderView("payments", true, queryClient);
		expect(screen.queryByRole("tree")).toBeNull();

		showPanel("code", true);
		await screen.findByRole("treeitem", { name: "app.tsx" });
		showPanel("payments", true);

		expect(isHidden(screen.getByRole("tree"))).toBe(true);
		expect(
			isHidden(screen.getByRole("heading", { level: 1, name: "Payments" })),
		).toBe(false);
	});

	it("refetches the snapshot each time the code screen opens again", async () => {
		const queryClient = cachedClient();
		seedCode(queryClient);
		const { showPanel } = renderView("code", true, queryClient);
		await screen.findByRole("treeitem", { name: "app.tsx" });

		showPanel("payments", true);
		showPanel("code", true);

		// The mounted code screen sends no request by itself; another client can move the head.
		expect(queryClient.refetchQueries).toHaveBeenCalledTimes(2);
		expect(queryClient.refetchQueries).toHaveBeenLastCalledWith(
			{ queryKey: appBuilderKeys.code(PROJECT.id), exact: true },
			expect.anything(),
		);
	});

	it("clears the Logs filter on a nav click", () => {
		const queryClient = cachedClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT.id), ACTIVE_BACKEND);
		queryClient.setQueryData(cloudKeys.functions(PROJECT.id), [SEND_EMAIL]);
		const { onSelectPanel, showPanel } = renderView(
			"functions",
			false,
			queryClient,
		);
		fireEvent.click(screen.getByRole("button", { name: "View logs" }));

		fireEvent.click(screen.getByRole("button", { name: "Logs" }));
		showPanel("logs", false);

		expect(onSelectPanel).toHaveBeenLastCalledWith("logs");
		expect(logsQueries(queryClient)).toEqual([
			expect.objectContaining({ source: "api", search: undefined }),
		]);
	});
});
