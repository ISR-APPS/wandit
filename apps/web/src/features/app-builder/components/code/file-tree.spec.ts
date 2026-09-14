// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOCK_CODE_SNAPSHOT } from "../../lib/mock-code";
import { FileTree, type FileTreeProps, filterTree } from "./file-tree";

function renderTree(props: Partial<FileTreeProps> = {}) {
	const onSelect = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(FileTree, {
			nodes: MOCK_CODE_SNAPSHOT.tree,
			selectedPath: MOCK_CODE_SNAPSHOT.defaultFilePath,
			onSelect,
			query: "",
			...props,
		}),
	};
	render(createElement(I18nProvider, providerProps));
	return { onSelect };
}

/** Every file path of a tree, in order. */
function filePaths(nodes: FileTreeProps["nodes"]): string[] {
	return nodes.flatMap((node) =>
		node.kind === "file" ? [node.path] : filePaths(node.children),
	);
}

afterEach(cleanup);

describe("filterTree", () => {
	it("keeps a matching file with its ancestors and drops the rest", () => {
		const kept = filterTree(MOCK_CODE_SNAPSHOT.tree, "check");
		expect(filePaths(kept)).toEqual(["src/server/payments/checkout.ts"]);
		expect(filePaths(kept)).not.toContain("package.json");
		expect(kept.map((node) => node.path)).toEqual(["src"]);
	});

	it("matches without regard to case and returns every node for an empty query", () => {
		expect(filePaths(filterTree(MOCK_CODE_SNAPSHOT.tree, "WEBHOOK"))).toEqual([
			"src/server/payments/webhook.ts",
		]);
		expect(filterTree(MOCK_CODE_SNAPSHOT.tree, "  ")).toBe(
			MOCK_CODE_SNAPSHOT.tree,
		);
	});
});

describe("FileTree", () => {
	it("calls onSelect with the path of a clicked file", () => {
		const { onSelect } = renderTree();
		fireEvent.click(screen.getByRole("button", { name: "webhook.ts" }));
		expect(onSelect).toHaveBeenCalledWith("src/server/payments/webhook.ts");
	});

	it("marks the selected file and hides the files of a closed folder", () => {
		renderTree();
		expect(
			screen
				.getByRole("button", { name: "checkout.ts" })
				.getAttribute("aria-current"),
		).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "Collapse payments" }));
		expect(screen.queryByText("webhook.ts")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Expand payments" }),
		).toBeTruthy();
	});

	it("starts with a folder closed when it is not on the selected path", () => {
		renderTree();
		expect(screen.queryByText("migrations")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Expand db" }));
		expect(screen.queryByText("0001_init.sql")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Expand migrations" }));
		expect(screen.getByText("0001_init.sql")).toBeTruthy();
	});

	it("opens every folder while a query is active and reports no match", () => {
		renderTree({ query: "init" });
		expect(screen.getByText("0001_init.sql")).toBeTruthy();
		expect(screen.queryByText("package.json")).toBeNull();
		cleanup();
		renderTree({ query: "zzz" });
		expect(screen.getByText("No file matches.")).toBeTruthy();
	});
});
