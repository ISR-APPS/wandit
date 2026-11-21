import { describe, expect, it } from "vitest";

import {
	LlmProxyTokenError,
	mintLlmProxyToken,
	verifyLlmProxyToken,
} from "../application/services/llm-proxy-token.service";
import {
	APP_AI_VIDEO_TOKEN_TTL_SECONDS,
	AppAiVideoTokenError,
	type AppAiVideoTokenInput,
	appAiVideoUpstreamFields,
	mintAppAiVideoToken,
	verifyAppAiVideoBillingToken,
	verifyAppAiVideoJobToken,
} from "./app-ai-video-job";

const NOW_SECONDS = 1_800_000_000;
const KEYS = ["key-one", "key-two"] as const;

const BILLING = {
	projectId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
	eventId: "11111111-2222-4333-8444-555555555555",
	model: "heygen/heygen-video-1",
	seconds: 5,
	resolution: "480p",
	audio: false,
	costUsdMicros: 50_000,
	usdMicrosPerSecond: 10_000,
	usdMicrosPerCredit: 32_000,
} as const;

const JOB: AppAiVideoTokenInput = {
	kind: "app_ai_video_job",
	...BILLING,
	operation: { gatewayJobId: "job_1" },
};

const BILLING_TOKEN: AppAiVideoTokenInput = {
	kind: "app_ai_video_billing",
	...BILLING,
};

// Swaps the payload of a token and keeps its signature.
function withPayload(
	token: string,
	payload: AppAiVideoTokenInput & { exp: number },
): string {
	const signature = token.slice(token.indexOf(".") + 1);
	const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
		"base64url",
	);
	return `${encoded}.${signature}`;
}

const BASE64URL_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Swaps the last signature character for its neighbour. The two low bits of
// that character are spare bits, so a lenient decode gives the same bytes.
function withSpareBitsChanged(token: string): string {
	const index = BASE64URL_ALPHABET.indexOf(token.slice(-1));
	return `${token.slice(0, -1)}${BASE64URL_ALPHABET[index ^ 1]}`;
}

describe("video job tokens", () => {
	// Security: each of these tokens must never open a job or settle a hold.
	it.each([
		[
			"a job token signed with another key",
			() => verifyAppAiVideoJobToken(mintAppAiVideoToken(JOB, ["other"]), KEYS),
		],
		[
			"a job token with a changed payload",
			() =>
				verifyAppAiVideoJobToken(
					withPayload(mintAppAiVideoToken(JOB, KEYS, NOW_SECONDS), {
						...JOB,
						projectId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
						exp: NOW_SECONDS + APP_AI_VIDEO_TOKEN_TTL_SECONDS,
					}),
					KEYS,
					NOW_SECONDS,
				),
		],
		[
			"an expired job token",
			() =>
				verifyAppAiVideoJobToken(
					mintAppAiVideoToken(JOB, KEYS, NOW_SECONDS),
					KEYS,
					NOW_SECONDS + APP_AI_VIDEO_TOKEN_TTL_SECONDS,
				),
		],
		[
			"an LLM proxy run token as a job token",
			() =>
				verifyAppAiVideoJobToken(
					mintLlmProxyToken(
						{
							runId: "run_1",
							turnId: BILLING.eventId,
							userId: "user_1",
							projectId: BILLING.projectId,
							workspaceId: null,
							plan: "pro",
							capUsd: 0.5,
						},
						{ LLM_PROXY_SIGNING_KEY: KEYS.join(",") },
					),
					KEYS,
				),
		],
		[
			"a billing token as a job token",
			() =>
				verifyAppAiVideoJobToken(
					mintAppAiVideoToken(BILLING_TOKEN, KEYS),
					KEYS,
				),
		],
		[
			"a job token as a billing token",
			() => verifyAppAiVideoBillingToken(mintAppAiVideoToken(JOB, KEYS), KEYS),
		],
		[
			"a job token with other spare bits in the signature",
			() =>
				verifyAppAiVideoJobToken(
					withSpareBitsChanged(mintAppAiVideoToken(JOB, KEYS)),
					KEYS,
				),
		],
		[
			"a job token with a padding character",
			() =>
				verifyAppAiVideoJobToken(`${mintAppAiVideoToken(JOB, KEYS)}=`, KEYS),
		],
	])("refuses %s", (_label, verify) => {
		expect(verify).toThrow(AppAiVideoTokenError);
	});

	// Security: the app holds a job token and the gateway holds a billing token.
	// Both use the run token key, so neither may open the LLM proxy.
	it.each([
		["a job token", JOB],
		["a billing token", BILLING_TOKEN],
	])("refuses %s as an LLM proxy run token", (_label, input) => {
		expect(() =>
			verifyLlmProxyToken(mintAppAiVideoToken(input, KEYS), {
				LLM_PROXY_SIGNING_KEY: KEYS.join(","),
			}),
		).toThrow(LlmProxyTokenError);
	});

	// Key rotation: a job started before the rotation still reads its video.
	it("accepts a job token signed with a later key of the list", () => {
		const token = mintAppAiVideoToken(JOB, ["key-two"], NOW_SECONDS);

		expect(verifyAppAiVideoJobToken(token, KEYS, NOW_SECONDS)).toMatchObject({
			kind: "app_ai_video_job",
			projectId: BILLING.projectId,
			operation: { gatewayJobId: "job_1" },
		});
	});
});

describe("appAiVideoUpstreamFields", () => {
	// Money: each provider reads the tier from its own field. A wrong field
	// runs the default tier: MiniMax 768P costs 0.08 USD a second, 480P 0.05.
	it.each([
		[
			"bytedance/seedance-2.5",
			"480p",
			{
				resolution: "864x480",
				providerOptions: { gateway: { only: ["bytedance"] } },
			},
		],
		[
			"bytedance/seedance-2.5-flash",
			"720p",
			{
				resolution: "1280x720",
				providerOptions: { gateway: { only: ["bytedance"] } },
			},
		],
		[
			"bytedance/seedance-2.5",
			"1080p",
			{
				resolution: "1920x1080",
				providerOptions: { gateway: { only: ["bytedance"] } },
			},
		],
		[
			"heygen/heygen-video-1",
			"2k",
			{ providerOptions: { heygen: { resolution: "2k" } } },
		],
		[
			"minimax/minimax-h3-max",
			"768p",
			{ providerOptions: { minimax: { resolution: "768P" } } },
		],
		[
			"minimax/minimax-h3-max",
			"480p",
			{ providerOptions: { minimax: { resolution: "480P" } } },
		],
		// A pair that the capability table refuses gets no fields.
		["bytedance/seedance-2.5-flash", "1080p", null],
		["minimax/minimax-h3-max", "720p", null],
	] as const)("gives the fields of %s at %s", (model, resolution, expected) => {
		expect(appAiVideoUpstreamFields(model, resolution)).toEqual(expected);
	});
});
