import { describe, expect, it } from "vitest";

import { EasRunnerError } from "../../domain/ports/eas-build-runner";
import type {
	SandboxExecOptions,
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import type { V2EnvSource } from "../env/v2-env";
import { EasCliBuildRunner, easBuildRunnerFromEnv } from "./eas-build-runner";

const TOKEN = "expo-robot-token-123";
const ACCOUNT = "wandit";
const PROJECT_DIR = "/tmp/wandit-mobile-build-x/app";
const BUILD_ID = "0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10";
const APK_URL = "https://expo.dev/artifacts/eas/abc.apk";

type ExecCall = {
	command: string;
	args: string[];
	options: SandboxExecOptions | undefined;
};

/** Answers each exec call with the next queued result and records the call. */
function fakeExec(answers: SandboxExecResult[]) {
	const calls: ExecCall[] = [];
	const exec: SandboxHandle["exec"] = async (command, args, options) => {
		calls.push({ command, args, options });
		const answer = answers.shift();
		if (answer === undefined) {
			throw new Error(`no fake answer for ${command} ${args.join(" ")}`);
		}
		return answer;
	};
	return { calls, exec };
}

type FetchCall = { url: string; init: RequestInit | undefined };

/** Answers each fetch with the next queued response and records the call. */
function fakeFetch(answers: Response[]) {
	const calls: FetchCall[] = [];
	const fetch: typeof globalThis.fetch = async (input, init) => {
		calls.push({ url: String(input), init });
		const answer = answers.shift();
		if (answer === undefined) {
			throw new Error("no fake fetch answer");
		}
		return answer;
	};
	return { calls, fetch };
}

function ok(stdout: string): SandboxExecResult {
	return { exitCode: 0, stdout, stderr: "" };
}

function json(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function viewAnswer(status: string): Response {
	return json({ data: { builds: { byId: { id: "eas-1", status } } } });
}

const INIT_STDOUT = JSON.stringify({
	status: "created",
	projectId: "eas-project-1",
	owner: ACCOUNT,
	slug: "p0f3c",
});
const BUILD_STDOUT = JSON.stringify([
	{ id: "eas-1", status: "IN_QUEUE", platform: "ANDROID" },
]);

function runner(
	exec: SandboxHandle["exec"],
	fetch: typeof globalThis.fetch = fakeFetch([]).fetch,
) {
	return new EasCliBuildRunner({ token: TOKEN, account: ACCOUNT, exec, fetch });
}

describe("EasCliBuildRunner.start", () => {
	it("runs eas init then eas build in the project folder and answers the queued build", async () => {
		const { calls, exec } = fakeExec([ok(INIT_STDOUT), ok(BUILD_STDOUT)]);

		const build = await runner(exec).start({
			projectDir: PROJECT_DIR,
			buildId: BUILD_ID,
		});

		expect(build).toEqual({ id: "eas-1", status: "IN_QUEUE" });
		expect(calls.map((call) => [call.command, ...call.args].join(" "))).toEqual(
			[
				"eas init --non-interactive --json --account wandit --no-icon",
				`eas build --platform android --profile apk --non-interactive --no-wait --json --message wandit ${BUILD_ID}`,
			],
		);
		expect(calls[0]?.options).toEqual({
			cwd: PROJECT_DIR,
			env: {
				EXPO_TOKEN: TOKEN,
				EAS_SKIP_AUTO_FINGERPRINT: "1",
				EXPO_NO_TELEMETRY: "1",
				EAS_BUILD_NO_EXPO_GO_WARNING: "1",
			},
			timeoutMs: 180_000,
		});
		expect(calls[1]?.options?.timeoutMs).toBe(900_000);
	});

	it("throws step init when eas init fails, and never runs eas build", async () => {
		const { calls, exec } = fakeExec([
			{ exitCode: 1, stdout: "", stderr: "Error: account not found" },
		]);

		await expect(
			runner(exec).start({ projectDir: PROJECT_DIR, buildId: BUILD_ID }),
		).rejects.toMatchObject({
			name: "EasRunnerError",
			step: "init",
			message: "eas init exited with 1: Error: account not found",
		});
		expect(calls).toHaveLength(1);
	});

	it("throws step init when eas init prints text that is not JSON, and never runs eas build", async () => {
		const { calls, exec } = fakeExec([
			{ exitCode: 0, stdout: "text that is not JSON", stderr: "" },
		]);

		await expect(
			runner(exec).start({ projectDir: PROJECT_DIR, buildId: BUILD_ID }),
		).rejects.toMatchObject({
			name: "EasRunnerError",
			step: "init",
			message: "eas init printed no JSON",
		});
		expect(calls).toHaveLength(1);
	});

	it("masks the token and keeps at most 500 characters when eas build fails", async () => {
		const stderr = `${"x".repeat(900)} request failed with token ${TOKEN} at the end`;
		const { exec } = fakeExec([
			ok(INIT_STDOUT),
			{ exitCode: 1, stdout: "", stderr },
		]);

		const failure = await runner(exec)
			.start({ projectDir: PROJECT_DIR, buildId: BUILD_ID })
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(EasRunnerError);
		// SAFETY: toBeInstanceOf above proves the error type.
		const runnerError = failure as EasRunnerError;
		expect(runnerError.step).toBe("build");
		expect(runnerError.message).not.toContain(TOKEN);
		expect(runnerError.message).toContain("with token *** at the end");
		expect(runnerError.message.startsWith("eas build exited with 1: ")).toBe(
			true,
		);
		expect(runnerError.message.length).toBeLessThanOrEqual(500);
	});

	it.each([
		["text that is not JSON", "eas build printed no JSON"],
		["[]", "eas build printed an unknown JSON shape"],
	])("throws step build when eas build prints %s", async (stdout, reason) => {
		const { exec } = fakeExec([
			ok(INIT_STDOUT),
			{ exitCode: 0, stdout, stderr: "warning: slow network" },
		]);

		await expect(
			runner(exec).start({ projectDir: PROJECT_DIR, buildId: BUILD_ID }),
		).rejects.toMatchObject({
			name: "EasRunnerError",
			step: "build",
			message: `${reason}: warning: slow network`,
		});
	});
});

describe("EasCliBuildRunner.view", () => {
	it("posts BuildsByIdQuery with the token header and parses the build", async () => {
		const { calls, fetch } = fakeFetch([
			json({
				data: {
					builds: {
						byId: {
							id: "eas-1",
							status: "FINISHED",
							artifacts: { buildUrl: APK_URL },
							error: null,
						},
					},
				},
			}),
		]);

		const build = await runner(fakeExec([]).exec, fetch).view("eas-1");

		expect(build).toEqual({
			id: "eas-1",
			status: "FINISHED",
			artifacts: { buildUrl: APK_URL },
			error: null,
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://api.expo.dev/graphql");
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.init?.headers).toEqual({
			authorization: `Bearer ${TOKEN}`,
			"content-type": "application/json",
		});
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
			query: expect.stringContaining("query BuildsByIdQuery"),
			variables: { buildId: "eas-1" },
		});
	});

	it.each([
		[
			"a non-2xx answer",
			new Response("upstream down", { status: 502 }),
			"EAS GraphQL answered 502",
		],
		[
			"a body that is not JSON",
			new Response("<html>", { status: 200 }),
			"EAS GraphQL answered a body that is not JSON",
		],
		[
			"an unknown shape",
			json({ data: { builds: { byId: { id: "eas-1", status: "LOST" } } } }),
			"EAS GraphQL answered an unknown shape",
		],
		[
			"a GraphQL errors entry",
			json({ data: null, errors: [{ message: "Build not found" }] }),
			"EAS GraphQL error: Build not found",
		],
		[
			"no data and no errors",
			json({ data: null }),
			"EAS GraphQL answered no build data",
		],
	])("throws on %s", async (_case, answer, message) => {
		const { fetch } = fakeFetch([answer]);

		await expect(
			runner(fakeExec([]).exec, fetch).view("eas-1"),
		).rejects.toThrow(message);
	});
});

describe("EasCliBuildRunner.cancel", () => {
	it.each([
		"FINISHED",
		"ERRORED",
		"CANCELED",
	])("returns after the view when the build is %s", async (status) => {
		const { calls, fetch } = fakeFetch([viewAnswer(status)]);

		await runner(fakeExec([]).exec, fetch).cancel("eas-1");

		expect(calls).toHaveLength(1);
	});

	it("sends CancelBuildMutation for a live build", async () => {
		const { calls, fetch } = fakeFetch([
			viewAnswer("IN_PROGRESS"),
			json({
				data: {
					build: { cancelBuild: { id: "eas-1", status: "PENDING_CANCEL" } },
				},
			}),
		]);

		await runner(fakeExec([]).exec, fetch).cancel("eas-1");

		expect(calls).toHaveLength(2);
		expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
			query: expect.stringContaining("mutation CancelBuildMutation"),
			variables: { buildId: "eas-1" },
		});
	});

	it("throws when the cancel answer has no data", async () => {
		const { fetch } = fakeFetch([viewAnswer("IN_QUEUE"), json({ data: null })]);

		await expect(
			runner(fakeExec([]).exec, fetch).cancel("eas-1"),
		).rejects.toThrow("EAS GraphQL answered no cancel data");
	});
});

describe("easBuildRunnerFromEnv", () => {
	const BASE: V2EnvSource = { V2_HARNESS: "claude-code" };

	it("answers null when EXPO_TOKEN or EXPO_ACCOUNT is unset", () => {
		expect(
			easBuildRunnerFromEnv({ ...BASE, EXPO_ACCOUNT: ACCOUNT }),
		).toBeNull();
		expect(easBuildRunnerFromEnv({ ...BASE, EXPO_TOKEN: TOKEN })).toBeNull();
	});

	it("answers a runner when both are set", () => {
		expect(
			easBuildRunnerFromEnv({
				...BASE,
				EXPO_TOKEN: TOKEN,
				EXPO_ACCOUNT: ACCOUNT,
			}),
		).toBeInstanceOf(EasCliBuildRunner);
	});
});
