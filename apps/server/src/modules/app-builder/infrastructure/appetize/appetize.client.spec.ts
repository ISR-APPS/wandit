import { describe, expect, it } from "vitest";

import { AppetizeApiError, AppetizeClient } from "./appetize.client";

type Call = { url: string; init: RequestInit | undefined };

/** A fetch that answers `body` with `status` and records each call. */
function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
	const fetchImpl: typeof fetch = async (input, init) => {
		calls.push({ url: String(input), init });
		return Response.json(body, { status });
	};
	return fetchImpl;
}

describe("AppetizeClient", () => {
	it("finds the session of a token with the API key and the start date", async () => {
		const calls: Call[] = [];
		const client = new AppetizeClient({
			token: "appetize-token",
			fetch: fakeFetch(
				200,
				{
					results: [
						{
							sessionToken: "other",
							startTime: null,
							closeTime: null,
						},
						{
							sessionToken: "tok_1",
							startTime: "2026-09-26T10:00:00.000Z",
							closeTime: "2026-09-26T10:03:10+00:00",
							device: "pixel8",
						},
					],
					nextPage: null,
				},
				calls,
			),
		});

		const session = await client.getSession("tok_1", "2026-09-26");

		expect(session).toEqual({
			sessionToken: "tok_1",
			startTime: "2026-09-26T10:00:00.000Z",
			closeTime: "2026-09-26T10:03:10+00:00",
		});
		expect(calls[0]?.url).toBe(
			"https://api.appetize.io/v2/sessions?sessionToken=tok_1&startDate=2026-09-26",
		);
		expect(new Headers(calls[0]?.init?.headers).get("x-api-key")).toBe(
			"appetize-token",
		);
	});

	it("answers null when Appetize lists no session for the token", async () => {
		const client = new AppetizeClient({
			token: "t",
			fetch: fakeFetch(200, { results: [] }),
		});

		expect(await client.getSession("tok_1", "2026-09-26")).toBeNull();
	});

	it("drops the private key of a v1 answer and never quotes a failed body", async () => {
		const client = new AppetizeClient({
			token: "t",
			fetch: fakeFetch(200, {
				publicKey: "pk_1",
				privateKey: "secret-private-key",
				platform: "ios",
				versionCode: 3,
				note: "expo-go:57.0.9",
			}),
		});
		const failing = new AppetizeClient({
			token: "t",
			fetch: fakeFetch(403, { message: "secret detail" }),
		});

		expect(await client.getApp("pk_1")).toEqual({
			publicKey: "pk_1",
			platform: "ios",
			versionCode: 3,
			note: "expo-go:57.0.9",
		});
		const failure = await failing
			.getApp("pk_1")
			.catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(AppetizeApiError);
		expect(failure).toMatchObject({ status: 403 });
		expect(String(failure)).not.toContain("secret detail");
	});

	it("uploads a file to the update route of an existing key as multipart", async () => {
		const calls: Call[] = [];
		const client = new AppetizeClient({
			token: "t",
			fetch: fakeFetch(
				200,
				{ publicKey: "pk_1", platform: "android", note: "expo-go:57.0.9" },
				calls,
			),
		});

		await client.uploadApp({
			publicKey: "pk_1",
			platform: "android",
			file: new Blob(["apk"]),
			fileName: "Expo-Go-57.0.9.apk",
			fileType: "apk",
			note: "expo-go:57.0.9",
		});

		expect(calls[0]?.url).toBe("https://api.appetize.io/v1/apps/pk_1");
		const form = calls[0]?.init?.body;
		if (!(form instanceof FormData)) {
			throw new Error("upload body is not multipart");
		}
		expect(form.get("platform")).toBe("android");
		expect(form.get("fileType")).toBe("apk");
		expect(form.get("note")).toBe("expo-go:57.0.9");
		expect(form.get("file")).toBeInstanceOf(Blob);
	});
});
