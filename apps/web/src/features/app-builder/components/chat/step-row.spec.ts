// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { StepRow, type StepRowProps } from "./step-row";

function renderStep(props: Partial<StepRowProps>) {
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(StepRow, {
			kind: "edit",
			state: "done",
			target: null,
			description: null,
			detail: [],
			...props,
		}),
	};
	return render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("StepRow", () => {
	it("shows Edited with the file chip and opens the diff lines behind the chevron", () => {
		renderStep({
			target: "styles.css",
			detail: [
				{ kind: "remove", text: "a {}" },
				{ kind: "add", text: "a { color: red; }" },
			],
		});
		expect(screen.getByText("Edited")).toBeTruthy();
		expect(screen.getByText("styles.css")).toBeTruthy();
		expect(screen.queryByText("a {}")).toBeNull();
		// The visible label and the file chip together name the button.
		fireEvent.click(
			screen.getByRole("button", { name: /Edited.*styles\.css/ }),
		);
		expect(screen.getByText("a {}").getAttribute("data-line-kind")).toBe(
			"remove",
		);
	});

	it("uses the running label while the call runs", () => {
		renderStep({ state: "running", target: "styles.css" });
		expect(screen.getByText("Editing")).toBeTruthy();
	});

	it("shows the model's sentence in place of the command label", () => {
		renderStep({
			kind: "run",
			description: "Vérification que l'application se charge",
			detail: [{ kind: "context", text: "pnpm run typecheck" }],
		});
		expect(
			screen.getByText("Vérification que l'application se charge"),
		).toBeTruthy();
		expect(screen.queryByText("Ran a command")).toBeNull();
	});

	it("reads one file as Read and a search as Explored the project", () => {
		renderStep({ kind: "explore", target: "app.tsx" });
		expect(screen.getByText("Read")).toBeTruthy();
		cleanup();
		renderStep({ kind: "explore", target: null });
		expect(screen.getByText("Explored the project")).toBeTruthy();
	});

	it("names a web search and a fetched page apart", () => {
		renderStep({ kind: "web", target: null });
		expect(screen.getByText("Searched the web")).toBeTruthy();
		cleanup();
		renderStep({ kind: "web", target: "docs.example.com" });
		expect(screen.getByText("Opened")).toBeTruthy();
	});

	it("marks a failed and a skipped call", () => {
		renderStep({ state: "error" });
		expect(screen.getByText("Failed")).toBeTruthy();
		cleanup();
		// A row with detail is a button; its name keeps the failed state.
		renderStep({ state: "error", detail: [{ kind: "context", text: "x" }] });
		expect(screen.getByRole("button", { name: /Failed/ })).toBeTruthy();
		cleanup();
		renderStep({ state: "skipped" });
		expect(screen.getByText("Skipped")).toBeTruthy();
	});

	it("has no button when there is no detail to open", () => {
		renderStep({ kind: "secret" });
		expect(screen.getByText("Saved a secret")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
