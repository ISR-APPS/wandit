/**
 * Thin fetch wrapper over the Google Sheets REST API. Rewrites use a hidden
 * staging tab: bounded batches fill that tab while the merchant's live tab is
 * untouched, then one atomic spreadsheets.batchUpdate swaps the tabs.
 */
import { Injectable } from "@nestjs/common";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const REQUEST_TIMEOUT_MS = 15_000;
const STAGING_SHEET_PREFIX = "__wandit_sync_";

export class GoogleSheetsApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "GoogleSheetsApiError";
	}
}

export type CreatedSpreadsheet = {
	spreadsheetId: string;
	spreadsheetUrl: string;
};

export type StagedSheetRewrite = {
	liveSheet: {
		index: number;
		sheetId: number;
		title: string;
	};
	stagingSheet: {
		columnCount: number;
		rowCount: number;
		sheetId: number;
	};
};

type SheetProperties = {
	gridProperties?: {
		columnCount?: number;
		rowCount?: number;
	};
	hidden?: boolean;
	index?: number;
	sheetId?: number;
	title?: string;
};

@Injectable()
export class GoogleSheetsClient {
	async createSpreadsheet(
		accessToken: string,
		title: string,
	): Promise<CreatedSpreadsheet> {
		const body = await this.request(accessToken, SHEETS_API_BASE, "POST", {
			properties: { title },
		});

		const { spreadsheetId, spreadsheetUrl } = body as {
			spreadsheetId?: string;
			spreadsheetUrl?: string;
		};

		if (!spreadsheetId || !spreadsheetUrl) {
			throw new GoogleSheetsApiError(
				502,
				"Spreadsheet create response missing id or url",
			);
		}

		return { spreadsheetId, spreadsheetUrl };
	}

	/**
	 * Capture the first visible (live) tab and add a hidden staging tab. The
	 * staging tab is deliberately tiny; each write grows it in the same atomic
	 * request that writes the new rows.
	 */
	async beginStagedRewrite(
		accessToken: string,
		spreadsheetId: string,
		columnCount: number,
	): Promise<StagedSheetRewrite> {
		const spreadsheet = (await this.request(
			accessToken,
			`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount))`,
			"GET",
		)) as { sheets?: Array<{ properties?: SheetProperties }> };

		const liveSheet = (spreadsheet.sheets ?? [])
			.map((sheet) => sheet.properties)
			.filter(isUsableSheetProperties)
			.sort((left, right) => left.index - right.index)
			.find((sheet) => !sheet.hidden);

		if (!liveSheet) {
			throw new GoogleSheetsApiError(
				502,
				"Spreadsheet has no visible sheet to replace",
			);
		}

		const stageTitle = `${STAGING_SHEET_PREFIX}${crypto.randomUUID()}`;
		const response = (await this.batchUpdate(accessToken, spreadsheetId, [
			{
				addSheet: {
					properties: {
						gridProperties: {
							columnCount: Math.max(1, Math.floor(columnCount)),
							rowCount: 1,
						},
						hidden: true,
						title: stageTitle,
					},
				},
			},
		])) as {
			replies?: Array<{
				addSheet?: { properties?: { sheetId?: number } };
			}>;
		};
		const stagingSheetId = response.replies?.[0]?.addSheet?.properties?.sheetId;

		if (typeof stagingSheetId !== "number") {
			throw new GoogleSheetsApiError(
				502,
				"Staging sheet response missing sheet id",
			);
		}

		return {
			liveSheet: {
				index: liveSheet.index,
				sheetId: liveSheet.sheetId,
				title: liveSheet.title,
			},
			stagingSheet: {
				columnCount: Math.max(1, Math.floor(columnCount)),
				rowCount: 1,
				sheetId: stagingSheetId,
			},
		};
	}

