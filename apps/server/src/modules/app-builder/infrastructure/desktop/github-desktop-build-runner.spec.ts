import { describe, expect, it, vi } from "vitest";

import { DesktopBuildRunnerError } from "../../domain/ports/desktop-build-runner";
import { GithubDesktopBuildRunner } from "./github-desktop-build-runner";

const TOKEN = "github_pat_secret_value_123";
const INPUT_URL =
	"https://r2.example/desktop/p/inputs/b-1.tar.gz?X-Amz-Signature=input-signature";
const OUTPUT_URL =
	"https://r2.example/desktop/p/staging/b-1.exe?X-Amz-Signature=output-signature";
const UPDATE_URL =
	"https://r2.example/desktop/p/staging/b-1.app.tar.gz?X-Amz-Signature=update-signature";
const DISPATCH = {
	buildId: "22222222-2222-4222-8222-222222222222",
	inputSha256: "a".repeat(64),
	inputUrl: INPUT_URL,
	engine: "tauri",
	outputUrl: OUTPUT_URL,
	platform: "windows",
} as const;
const DISPATCH_INPUTS = {
	build_id: DISPATCH.buildId,
	input_sha256: DISPATCH.inputSha256,
	input_url: INPUT_URL,
	output_url: OUTPUT_URL,
};

function runnerAnswering(response: Response | Error) {
	const fetch = vi.fn<typeof globalThis.fetch>(async () => {
		if (response instanceof Error) {
			throw response;
		}
		return response;
	});
	const runner = new GithubDesktopBuildRunner({
		fetch,
		repo: "wandit/desktop-builder",
		token: TOKEN,
	});
	return { fetch, runner };
}

function json(status: number, body: Record<string, string | number>): Response {
	return new Response(JSON.stringify(body), {
		headers: { "x-github-request-id": "ABCD:1234" },
		status,
	});
}

describe("GithubDesktopBuildRunner", () => {
	// GitHub refuses an input that the workflow does not declare, so a Windows
	// dispatch with `update_url` fails, and a macOS one without it cannot upload.
	it.each([
		{
			input: DISPATCH,
			inputs: DISPATCH_INPUTS,
			workflow: "build.yml",
		},
		{
			input: { ...DISPATCH, platform: "macos", updateUrl: UPDATE_URL } as const,
			inputs: { ...DISPATCH_INPUTS, update_url: UPDATE_URL },
			workflow: "build-macos.yml",
		},
		{
			input: { ...DISPATCH, engine: "electron" } as const,
			inputs: DISPATCH_INPUTS,
			workflow: "build-electron.yml",
		},
		// An Electron Mac app updates from the disk image: no `update_url`.
		{
			input: { ...DISPATCH, engine: "electron", platform: "macos" } as const,
			inputs: DISPATCH_INPUTS,
			workflow: "build-electron-macos.yml",
		},
	])("dispatches $workflow on main with run details and answers the parsed run", async ({
		input,
		inputs,
		workflow,
	}) => {
		const { fetch, runner } = runnerAnswering(
			json(200, {
				html_url: "https://github.com/wandit/desktop-builder/actions/runs/987",
				run_url:
					"https://api.github.com/repos/wandit/desktop-builder/actions/runs/987",
				workflow_run_id: 987,
			}),
		);

		const run = await runner.dispatch(input);

		expect(run).toEqual({
			runId: "987",
			runUrl: "https://github.com/wandit/desktop-builder/actions/runs/987",
		});
		const [url, init] = fetch.mock.calls[0] ?? [];
		expect(url).toBe(
			`https://api.github.com/repos/wandit/desktop-builder/actions/workflows/${workflow}/dispatches`,
		);
		expect(JSON.parse(String(init?.body))).toEqual({
			inputs,
			ref: "main",
			return_run_details: true,
		});
		expect(new Headers(init?.headers).get("authorization")).toBe(
			`Bearer ${TOKEN}`,
		);
	});

	// A 422 body can echo the inputs. The error goes to the build row, so it
	// must hold neither the token nor a presigned URL.
	it.each([
		{
			name: "a refused dispatch",
			response: json(422, {
				message: `Bad inputs ${INPUT_URL} ${OUTPUT_URL} ${TOKEN}`,
			}),
			status: 422,
		},
		{
			name: "an answer of the wrong shape",
			response: json(200, { workflow_run_id: "987", token: TOKEN }),
			status: 200,
		},
		{
			name: "a network error",
			response: new Error(`connect failed for ${INPUT_URL}`),
			status: null,
		},
	])("throws a clean error for $name", async ({ response, status }) => {
		const { runner } = runnerAnswering(response);

		const error = await runner.dispatch(DISPATCH).then(
			() => new Error("The dispatch did not fail"),
			(caught: unknown) => caught,
		);

		if (!(error instanceof DesktopBuildRunnerError)) {
			throw new Error(`Expected a DesktopBuildRunnerError, got ${error}`);
		}
		expect(error.status).toBe(status);
		expect(error.message).not.toContain(TOKEN);
		expect(error.message).not.toContain("X-Amz-Signature");
	});

	// Only a failed self-test step gets `self_test_failed`. After an earlier
	// failure, GitHub marks the self-test step `skipped`.
	it.each([
		["the self-test step failed", "success", "failure", true],
		["the build step failed", "failure", "skipped", false],
	])("reads the jobs answer when %s", async (_label, build, selfTest, failed) => {
		const { runner } = runnerAnswering(
			new Response(
				JSON.stringify({
					jobs: [
						{
							id: 1,
							steps: [
								{ conclusion: build, name: "Build the installer", number: 7 },
								{
									conclusion: selfTest,
									name: "Self-test the installed app",
									number: 9,
								},
							],
						},
					],
					total_count: 1,
				}),
				{ status: 200 },
			),
		);

		await expect(runner.hasFailedSelfTest("987")).resolves.toBe(failed);
	});

	it("treats the 409 of a run that already ended as a done cancel", async () => {
		const { runner } = runnerAnswering(
			json(409, { message: "Cannot cancel a workflow run that is completed." }),
		);

		await expect(runner.cancel("987")).resolves.toBeUndefined();
	});
});
