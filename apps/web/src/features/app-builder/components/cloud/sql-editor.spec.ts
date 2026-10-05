// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { CloudSqlResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import type { runSql } from "../../api/cloud.services";
import { SqlEditor } from "./sql-editor";

const PROJECT_ID = crypto.randomUUID();

/** A console answer with one row. */
const ONE_ROW: CloudSqlResponse = {
	kind: "read",
	rows: [{ total: 3 }],
	rowCount: 1,
	truncated: false,
};

function renderEditor(postSql: typeof runSql) {
	// I18nProvider requires children in its props type for createElement calls.
	const providerProps: ComponentProps<typeof I18nProvider> = {
		locale: "en",
		dictionary: fallbackDictionary,
		setLocale: () => {},
		children: createElement(SqlEditor, { projectId: PROJECT_ID, postSql }),
	};
	render(
		createElement(
			QueryClientProvider,
			{ client: new QueryClient() },
			createElement(I18nProvider, providerProps),
		),
	);
}

function typeAndRun(statement: string): void {
	fireEvent.change(screen.getByRole("textbox", { name: "SQL query" }), {
		target: { value: statement },
	});
	fireEvent.click(screen.getByRole("button", { name: "Run" }));
}

afterEach(cleanup);

describe("SqlEditor", () => {
	it("posts a read query at once and shows its rows", async () => {
		const postSql = vi.fn<typeof runSql>(async () => ONE_ROW);
		renderEditor(postSql);

		typeAndRun("select count(*) as total from orders");

		await waitFor(() =>
			expect(postSql).toHaveBeenCalledWith(PROJECT_ID, {
				query: "select count(*) as total from orders",
				confirmWrite: false,
			}),
		);
		expect(await screen.findByText("3")).toBeTruthy();
		expect(screen.getByText("1 row")).toBeTruthy();
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("holds a write query until the user accepts the dialog", async () => {
		const postSql = vi.fn<typeof runSql>(async () => ({
			...ONE_ROW,
			kind: "write",
			rows: [],
			rowCount: 0,
		}));
		renderEditor(postSql);

		typeAndRun("update orders set total = 0");

		expect(await screen.findByRole("alertdialog")).toBeTruthy();
		expect(postSql).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Run query" }));

		await waitFor(() =>
			expect(postSql).toHaveBeenCalledWith(PROJECT_ID, {
				query: "update orders set total = 0",
				confirmWrite: true,
			}),
		);
		expect(postSql).toHaveBeenCalledOnce();
		expect(
			await screen.findByText("The statement ran. It returned no rows."),
		).toBeTruthy();
	});

	it("opens the same dialog when the server answers WRITE_NEEDS_CONFIRM", async () => {
		const postSql = vi
			.fn<typeof runSql>()
			.mockRejectedValueOnce(
				new ApiClientError({
					code: "WRITE_NEEDS_CONFIRM",
					message: "This statement writes data; confirm to run it",
					path: `/api/v2/projects/${PROJECT_ID}/cloud/sql`,
					requestId: "req-1",
					statusCode: 409,
					timestamp: "2026-09-25T00:00:00.000Z",
				}),
			)
			.mockResolvedValueOnce(ONE_ROW);
		renderEditor(postSql);

		typeAndRun("select 1");

		expect(await screen.findByRole("alertdialog")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Run query" }));

		await waitFor(() => expect(postSql).toHaveBeenCalledTimes(2));
		expect(postSql).toHaveBeenLastCalledWith(PROJECT_ID, {
			query: "select 1",
			confirmWrite: true,
		});
	});

	it("shows the row-limit note when the server cut the rows", async () => {
		renderEditor(async () => ({ ...ONE_ROW, truncated: true }));

		typeAndRun("select * from events");

		expect(
			await screen.findByText(
				"The query returned more than 500 rows. Only the first 500 rows show.",
			),
		).toBeTruthy();
	});
});
