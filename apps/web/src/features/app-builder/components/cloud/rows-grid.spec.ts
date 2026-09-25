// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowsGrid, type RowsGridProps } from "./rows-grid";

const ROWS = [
	{ id: 1, name: "Ada", tags: ["admin"] },
	{ id: 2, name: null, tags: [] },
];

function renderGrid(props: Partial<RowsGridProps> = {}) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(RowsGrid, {
			columns: ["id", "name", "tags"],
			rows: ROWS,
			emptyText: "This table has no rows.",
			...props,
		}),
	};
	render(createElement(I18nProvider, providerProps));
}

afterEach(cleanup);

describe("RowsGrid", () => {
	it("shows one header per column and each value as text, JSON, or NULL", () => {
		renderGrid();

		expect(
			screen.getAllByRole("columnheader").map((header) => header.textContent),
		).toEqual(["id", "name", "tags"]);
		expect(screen.getByText("Ada")).toBeTruthy();
		expect(screen.getByText('["admin"]')).toBeTruthy();
		expect(screen.getByText("NULL")).toBeTruthy();
		// The cells keep left-to-right text in an Arabic page.
		expect(screen.getByText("Ada").closest("td")?.getAttribute("dir")).toBe(
			"ltr",
		);
	});

	it("asks for the next and the previous page and stops at the ends", () => {
		const onPageChange = vi.fn();
		renderGrid({ paging: { page: 3, pageSize: 50, total: 120, onPageChange } });

		expect(screen.getByText("Page 3 of 3")).toBeTruthy();
		expect(screen.getByText("120 rows")).toBeTruthy();
		const next = screen.getByRole("button", { name: "Next page" });
		expect(next.hasAttribute("disabled")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Previous page" }));

		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	it("flips the sorted column and starts another column ascending", () => {
		const onSortChange = vi.fn();
		renderGrid({ sort: { column: "id", direction: "asc", onSortChange } });

		expect(
			screen
				.getByRole("columnheader", { name: "id" })
				.getAttribute("aria-sort"),
		).toBe("ascending");

		fireEvent.click(screen.getByRole("button", { name: "id" }));
		fireEvent.click(screen.getByRole("button", { name: "name" }));

		expect(onSortChange.mock.calls).toEqual([
			["id", "desc"],
			["name", "asc"],
		]);
	});

	it("shows the skeleton before the first page and the empty text for no rows", () => {
		renderGrid({ rows: undefined });
		expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(screen.queryByRole("table")).toBeNull();

		cleanup();
		renderGrid({ rows: [] });
		expect(screen.getByText("This table has no rows.")).toBeTruthy();
	});
});
