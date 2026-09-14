// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetMockStore } from "../../api/app-builder.services";
import { CodeView, type CodeViewProps } from "./code-view";

function renderView(props: Partial<CodeViewProps> = {}) {
	const onSelectFile = vi.fn();
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(
			Suspense,
			{ fallback: null },
			createElement(CodeView, {
				projectId: "nadi-fitness",
				filePath: undefined,
				onSelectFile,
				...props,
			}),
		),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(I18nProvider, providerProps),
		),
	);
	return { onSelectFile };
}

beforeEach(resetMockStore);
afterEach(cleanup);

describe("CodeView", () => {
	it("opens the default file, drops the trailing empty line, and colors keywords", async () => {
		renderView();
		const selected = await screen.findByRole("button", { name: "checkout.ts" });
		expect(selected.getAttribute("aria-current")).toBe("true");
		expect(screen.getByText("Synced · main")).toBeTruthy();
		// checkout.ts has 23 lines and ends with a newline.
		expect(screen.getByText("23")).toBeTruthy();
		expect(screen.queryByText("24")).toBeNull();
		expect(screen.getAllByText("import")[0]?.className).toBe(
			"text-ember-strong",
		);
	});

	it("shows the missing-file message for a path outside the repository", async () => {
		renderView({ filePath: "src/missing.ts" });
		expect(
			await screen.findByText("This file is not in the repository."),
		).toBeTruthy();
		expect(screen.getByText("missing.ts").className).toBe("text-foreground");
	});

	it("filters the tree from the search box and forwards a file pick", async () => {
		const { onSelectFile } = renderView();
		await screen.findByRole("button", { name: "package.json" });
		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "webhook" },
		});
		expect(screen.queryByRole("button", { name: "package.json" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "webhook.ts" }));
		expect(onSelectFile).toHaveBeenCalledWith("src/server/payments/webhook.ts");
	});
});
