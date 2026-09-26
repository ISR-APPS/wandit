// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CodeTreeNode } from "../../api/dto";
import { FileTree, type FileTreeProps, filterTree } from "./file-tree";

// A small worktree: a closed branch (db), an open branch (payments), a dot
// folder that starts closed, and a root file.
const TREE: CodeTreeNode[] = [
	{
		kind: "folder",
		path: "src",
		name: "src",
		children: [
			{
				kind: "folder",
				path: "src/db",
				name: "db",
				children: [
					{
						kind: "folder",
						path: "src/db/migrations",
						name: "migrations",
						children: [
							{
								kind: "file",
								path: "src/db/migrations/0001_init.sql",
								name: "0001_init.sql",
							},
						],
					},
					{ kind: "file", path: "src/db/schema.ts", name: "schema.ts" },
				],
			},
			{
				kind: "folder",
				path: "src/server",
				name: "server",
				children: [
					{
						kind: "folder",
						path: "src/server/payments",
						name: "payments",
						children: [
							{
								kind: "file",
								path: "src/server/payments/checkout.ts",
								name: "checkout.ts",
							},
							{
								kind: "file",
								path: "src/server/payments/webhook.ts",
								name: "webhook.ts",
							},
						],
					},
				],
			},
		],
	},
	{
		kind: "folder",
		path: ".claude",
		name: ".claude",
		children: [{ kind: "file", path: ".claude/CLAUDE.md", name: "CLAUDE.md" }],
	},
	{ kind: "file", path: "package.json", name: "package.json" },
];
const SELECTED_PATH = "src/server/payments/checkout.ts";

function renderTree(
	props: Partial<FileTreeProps> = {},
	locale: ComponentProps<typeof I18nProvider>["locale"] = "en",
) {
	const onSelect = vi.fn();
	function withProviders(treeProps: Partial<FileTreeProps>): ReactNode {
		// I18nProvider requires children in its props type for createElement calls.
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale,
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children: createElement(FileTree, {
				nodes: TREE,
				selectedPath: SELECTED_PATH,
				onSelect,
				...treeProps,
			}),
		};
		return createElement(I18nProvider, providerProps);
	}
	const view = render(withProviders(props));
	return {
		onSelect,
		rerenderWith: (next: Partial<FileTreeProps>) =>
			view.rerender(withProviders(next)),
	};
}

function row(name: string): HTMLElement {
	return screen.getByRole("treeitem", { name });
}

// The tree tracks pressed keys between keydown and keyup.
function press(element: HTMLElement, key: string) {
	fireEvent.keyDown(element, { code: key, key });
	fireEvent.keyUp(element, { code: key, key });
}

/** Every file path of a tree, in order. */
function filePaths(nodes: FileTreeProps["nodes"]): string[] {
	return nodes.flatMap((node) =>
		node.kind === "file" ? [node.path] : filePaths(node.children),
	);
}

// jsdom has no layout: no scrollIntoView, and no visibility. A case sets
// `isRowVisible` to play a tree that a phone keeps hidden.
const scrollIntoView = vi.fn();
let isRowVisible = true;
beforeAll(() => {
	Element.prototype.scrollIntoView = scrollIntoView;
	Element.prototype.checkVisibility = () => isRowVisible;
});
afterEach(() => {
	cleanup();
	scrollIntoView.mockClear();
	isRowVisible = true;
});

describe("filterTree", () => {
	it("keeps a matching file with its ancestors and drops the rest", () => {
		const kept = filterTree(TREE, "check");
		expect(filePaths(kept)).toEqual(["src/server/payments/checkout.ts"]);
		expect(kept.map((node) => node.path)).toEqual(["src"]);
	});

	it("matches a folder name in the path, so the files under it stay", () => {
		expect(filePaths(filterTree(TREE, "payments"))).toEqual([
			"src/server/payments/checkout.ts",
			"src/server/payments/webhook.ts",
		]);
	});

	it("matches without regard to case and returns every node for an empty query", () => {
		expect(filePaths(filterTree(TREE, "WEBHOOK"))).toEqual([
			"src/server/payments/webhook.ts",
		]);
		expect(filterTree(TREE, "  ")).toBe(TREE);
	});
});

