// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { type ComponentProps, createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { appBuilderKeys } from "../../api/app-builder.queries";
import type { CodeFile, CodeSnapshot } from "../../api/dto";
import { CodeView, type CodeViewProps } from "./code-view";

const PROJECT_ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

const SNAPSHOT: CodeSnapshot = {
	branch: "main",
	defaultFilePath: "src/app.tsx",
	tree: [
		{
			kind: "folder",
			path: "src",
			name: "src",
			children: [
				{ kind: "file", path: "src/app.tsx", name: "app.tsx" },
				{ kind: "file", path: "src/webhook.ts", name: "webhook.ts" },
			],
		},
		{ kind: "file", path: "package.json", name: "package.json" },
	],
};

const APP_FILE: CodeFile = {
	kind: "text",
	path: "src/app.tsx",
	content: 'import { x } from "y";\nexport const app = x;\n',
	size: 45,
};

// The cache holds every answer, and nothing is stale, so the view never
// calls the API.
function queryClientWith(entries: {
	snapshot?: CodeSnapshot | null;
	files?: CodeFile[];
}): QueryClient {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				retryOnMount: false,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	if (entries.snapshot !== undefined) {
		queryClient.setQueryData(appBuilderKeys.code(PROJECT_ID), entries.snapshot);
	}
	for (const file of entries.files ?? []) {
		queryClient.setQueryData(
			appBuilderKeys.codeFile(PROJECT_ID, file.path),
			file,
		);
	}
	return queryClient;
}

// Puts a failed first load in the cache, like a 500 from the API.
async function failQuery(
	queryClient: QueryClient,
	queryKey: readonly string[],
): Promise<void> {
	await queryClient.prefetchQuery({
		queryKey,
		queryFn: () => Promise.reject(new Error("The API is down.")),
		retry: false,
	});
}

