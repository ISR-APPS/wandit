// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(CodeView, {
			projectId: PROJECT_ID,
			filePath: undefined,
			onSelectFile,
			...props,
		}),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		),
	);
	return { onSelectFile };
}

afterEach(cleanup);

describe("CodeView", () => {
	it("opens the default file, drops the trailing empty line, and colors keywords", async () => {
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [APP_FILE] }));
		const selected = await screen.findByRole("button", { name: "app.tsx" });
		expect(selected.getAttribute("aria-current")).toBe("true");
		expect(screen.getByText("Synced · main")).toBeTruthy();
		// app.tsx has 2 lines and ends with a newline.
		expect(screen.getByText("2")).toBeTruthy();
		expect(screen.queryByText("3")).toBeNull();
		expect(screen.getAllByText("import")[0]?.className).toBe(
			"text-ember-strong",
		);
	});

	it("shows the missing-file message for a path outside the worktree", async () => {
		const missing: CodeFile = { kind: "missing", path: "src/missing.ts" };
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [missing] }), {
			filePath: "src/missing.ts",
		});
		expect(
			await screen.findByText("This file is not in the repository."),
		).toBeTruthy();
		expect(screen.getByText("missing.ts").className).toBe("text-foreground");
	});

	it("shows a message for a binary file and for a file above the size cap", async () => {
		const logo: CodeFile = { kind: "binary", path: "logo.png" };
		renderView(queryClientWith({ snapshot: SNAPSHOT, files: [logo] }), {
			filePath: "logo.png",
		});
		expect(
			await screen.findByText(
				"This file is binary. The Code view shows text files only.",
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
		await screen.findByRole("button", { name: "package.json" });
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "webhook" },
		});
		expect(screen.queryByRole("button", { name: "package.json" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "webhook.ts" }));
		expect(onSelectFile).toHaveBeenCalledWith("src/webhook.ts");
	});

	it("shows the asleep message and loads no file when the sandbox sleeps", async () => {
		const queryClient = queryClientWith({ snapshot: null });
		renderView(queryClient);
		expect(
			await screen.findByText(
				"The sandbox is asleep. Send a message to wake it. Then the code shows here.",
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
		expect(screen.getByRole("button", { name: "package.json" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		// A 409 file error means the sandbox sleeps; the tree query learns it.
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: appBuilderKeys.code(PROJECT_ID),
		});
	});
});
