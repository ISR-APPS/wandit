import { createHmac } from "node:crypto";

import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
	LLM_PROXY_TOKEN_TTL_SECONDS,
	type LlmProxyTokenClaimsInput,
	LlmProxyTokenError,
	mintLlmProxyToken,
	verifyLlmProxyToken,
} from "./llm-proxy-token.service";

const NOW_SECONDS = 1_800_000_000;

const claims: LlmProxyTokenClaimsInput = {
	runId: "run_abc",
	turnId: "11111111-2222-4333-8444-555555555555",
	userId: "user_1",
	projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
	workspaceId: null,
	plan: "pro",
	capUsd: 0.5,
};

const env = { LLM_PROXY_SIGNING_KEY: "key-one,key-two" };

describe("mintLlmProxyToken and verifyLlmProxyToken", () => {
	it("round-trips claims and sets exp 65 minutes out", () => {
		const token = mintLlmProxyToken(claims, env, NOW_SECONDS);
		const verified = verifyLlmProxyToken(token, env, NOW_SECONDS);

		expect(verified).toEqual({
			...claims,
			exp: NOW_SECONDS + LLM_PROXY_TOKEN_TTL_SECONDS,
		});
	});

	it("accepts a token signed with the second key", () => {
		const payload = { ...claims, exp: NOW_SECONDS + 60 };
		const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
			"base64url",
		);
		const signature = createHmac("sha256", "key-two")
			.update(encoded)
			.digest("base64url");

		expect(
			verifyLlmProxyToken(`${encoded}.${signature}`, env, NOW_SECONDS),
		).toEqual(payload);
	});

	it("rejects an expired token", () => {
		const token = mintLlmProxyToken(claims, env, NOW_SECONDS);
		expect(() =>
			verifyLlmProxyToken(
				token,
				env,
				NOW_SECONDS + LLM_PROXY_TOKEN_TTL_SECONDS + 1,
			),
		).toThrow(LlmProxyTokenError);
	});

	it("rejects a token signed with an unknown key", () => {
		const token = mintLlmProxyToken(claims, env, NOW_SECONDS);
		expect(() =>
			verifyLlmProxyToken(
				token,
				{ LLM_PROXY_SIGNING_KEY: "other" },
				NOW_SECONDS,
			),
		).toThrow(LlmProxyTokenError);
	});

	it("rejects a tampered payload and a malformed token", () => {
		const token = mintLlmProxyToken(claims, env, NOW_SECONDS);
		const [payload, signature] = token.split(".");
		const tampered = Buffer.from(
			JSON.stringify({ ...claims, exp: NOW_SECONDS + 99999, capUsd: 999 }),
			"utf8",
		).toString("base64url");

		expect(() =>
			verifyLlmProxyToken(`${tampered}.${signature}`, env, NOW_SECONDS),
		).toThrow(LlmProxyTokenError);
		expect(() => verifyLlmProxyToken("no-dot", env, NOW_SECONDS)).toThrow(
			LlmProxyTokenError,
		);
		expect(() =>
			verifyLlmProxyToken(`${payload}.${payload}.${payload}`, env, NOW_SECONDS),
		).toThrow(LlmProxyTokenError);
	});

	it("rejects a token whose claims fail the schema", () => {
		const encoded = Buffer.from(
			JSON.stringify({ runId: "run_1" }),
			"utf8",
		).toString("base64url");
		const signature = createHmac("sha256", "key-one")
			.update(encoded)
			.digest("base64url");

		expect(() =>
			verifyLlmProxyToken(`${encoded}.${signature}`, env, NOW_SECONDS),
		).toThrow(LlmProxyTokenError);
	});

	it("throws V2_ENV_MISSING when no signing key is configured", () => {
		expect(() => mintLlmProxyToken(claims, {})).toThrow(
			ServiceUnavailableException,
		);
		expect(() => verifyLlmProxyToken("a.b", {})).toThrow(
			ServiceUnavailableException,
		);
	});
});