describe("FileTree", () => {
	it("calls onSelect with the path of a clicked file", () => {
		const { onSelect } = renderTree();
		fireEvent.click(row("webhook.ts"));
		expect(onSelect).toHaveBeenCalledWith("src/server/payments/webhook.ts");
	});

	it("marks the selected file and hides the files of a closed folder", () => {
		renderTree();
		expect(row("checkout.ts").getAttribute("aria-selected")).toBe("true");
		expect(row("webhook.ts").getAttribute("aria-selected")).toBe("false");
		fireEvent.click(row("payments"));
		expect(screen.queryByText("webhook.ts")).toBeNull();
		expect(row("payments").getAttribute("aria-expanded")).toBe("false");
	});

	it("starts with a folder closed when it is not on the selected path, and a dot folder closed", () => {
		renderTree();
		expect(screen.queryByText("migrations")).toBeNull();
		expect(row(".claude").getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByText("CLAUDE.md")).toBeNull();
		fireEvent.click(row("db"));
		expect(screen.queryByText("0001_init.sql")).toBeNull();
		fireEvent.click(row("migrations"));
		expect(row("0001_init.sql")).toBeTruthy();
	});

	it("shows the selected row, and opens the folders of a new selected path", () => {
		const { rerenderWith } = renderTree();
		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("0001_init.sql")).toBeNull();
		rerenderWith({ selectedPath: "src/db/migrations/0001_init.sql" });
		expect(row("0001_init.sql").getAttribute("aria-selected")).toBe("true");
		expect(scrollIntoView).toHaveBeenCalledTimes(2);
		expect(scrollIntoView.mock.contexts.at(-1)).toBe(row("0001_init.sql"));
	});

	it("waits for a visible row before it shows the selected file", () => {
		isRowVisible = false;
		const { rerenderWith } = renderTree();
		expect(scrollIntoView).not.toHaveBeenCalled();

		isRowVisible = true;
		rerenderWith({});

		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(scrollIntoView.mock.contexts.at(-1)).toBe(row("checkout.ts"));
	});

	it("shows a file that a new tree adds", () => {
		const { rerenderWith } = renderTree();
		expect(screen.queryByText("README.md")).toBeNull();

		rerenderWith({
			nodes: [...TREE, { kind: "file", path: "README.md", name: "README.md" }],
		});

		expect(row("README.md")).toBeTruthy();
	});

	it("gives the tree one tab stop, on the selected file", () => {
		renderTree();
		const stops = screen
			.getAllByRole("treeitem")
			.filter((item) => item.tabIndex === 0);
		expect(stops).toEqual([row("checkout.ts")]);
	});

	it("moves the focus with the arrow keys", async () => {
		renderTree();
		// A click opens db and gives it the focus.
		fireEvent.click(row("db"));
		press(row("db"), "ArrowDown");
		await waitFor(() => expect(document.activeElement).toBe(row("migrations")));
	});

	it("swaps the open and close arrows in Arabic", () => {
		renderTree({}, "ar");
		fireEvent.click(row("db"));
		expect(row("db").getAttribute("aria-expanded")).toBe("true");
		press(row("db"), "ArrowRight");
		expect(row("db").getAttribute("aria-expanded")).toBe("false");
		press(row("db"), "ArrowLeft");
		expect(row("db").getAttribute("aria-expanded")).toBe("true");
	});

	it("filters on the full path, marks the match, and opens every folder", () => {
		renderTree();
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "init" },
		});
		expect(row("0001_init.sql")).toBeTruthy();
		expect(screen.queryByText("package.json")).toBeNull();
		expect(screen.getByText("init").tagName).toBe("MARK");
	});

	it("reports no match, and Escape clears the search", () => {
		renderTree();
		const box = screen.getByRole("searchbox");
		fireEvent.change(box, { target: { value: "zzz" } });
		expect(screen.getByText("No file matches.")).toBeTruthy();
		fireEvent.keyDown(box, { key: "Escape" });
		expect(row("package.json")).toBeTruthy();
	});

	it("opens the first match on Enter and moves to the tree on ArrowDown", async () => {
		const { onSelect } = renderTree();
		const box = screen.getByRole("searchbox");
		fireEvent.change(box, { target: { value: "webhook" } });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith("src/server/payments/webhook.ts");
		fireEvent.keyDown(box, { key: "ArrowDown" });
		await waitFor(() => expect(document.activeElement).toBe(row("src")));
	});
});
