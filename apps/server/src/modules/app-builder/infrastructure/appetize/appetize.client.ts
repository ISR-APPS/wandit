/**
 * Typed client for the Appetize REST API (WANDIT-196). The device-minutes
 * runtime reads the session times with `getSession`. The upload script
 * reads and uploads the Expo Go builds with `getApp`, `uploadApp`, and
 * `updateAppSettings`. It calls `fetch` with the `X-API-KEY` header.
 */
/*
 * Appetize facts, read 2026-09-26 in https://docs.appetize.io/llms.txt:
 * - POST /v1/apps (create) and POST /v1/apps/{publicKey} (update, same key)
 *   take JSON with `url`, or multipart/form-data with `file`.
 * - The v1 answer holds more than the schema reads, the private key too.
 *   The schema drops it, and no error message quotes a body.
 * - GET /v2/sessions requires `startDate` (UTC date, inclusive) and filters
 *   on `sessionToken`. `closeTime` stays null until the session closes.
 * No retry: the minutes task tries again on its next run, and a person
 * runs the upload script again.
 */
import {
	type AppetizeApp,
	appetizeAppSchema,
	appetizeSessionsResponseSchema,
	type DevicePlatform,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import type { z } from "zod";

const APPETIZE_API_BASE_URL = "https://api.appetize.io";
// One JSON round trip gets 30 s, like the other vendor clients.
const REQUEST_TIMEOUT_MS = 30_000;
// An Expo Go build is 150 to 210 MB, so one upload gets 10 minutes.
const UPLOAD_TIMEOUT_MS = 600_000;

/** One Appetize session as the minutes task reads it. */
export type AppetizeSessionLog = z.infer<
	typeof appetizeSessionsResponseSchema
>["results"][number];

/** One failed Appetize call. The message never carries the token or a body. */
export class AppetizeApiError extends Error {
	constructor(
		message: string,
		/** HTTP status of the failed call, or null on a network failure or a timeout. */
		readonly status: number | null,
	) {
		super(message);
		this.name = "AppetizeApiError";
	}
}

/** Settings of one Appetize app. Appetize applies them to every session of the app. */
export type AppetizeAppSettings = {
	/** Idle seconds before Appetize ends a session. One of 30, 60, 90, 120, 180, 300, 600, 1800, 3600, 7200. */
	timeout: number;
	/** Longest session in seconds. The minutes task bills at most this much per session. */
	timeLimit: number;
	/** Sessions of this app that can run at the same time. */
	maxConcurrent: number;
	/** Hosts that can embed the app, for example `wandit.dev`. */
	referrerHostnamesRestricted: string[];
};

/** Constructor input. `fetch` and `baseUrl` are the spec seams. */
export type AppetizeClientDeps = {
	/** `APPETIZE_API_TOKEN`. It stays on the server. */
	token: string;
	fetch?: typeof fetch;
	baseUrl?: string;
};

/** The Appetize calls of wandit. Every answer goes through a contracts schema. */
export class AppetizeClient {
	private readonly fetchImpl: typeof fetch;
	private readonly baseUrl: string;

	constructor(private readonly deps: AppetizeClientDeps) {
		this.fetchImpl = deps.fetch ?? fetch;
		this.baseUrl = deps.baseUrl ?? APPETIZE_API_BASE_URL;
	}

	/**
	 * The session of `sessionToken`, or null when Appetize has none.
	 * `startDate` is the UTC day (`YYYY-MM-DD`) of the session start; the
	 * API needs it to bound the search.
	 */
	async getSession(
		sessionToken: string,
		startDate: string,
	): Promise<AppetizeSessionLog | null> {
		const url = new URL("/v2/sessions", this.baseUrl);
		url.searchParams.set("sessionToken", sessionToken);
		url.searchParams.set("startDate", startDate);
		const { results } = appetizeSessionsResponseSchema.parse(
			await this.request(url, { method: "GET" }, REQUEST_TIMEOUT_MS),
		);
		return (
			results.find((session) => session.sessionToken === sessionToken) ?? null
		);
	}

	/** The app of `publicKey`. Its `note` holds the Expo Go version of the last upload. */
	async getApp(publicKey: string): Promise<AppetizeApp> {
		return appetizeAppSchema.parse(
			await this.request(
				new URL(`/v1/apps/${encodeURIComponent(publicKey)}`, this.baseUrl),
				{ method: "GET" },
				REQUEST_TIMEOUT_MS,
			),
		);
	}

	/**
	 * Uploads one build as a file. With `publicKey` it updates that app and
	 * keeps the key; without it, Appetize creates a new app.
	 */
	async uploadApp(input: {
		/** The app to update, or undefined for a first upload. */
		publicKey: string | undefined;
		platform: DevicePlatform;
		/** The `.zip` or `.tar.gz` of an iOS simulator `.app`, or an Android `.apk`. */
		file: Blob;
		fileName: string;
		fileType: "zip" | "tar.gz" | "apk";
		/** Free text on the Appetize dashboard. The upload script writes the Expo Go version. */
		note: string;
	}): Promise<AppetizeApp> {
		const form = new FormData();
		form.set("platform", input.platform);
		form.set("fileType", input.fileType);
		form.set("note", input.note);
		form.set("file", input.file, input.fileName);
		const path =
			input.publicKey === undefined
				? "/v1/apps"
				: `/v1/apps/${encodeURIComponent(input.publicKey)}`;
		return appetizeAppSchema.parse(
			await this.request(
				new URL(path, this.baseUrl),
				{ method: "POST", body: form },
				UPLOAD_TIMEOUT_MS,
			),
		);
	}

	/** Writes the session settings of one app. The file stays the same. */
	async updateAppSettings(
		publicKey: string,
		settings: AppetizeAppSettings,
	): Promise<AppetizeApp> {
		return appetizeAppSchema.parse(
			await this.request(
				new URL(`/v1/apps/${encodeURIComponent(publicKey)}`, this.baseUrl),
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(settings),
				},
				REQUEST_TIMEOUT_MS,
			),
		);
	}

	/** One call with the API token. Returns the parsed JSON body; throws `AppetizeApiError` on failure. */
	private async request(
		url: URL,
		init: RequestInit,
		timeoutMs: number,
	): Promise<unknown> {
		const headers = new Headers(init.headers);
		headers.set("X-API-KEY", this.deps.token);
		let response: Response;
		try {
			response = await this.fetchImpl(url, {
				...init,
				headers,
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			throw new AppetizeApiError(
				`Appetize ${init.method} ${url.pathname} failed: ${getErrorMessage(error)}`,
				null,
			);
		}
		if (!response.ok) {
			throw new AppetizeApiError(
				`Appetize ${init.method} ${url.pathname} answered HTTP ${response.status}`,
				response.status,
			);
		}
		return response.json();
	}
}
