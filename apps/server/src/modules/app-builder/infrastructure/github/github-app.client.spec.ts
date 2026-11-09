import { generateKeyPairSync } from "node:crypto";

import { ServiceUnavailableException } from "@nestjs/common";
import { jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2EnvSource } from "../env/v2-env";
import {
	GITHUB_READ_PERMISSIONS,
	GITHUB_SYNC_PERMISSIONS,
	GithubApiError,
	GithubAppClient,
	GithubOAuthRejectedError,
	GithubRepoExistsError,
} from "./github-app.client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
});

const ENV: V2EnvSource = {
	GITHUB_APP_CLIENT_ID: "Iv1.client",
	GITHUB_APP_CLIENT_SECRET: "client-secret",
	GITHUB_APP_ID: "123",
	GITHUB_APP_PRIVATE_KEY: privateKey
		.export({ format: "pem", type: "pkcs1" })
		.toString(),
	GITHUB_APP_SLUG: "wandit-dev",
	V2_HARNESS: "claude-code",
};

type RecordedCall = { url: string; init: RequestInit | undefined };

/** A client whose `fetch` answers `answers` in order and records each call. */
function makeClient(answers: Response[]) {
	const calls: RecordedCall[] = [];
	const fakeFetch: typeof fetch = async (input, init) => {
		calls.push({ init, url: String(input) });
		const answer = answers.shift();
		if (answer === undefined) {
			throw new Error("no scripted answer left");
		}
		return answer;
	};
	return { calls, client: new GithubAppClient(ENV, { fetch: fakeFetch }) };
}

/** A JSON answer. A body value is a string, a number, or one list of flat objects (REST `errors`). */
function json(
	status: number,
	body: Record<string, string | number | Record<string, string>[]>,
): Response {
	return new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
		status,
	});
}

afterEach(() => {
	vi.useRealTimers();
});

describe("GithubAppClient.refreshUserToken", () => {
	// The caller clears the stored tokens only on GithubOAuthRejectedError.
	// A wrong client secret must not make every user connect again.
	it.each([
		{ error: "bad_refresh_token", isDeadGrant: true },
		{ error: "incorrect_client_credentials", isDeadGrant: false },
	])("throws a $error answer with HTTP 200 as a dead grant: $isDeadGrant", async ({
		error,
		isDeadGrant,
	}) => {
		const { client } = makeClient([json(200, { error })]);

		const failure = await client
			.refreshUserToken("ghr_old")
			.catch((caught: unknown) => caught);

		expect(failure).toBeInstanceOf(GithubApiError);
		expect(failure instanceof GithubOAuthRejectedError).toBe(isDeadGrant);
		expect(failure).toMatchObject({ status: 200 });
	});

	it("sends a form body and turns the lifetimes in seconds into dates", async () => {
		vi.useFakeTimers({
			now: new Date("2026-11-04T10:00:00.000Z"),
			toFake: ["Date"],
		});
		const { calls, client } = makeClient([
			json(200, {
				access_token: "ghu_new",
				expires_in: 28_800,
				refresh_token: "ghr_new",
				refresh_token_expires_in: 15_897_600,
				scope: "",
				token_type: "bearer",
			}),
		]);

		const tokens = await client.refreshUserToken("ghr_old");

		expect(tokens).toEqual({
			accessToken: "ghu_new",
			accessTokenExpiresAt: new Date("2026-11-04T18:00:00.000Z"),
			refreshToken: "ghr_new",
			refreshTokenExpiresAt: new Date("2027-05-07T10:00:00.000Z"),
		});
		// Security: the secret and the refresh token never go in the URL.
		expect(calls[0]?.url).toBe("https://github.com/login/oauth/access_token");
		const form = new URLSearchParams(String(calls[0]?.init?.body));
		expect(form.get("client_secret")).toBe("client-secret");
		expect(form.get("refresh_token")).toBe("ghr_old");
	});
});

describe("GithubAppClient.installationToken", () => {
	it("caches one token per permission set and signs a 10-minute App JWT", async () => {
		const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
		const { calls, client } = makeClient([
			json(201, { expires_at: expiresAt, token: "ghs_read" }),
			json(201, { expires_at: expiresAt, token: "ghs_write" }),
		]);

		const tokens = [
			await client.installationToken(7, 42, GITHUB_READ_PERMISSIONS),
			await client.installationToken(7, 42, GITHUB_SYNC_PERMISSIONS),
			await client.installationToken(7, 42, GITHUB_READ_PERMISSIONS),
		];

		// Security: a read request never gets the cached write token.
		expect(tokens).toEqual(["ghs_read", "ghs_write", "ghs_read"]);
		expect(calls).toHaveLength(2);
		expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
			permissions: { contents: "write", workflows: "write" },
			repository_ids: [42],
		});
		const headers = new Headers(calls[0]?.init?.headers);
		const jwt = (headers.get("authorization") ?? "").replace("Bearer ", "");
		const { payload } = await jwtVerify(jwt, publicKey);
		expect(payload.iss).toBe("123");
		// GitHub refuses an App JWT that lives longer than 10 minutes.
		expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(600);
	});
});

describe("GithubAppClient.createRepository", () => {
	it("throws GithubRepoExistsError when only errors[].message names the taken name", async () => {
		const { client } = makeClient([
			json(422, {
				errors: [
					{ code: "custom", message: "name already exists on this account" },
				],
				message: "Repository creation failed.",
			}),
		]);

		const create = client.createRepository("ghu_user", {
			name: "my-app",
			ownerLogin: "octocat",
			ownerType: "User",
			private: true,
		});

		await expect(create).rejects.toBeInstanceOf(GithubRepoExistsError);
		await expect(create).rejects.toMatchObject({ status: 422 });
	});
});

describe("GithubAppClient.isValidWebhookSignature", () => {
	// The example of the GitHub docs page "Validating webhook deliveries".
	const SECRET = "It's a Secret to Everybody";
	const BODY = Buffer.from("Hello, World!");
	const GITHUB_SIGNATURE =
		"sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";
	const client = new GithubAppClient({
		...ENV,
		GITHUB_APP_WEBHOOK_SECRET: SECRET,
	});

	// Security: this check is the only gate of the public webhook route. A
	// signature of another length must answer false, not throw a 500.
	it.each([
		{
			isValid: true,
			name: "the GitHub docs signature",
			signature: GITHUB_SIGNATURE,
		},
		{
			isValid: false,
			name: "a wrong signature",
			signature: `sha256=${"0".repeat(64)}`,
		},
		{
			isValid: false,
			name: "a cut signature",
			signature: GITHUB_SIGNATURE.slice(0, 20),
		},
		{
			isValid: false,
			name: "the hex without its prefix",
			signature: GITHUB_SIGNATURE.slice(7),
		},
		{ isValid: false, name: "a missing header", signature: undefined },
	])("answers $isValid for $name", ({ isValid, signature }) => {
		expect(client.isValidWebhookSignature(BODY, signature)).toBe(isValid);
	});

	// Security: an HMAC with an empty key is easy to forge. Without the secret,
	// every delivery must fail.
	it("throws 503 for every delivery when the webhook secret is not set", () => {
		expect(() =>
			new GithubAppClient(ENV).isValidWebhookSignature(BODY, GITHUB_SIGNATURE),
		).toThrow(ServiceUnavailableException);
	});
});
