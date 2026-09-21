// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { BuilderFileChange, BuilderToolCall } from "../../api/dto";
import { ToolChips, type ToolChipsProps } from "./tool-chips";

const CALLS: BuilderToolCall[] = [
	{
		kind: "think",
		label: "Thinking",
		target: "Planning sign-in and payments…",
	},
	{ kind: "write", label: "Write 184 lines", target: "src/server/auth/otp.ts" },
	{ kind: "run", label: "Run migration", target: "pnpm db:push" },
	{ kind: "read", label: "Read docs", target: "chargily-pay.md" },
];

const FILES: BuilderFileChange[] = [
	{ path: "src/server/auth/otp.ts", added: 184, removed: 0 },
	{ path: "src/server/payments/checkout.ts", added: 96, removed: 12 },
	{ path: "src/server/auth/legacy.ts", added: 0, removed: 8 },
];

function renderChips(props: Partial<ToolChipsProps> = {}) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(ToolChips, {
			calls: CALLS,
			files: FILES,
			...props,
		}),
	};
	return render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("ToolChips", () => {
	it("renders the count, one row per call, and the file chips", () => {
		const { container } = renderChips();
		const toggle = screen.getByRole("button", { name: "4 tool calls" });
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		const rows = container.querySelectorAll("[data-tool-kind]");
		expect(rows).toHaveLength(4);
		expect(
			Array.from(rows, (row) => row.getAttribute("data-tool-kind")),
		).toEqual(["think", "write", "run", "read"]);
		expect(screen.getByText("Planning sign-in and payments…")).toBeTruthy();
		expect(screen.getByText("pnpm db:push")).toBeTruthy();
		expect(screen.getByText("chargily-pay.md")).toBeTruthy();
		// The path shows once in the write row and once as a file chip.
		expect(screen.getAllByText("src/server/auth/otp.ts")).toHaveLength(2);
		expect(screen.getByText("src/server/payments/checkout.ts")).toBeTruthy();
		expect(screen.getByText("+184").className).toContain("text-success-text");
		expect(screen.getByText("+96")).toBeTruthy();
		expect(screen.getByText("-12").className).toContain("text-destructive");
		expect(screen.getByText("-8")).toBeTruthy();
		// A zero count renders no chip: neither "+0" nor "-0" appears.
		expect(container.textContent).not.toContain("+0");
		expect(container.textContent).not.toContain("-0");
	});

	it("hides the rows and the file chips after a click on the toggle", () => {
		const { container } = renderChips();
		const toggle = screen.getByRole("button", { name: "4 tool calls" });
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(container.querySelectorAll("[data-tool-kind]")).toHaveLength(0);
		expect(screen.queryByText("+184")).toBeNull();
		expect(screen.queryByText("src/server/payments/checkout.ts")).toBeNull();
	});

	it("uses the singular label for one call and no chip row without files", () => {
		const { container } = renderChips({
			calls: [{ kind: "run", label: "Run migration", target: "pnpm db:push" }],
			files: [],
		});
		expect(screen.getByRole("button", { name: "1 tool call" })).toBeTruthy();
		expect(screen.getByText("pnpm db:push")).toBeTruthy();
		// Only the call row renders: the file chip list stays out of the DOM.
		expect(container.querySelectorAll("li")).toHaveLength(1);
	});
});
