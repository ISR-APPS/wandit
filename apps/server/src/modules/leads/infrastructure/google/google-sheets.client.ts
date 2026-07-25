/**
 * Thin fetch wrapper over the Google Sheets REST API — the three calls the
 * leads sync needs, no googleapis dependency. The caller supplies a fresh
 * access token per call (better-auth mints and refreshes them); this client
 * holds no credentials or state.
 *
 * Ranges are given without a sheet name on purpose: bare A1 notation targets
 * the first visible sheet, so the sync keeps working even if the merchant
 * renames the tab.
 */
import { Injectable } from "@nestjs/common";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const REQUEST_TIMEOUT_MS = 15_000;

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

	async clearValues(
		accessToken: string,
		spreadsheetId: string,
		range: string,
	): Promise<void> {
		await this.request(
			accessToken,
			`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
			"POST",
		);
	}

	/**
	 * Write rows starting at `range` via values:append — NOT values:update.
	 * A created spreadsheet has a fixed 1000-row grid and update cannot grow
	 * it (a 1001-row write 400s with "exceeds grid limits"); append expands
	 * the grid as needed, and on a just-cleared (empty) sheet it starts at
	 * the top of the range.
	 */
	async appendValues(
		accessToken: string,
		spreadsheetId: string,
		range: string,
		values: string[][],
	): Promise<void> {
		await this.request(
			accessToken,
			`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=OVERWRITE`,
			"POST",
			{ values },
		);
	}

	private async request(
		accessToken: string,
		url: string,
		method: "POST" | "PUT",
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