function renderView(
	queryClient: QueryClient,
	props: Partial<CodeViewProps> = {},
) {
	const onSelectFile = vi.fn();
	function tree(viewProps: Partial<CodeViewProps>) {
		// I18nProvider requires children in its props type for createElement calls.
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(CodeView, {
				projectId: PROJECT_ID,
				filePath: undefined,
				onSelectFile,
				...viewProps,
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
	const view = render(tree(props));
	return {
		onSelectFile,
		rerenderWith: (next: Partial<CodeViewProps>) => view.rerender(tree(next)),
	};
}

/** The text of the breadcrumb in the editor header. */
function breadcrumbText(): string {
	return document.querySelector("header nav")?.textContent ?? "";
}

// A file query that never answers, like a slow API, and makes no request.
function holdFileQuery(queryClient: QueryClient, path: string): void {
	void queryClient.prefetchQuery({
		queryKey: appBuilderKeys.codeFile(PROJECT_ID, path),
		queryFn: () => new Promise<CodeFile>(() => {}),
	});
}

/** The text that the CodeMirror editor shows, once its lazy chunk loaded. */
async function editorText(): Promise<string> {
	await waitFor(() =>
		expect(document.querySelector(".cm-content")).not.toBeNull(),
	);
	return document.querySelector(".cm-content")?.textContent ?? "";
}

// jsdom has no layout: no scrollIntoView, no visibility, and no media
// queries. Its window is 1024 px wide, so useIsMobile answers false.
const DESKTOP_WIDTH = window.innerWidth;
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
afterEach(() => {
	cleanup();
	window.innerWidth = DESKTOP_WIDTH;
});

describe("CodeView", () => {
	it("opens the default file from the cache with its language, lines, and size", async () => {
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [APP_FILE] }));

		expect(await editorText()).toContain('import { x } from "y";');
		// The TSX grammar loads and colors the tokens.
		await waitFor(() =>
			expect(
				document.querySelector(".cm-content .cm-line span"),
			).not.toBeNull(),
		);
		expect(
			screen
				.getByRole("treeitem", { name: "app.tsx" })
				.getAttribute("aria-selected"),
		).toBe("true");
		expect(screen.getByText("Synced · main")).toBeTruthy();
		expect(screen.getByText("TSX")).toBeTruthy();
		// app.tsx has 2 lines and ends with a newline.
		expect(screen.getByText("2 lines")).toBeTruthy();
		expect(screen.getByText("45 bytes")).toBeTruthy();
		expect(screen.getByText("Read-only")).toBeTruthy();
	});

	it("shows a new path at once and keeps the old file while the new one loads", async () => {
		const queryClient = queryClientWith({
			snapshot: SNAPSHOT,
			files: [APP_FILE],
		});
		holdFileQuery(queryClient, "src/webhook.ts");
		const { onSelectFile } = renderView(queryClient);
		await editorText();

		fireEvent.click(screen.getByRole("treeitem", { name: "webhook.ts" }));

		expect(onSelectFile).toHaveBeenCalledWith("src/webhook.ts");
		const breadcrumb = screen.getByRole("navigation", { hidden: true });
		expect(breadcrumb.textContent).toContain("webhook.ts");
		expect(await editorText()).toContain("export const app = x;");
		expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
		// The status bar speaks only about the requested file.
		expect(screen.queryByText("2 lines")).toBeNull();
	});

	it("follows a new URL path after a click", async () => {
		const packageFile: CodeFile = {
			kind: "text",
			path: "package.json",
			content: "{}\n",
			size: 3,
		};
		const queryClient = queryClientWith({
			snapshot: SNAPSHOT,
			files: [APP_FILE, packageFile],
		});
		holdFileQuery(queryClient, "src/webhook.ts");
		const { rerenderWith } = renderView(queryClient, {
			filePath: "src/app.tsx",
		});
		await editorText();
		fireEvent.click(screen.getByRole("treeitem", { name: "webhook.ts" }));
		expect(breadcrumbText()).toContain("webhook.ts");

		// Back, forward, or a link changes the URL: the URL path wins.
		rerenderWith({ filePath: "package.json" });

		expect(breadcrumbText()).toContain("package.json");
		expect(await editorText()).toContain("{}");
	});

	it("on a phone, shows the file first and closes the tree after a pick", async () => {
		window.innerWidth = 390;
		const { onSelectFile } = renderView(
			queryClientWith({ snapshot: SNAPSHOT, files: [APP_FILE] }),
		);
		await editorText();
		const treeColumn = () =>
			screen.getByRole("tree", { hidden: true }).closest(".border-e");
		expect(treeColumn()?.classList.contains("hidden")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Show files" }));
		expect(treeColumn()?.classList.contains("hidden")).toBe(false);
		fireEvent.click(screen.getByRole("treeitem", { name: "webhook.ts" }));

		expect(onSelectFile).toHaveBeenCalledWith("src/webhook.ts");
		expect(treeColumn()?.classList.contains("hidden")).toBe(true);
	});

	it("shows the missing-file message for a path outside the worktree", async () => {
		const missing: CodeFile = { kind: "missing", path: "src/missing.ts" };
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [missing] }), {
			filePath: "src/missing.ts",
		});
		expect(
			await screen.findByText("This file is not in the repository."),
		).toBeTruthy();
		expect(screen.getByText("missing.ts")).toBeTruthy();
	});

	it("shows a message for a binary file and for a file above the size cap", async () => {
		const logo: CodeFile = { kind: "binary", path: "logo.png", size: 2048 };
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [logo] }), {
			filePath: "logo.png",
		});
		expect(
			await screen.findByText(
				"This file is binary. The Code view shows text files only. · 2 kB",
			),
		).toBeTruthy();

		cleanup();
		const big: CodeFile = { kind: "tooLarge", path: "big.json" };
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [big] }), {
			filePath: "big.json",
		});
		expect(
			await screen.findByText(
				"This file is larger than 512 kB. The Code view shows files up to 512 kB only.",
			),
		).toBeTruthy();
	});

	it("filters the tree from the search box and forwards a file pick", async () => {
		const { onSelectFile } = renderView(
			queryClientWith({ snapshot: SNAPSHOT, files: [APP_FILE] }),
		);
		await screen.findByRole("treeitem", { name: "package.json" });
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "webhook" },
		});
		expect(screen.queryByRole("treeitem", { name: "package.json" })).toBeNull();
		fireEvent.click(screen.getByRole("treeitem", { name: "webhook.ts" }));
		expect(onSelectFile).toHaveBeenCalledWith("src/webhook.ts");
	});

	it("hides and shows the file tree from the header", async () => {
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [APP_FILE] }));
		const hide = await screen.findByRole("button", { name: "Hide files" });
		expect(hide.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(hide);

		const show = screen.getByRole("button", { name: "Show files" });
		expect(show.getAttribute("aria-expanded")).toBe("false");
		expect(
			screen.getByRole("tree", { hidden: true }).closest(".hidden"),
		).not.toBeNull();
	});

	it("shows the asleep message and loads no file when the sandbox sleeps", async () => {
		const queryClient = queryClientWith({ snapshot: null });
		renderView(queryClient);
		expect(
			await screen.findByText(
				"Your app is asleep. Send a message in the chat to wake it up. Then your code shows here.",
			),
		).toBeTruthy();
		expect(
			queryClient.getQueryState(
				appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx"),
			),
		).toBeUndefined();
	});

	it("shows the no-files message when the tree holds no file", async () => {
		renderView(
			queryClientWith({
				snapshot: { branch: "main", defaultFilePath: null, tree: [] },
			}),
		);
		expect(
			await screen.findByText("The project has no files yet."),
		).toBeTruthy();
	});

	it("shows a retry control when the tree does not load", async () => {
		const queryClient = queryClientWith({});
		await failQuery(queryClient, appBuilderKeys.code(PROJECT_ID));
		renderView(queryClient);
		expect(await screen.findByText("The code did not load.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	});

	it("keeps the tree when the file does not load, and the retry refetches the tree too", async () => {
		const queryClient = queryClientWith({ snapshot: SNAPSHOT });
		await failQuery(
			queryClient,
			appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx"),
		);
		// The resolved mock stops the refetch, so the case makes no API call.
		const invalidate = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue();
		renderView(queryClient);
		expect(await screen.findByText("The code did not load.")).toBeTruthy();
		expect(screen.getByRole("treeitem", { name: "package.json" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		// A 409 file error means the sandbox sleeps; the tree query learns it.
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: appBuilderKeys.code(PROJECT_ID),
		});
	});
});
