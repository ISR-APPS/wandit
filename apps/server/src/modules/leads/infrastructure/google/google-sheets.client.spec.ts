import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	GoogleSheetsClient,
	type StagedSheetRewrite,
} from "./google-sheets.client";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function requestBody(index = 0): { requests: unknown[] } {
	const init = fetchMock.mock.calls[index]?.[1];
	if (typeof init?.body !== "string") {
		throw new Error(`Expected JSON body for fetch call ${index}`);
	}

	return JSON.parse(init.body) as { requests: unknown[] };
}

function rewrite(): StagedSheetRewrite {
	return {
		liveSheet: { index: 0, sheetId: 11, title: "Commandes" },
		stagingSheet: {
			columnCount: 8,
			rowCount: 1,
			sheetId: 22,
		},
	};
}

beforeEach(() => {
	fetchMock = vi.fn<typeof fetch>();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("GoogleSheetsClient staged rewrites", () => {
	it("adds a hidden staging tab while retaining the first visible live tab", async () => {
		fetchMock
			.mockResolvedValueOnce(
				jsonResponse({
					sheets: [
						{
							properties: {
								hidden: true,
								index: 0,
								sheetId: 7,
								title: "Hidden helper",
							},
						},
						{
							properties: {
								hidden: false,
								index: 1,
								sheetId: 11,
								title: "Commandes",
							},
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					replies: [{ addSheet: { properties: { sheetId: 22 } } }],
				}),
			);
		const client = new GoogleSheetsClient();

		const result = await client.beginStagedRewrite("token", "sheet-abc", 8);

		expect(result).toEqual({
			liveSheet: { index: 1, sheetId: 11, title: "Commandes" },
			stagingSheet: { columnCount: 8, rowCount: 1, sheetId: 22 },
		});
		expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
		expect(requestBody(1).requests).toEqual([
			{
				addSheet: {
					properties: {
						gridProperties: { columnCount: 8, rowCount: 1 },
						hidden: true,
						title: expect.stringMatching(/^__wandit_sync_/),
					},
				},
			},
		]);
	});

	it("grows the hidden grid and writes each bounded chunk in one batch", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ replies: [{}, {}] }));
		const client = new GoogleSheetsClient();
		const staged = rewrite();

		await client.writeStagedValues("token", "sheet-abc", staged, 1, [
			["Amina", "+213500000000", "Alger"],
			["Sofia", "+213600000000", "Oran"],
		]);

		expect(requestBody().requests).toEqual([
			{
				updateSheetProperties: {
					fields: "gridProperties.rowCount",
					properties: {
						gridProperties: { rowCount: 3 },
						sheetId: 22,
					},
				},
			},
			{
				updateCells: {
					fields: "userEnteredValue",
					rows: [
						{
							values: [
								{ userEnteredValue: { stringValue: "Amina" } },
								{
									userEnteredValue: { stringValue: "+213500000000" },
								},
								{ userEnteredValue: { stringValue: "Alger" } },
							],
						},
						{
							values: [
								{ userEnteredValue: { stringValue: "Sofia" } },
								{
									userEnteredValue: { stringValue: "+213600000000" },
								},
								{ userEnteredValue: { stringValue: "Oran" } },
							],
						},
					],
					start: { columnIndex: 0, rowIndex: 1, sheetId: 22 },
				},
			},
		]);
		expect(staged.stagingSheet.rowCount).toBe(3);
	});

	it("swaps staging into place in one atomic batch without a zero-visible-sheet step", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ replies: [{}, {}, {}] }));
		const client = new GoogleSheetsClient();

		await client.commitStagedRewrite("token", "sheet-abc", rewrite());

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(requestBody().requests).toEqual([
			{
				updateSheetProperties: {
					fields: "hidden",
					properties: { hidden: false, sheetId: 22 },
				},
			},
			{ deleteSheet: { sheetId: 11 } },
			{
				updateSheetProperties: {
					fields: "title,index",
					properties: {
						index: 0,
						sheetId: 22,
						title: "Commandes",
					},
				},
			},
		]);
	});
});