	/** Write one bounded row chunk without exposing it on the live tab. */
	async writeStagedValues(
		accessToken: string,
		spreadsheetId: string,
		rewrite: StagedSheetRewrite,
		startRowIndex: number,
		values: string[][],
	): Promise<void> {
		if (values.length === 0) {
			return;
		}

		const rowIndex = Math.max(0, Math.floor(startRowIndex));
		const requiredRowCount = rowIndex + values.length;
		const requiredColumnCount = Math.max(1, ...values.map((row) => row.length));
		const gridProperties: { columnCount?: number; rowCount?: number } = {};
		const gridFields: string[] = [];

		if (requiredRowCount > rewrite.stagingSheet.rowCount) {
			gridProperties.rowCount = requiredRowCount;
			gridFields.push("gridProperties.rowCount");
		}

		if (requiredColumnCount > rewrite.stagingSheet.columnCount) {
			gridProperties.columnCount = requiredColumnCount;
			gridFields.push("gridProperties.columnCount");
		}

		const requests: unknown[] = [];
		if (gridFields.length > 0) {
			requests.push({
				updateSheetProperties: {
					fields: gridFields.join(","),
					properties: {
						gridProperties,
						sheetId: rewrite.stagingSheet.sheetId,
					},
				},
			});
		}

		requests.push({
			updateCells: {
				fields: "userEnteredValue",
				rows: values.map((row) => ({
					values: row.map((value) => ({
						userEnteredValue: { stringValue: value },
					})),
				})),
				start: {
					columnIndex: 0,
					rowIndex,
					sheetId: rewrite.stagingSheet.sheetId,
				},
			},
		});

		await this.batchUpdate(accessToken, spreadsheetId, requests);

		rewrite.stagingSheet.rowCount = Math.max(
			rewrite.stagingSheet.rowCount,
			requiredRowCount,
		);
		rewrite.stagingSheet.columnCount = Math.max(
			rewrite.stagingSheet.columnCount,
			requiredColumnCount,
		);
	}

	/**
	 * The only operation that touches the live tab. Google validates and
	 * applies all requests atomically: reveal staging, delete old live, then
	 * restore the old tab's title and position.
	 */
	async commitStagedRewrite(
		accessToken: string,
		spreadsheetId: string,
		rewrite: StagedSheetRewrite,
	): Promise<void> {
		await this.batchUpdate(accessToken, spreadsheetId, [
			{
				updateSheetProperties: {
					fields: "hidden",
					properties: {
						hidden: false,
						sheetId: rewrite.stagingSheet.sheetId,
					},
				},
			},
			{ deleteSheet: { sheetId: rewrite.liveSheet.sheetId } },
			{
				updateSheetProperties: {
					fields: "title,index",
					properties: {
						index: rewrite.liveSheet.index,
						sheetId: rewrite.stagingSheet.sheetId,
						title: rewrite.liveSheet.title,
					},
				},
			},
		]);
	}

	/** Best-effort cleanup for a failed pre-commit staging run. */
	async discardStagedRewrite(
		accessToken: string,
		spreadsheetId: string,
		rewrite: StagedSheetRewrite,
	): Promise<void> {
		await this.batchUpdate(accessToken, spreadsheetId, [
			{ deleteSheet: { sheetId: rewrite.stagingSheet.sheetId } },
		]);
	}

	private batchUpdate(
		accessToken: string,
		spreadsheetId: string,
		requests: unknown[],
	): Promise<unknown> {
		return this.request(
			accessToken,
			`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
			"POST",
			{ requests },
		);
	}

	private async request(
		accessToken: string,
		url: string,
		method: "GET" | "POST",
		body?: unknown,
	): Promise<unknown> {
		const response = await fetch(url, {
			body: body === undefined ? undefined : JSON.stringify(body),
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			method,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});

		if (!response.ok) {
			throw new GoogleSheetsApiError(
				response.status,
				await readErrorMessage(response),
			);
		}

		return response.json().catch(() => ({}));
	}
}

function isUsableSheetProperties(
	properties: SheetProperties | undefined,
): properties is SheetProperties & {
	index: number;
	sheetId: number;
	title: string;
} {
	return Boolean(
		properties &&
			typeof properties.index === "number" &&
			typeof properties.sheetId === "number" &&
			typeof properties.title === "string",
	);
}

// Google error bodies are {error: {message, ...}} — surface the message so a
// 403 says "Sheets API has not been used in project…" instead of "403".
async function readErrorMessage(response: Response): Promise<string> {
	const fallback = `Google Sheets API responded ${response.status}`;

	try {
		const body = (await response.json()) as {
			error?: { message?: unknown };
		};

		return typeof body.error?.message === "string"
			? body.error.message.slice(0, 300)
			: fallback;
	} catch {
		return fallback;
	}
}
