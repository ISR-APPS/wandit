/**
 * `DesktopBuildRunner` on the GitHub Actions REST API (docs/v2/desktop-apps.md
 * section 9). The `desktop-build` task dispatches and polls the `build.yml`
 * (Windows) or `build-macos.yml` (macOS) run in `DESKTOP_BUILD_REPO`;
 * `DesktopBuildsService.cancel` cancels it. Every answer passes a schema of
 * packages/contracts before use.
 */
import {
	type DesktopPlatform,
	type GithubWorkflowRun,
	githubDispatchResponseSchema,
	githubWorkflowJobsSchema,
	githubWorkflowRunSchema,
} from "@wandit/contracts";

import type {
	DesktopBuildDispatch,
	DesktopBuildDispatchInput,
	DesktopBuildRunner,
} from "../../domain/ports/desktop-build-runner";
import { DesktopBuildRunnerError } from "../../domain/ports/desktop-build-runner";
import type { V2EnvSource } from "../env/v2-env";

const GITHUB_API_BASE_URL = "https://api.github.com";
// The workflow file of each platform in tooling/desktop-builder, copied to the private repo.
const WORKFLOW_FILES = {
	macos: "build-macos.yml",
	windows: "build.yml",
} as const satisfies Record<DesktopPlatform, string>;
// The default branch of the private builder repo. Dispatch needs a ref,
// and only this branch holds the trusted workflow.
const WORKFLOW_REF = "main";
/** 15 s per call. A GitHub API call answers in well under a second. */
const GITHUB_TIMEOUT_MS = 15_000;
// A run id is a positive decimal integer. It goes into the URL path.
const RUN_ID_PATTERN = /^[1-9]\d{0,19}$/;
// The self-test step name in build.yml and build-macos.yml. A rename there must
// change it here too, else a failed self-test reads as `ci_failed`.
const SELF_TEST_STEP = "Self-test the installed app";

/** What the runner needs. The factory reads the env; the spec passes a fake fetch. */
export type GithubDesktopBuildRunnerConfig = {
	/** `DESKTOP_BUILD_GITHUB_TOKEN`. It goes only into the Authorization header. */
	token: string;
	/** `DESKTOP_BUILD_REPO`, `<owner>/<repo>`. The env schema checks the shape. */
	repo: string;
	/** `globalThis.fetch` in production. */
	fetch: typeof fetch;
};

/** The GitHub REST client of desktop builds. */
export class GithubDesktopBuildRunner implements DesktopBuildRunner {
	constructor(private readonly config: GithubDesktopBuildRunnerConfig) {}

	/**
	 * POSTs a dispatch of the workflow of `input.platform` with
	 * `return_run_details`, so GitHub answers the run id.
	 */
	async dispatch(
		input: DesktopBuildDispatchInput,
	): Promise<DesktopBuildDispatch> {
		const response = await this.call(
			"dispatch",
			`/actions/workflows/${WORKFLOW_FILES[input.platform]}/dispatches`,
			{
				body: JSON.stringify({
					inputs: {
						build_id: input.buildId,
						input_sha256: input.inputSha256,
						input_url: input.inputUrl,
						output_url: input.outputUrl,
						// GitHub refuses an input that the workflow does not declare,
						// and only build-macos.yml declares `update_url`.
						...(input.platform === "macos"
							? { update_url: input.updateUrl }
							: {}),
					},
					ref: WORKFLOW_REF,
					return_run_details: true,
				}),
				method: "POST",
			},
		);
		if (response.status !== 200) {
			throw this.failure("dispatch", response);
		}
		const parsed = githubDispatchResponseSchema.safeParse(
			await this.readJson("dispatch", response),
		);
		if (!parsed.success) {
			throw new DesktopBuildRunnerError(
				"GitHub dispatch answer has an unexpected shape",
				response.status,
			);
		}
		return {
			runId: String(parsed.data.workflow_run_id),
			runUrl: parsed.data.html_url,
		};
	}

	/** Reads one run. The task polls it until `status` is `completed`. */
	async getRun(runId: string): Promise<GithubWorkflowRun> {
		const response = await this.call(
			"get run",
			`/actions/runs/${checkedRunId(runId)}`,
			{ method: "GET" },
		);
		if (response.status !== 200) {
			throw this.failure("get run", response);
		}
		const parsed = githubWorkflowRunSchema.safeParse(
			await this.readJson("get run", response),
		);
		if (!parsed.success) {
			throw new DesktopBuildRunnerError(
				"GitHub run answer has an unexpected shape",
				response.status,
			);
		}
		return parsed.data;
	}

	/** Reads the jobs of the latest attempt of one run. Each step has its name and conclusion. */
	async hasFailedSelfTest(runId: string): Promise<boolean> {
		const response = await this.call(
			"list jobs",
			`/actions/runs/${checkedRunId(runId)}/jobs`,
			{ method: "GET" },
		);
		if (response.status !== 200) {
			throw this.failure("list jobs", response);
		}
		const parsed = githubWorkflowJobsSchema.safeParse(
			await this.readJson("list jobs", response),
		);
		if (!parsed.success) {
			throw new DesktopBuildRunnerError(
				"GitHub jobs answer has an unexpected shape",
				response.status,
			);
		}
		// A step after a failed step has the conclusion `skipped`, not `failure`.
		return parsed.data.jobs.some((job) =>
			job.steps.some(
				(step) => step.name === SELF_TEST_STEP && step.conclusion === "failure",
			),
		);
	}

	/** Asks GitHub to cancel one run. GitHub answers 409 for a run that already ended. */
	async cancel(runId: string): Promise<void> {
		const response = await this.call(
			"cancel run",
			`/actions/runs/${checkedRunId(runId)}/cancel`,
			{ method: "POST" },
		);
		if (response.status !== 202 && response.status !== 409) {
			throw this.failure("cancel run", response);
		}
	}

	// One request to the repo API. A network error or a timeout becomes a
	// runner error with no URL and no header in the message.
	private async call(
		operation: string,
		repoPath: string,
		init: { method: "GET" | "POST"; body?: string },
	): Promise<Response> {
		try {
			return await this.config.fetch(
				`${GITHUB_API_BASE_URL}/repos/${this.config.repo}${repoPath}`,
				{
					...init,
					headers: {
						Accept: "application/vnd.github+json",
						Authorization: `Bearer ${this.config.token}`,
						"Content-Type": "application/json",
						"X-GitHub-Api-Version": "2022-11-28",
					},
					signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
				},
			);
		} catch (error) {
			throw new DesktopBuildRunnerError(
				`GitHub ${operation} request failed`,
				null,
				{ cause: error },
			);
		}
	}

	private async readJson(
		operation: string,
		response: Response,
	): Promise<unknown> {
		try {
			return await response.json();
		} catch (error) {
			throw new DesktopBuildRunnerError(
				`GitHub ${operation} answer is not JSON`,
				response.status,
				{ cause: error },
			);
		}
	}

	// Security: the message never quotes the answer body. A 422 body can
	// echo the dispatch inputs, and those hold presigned URLs.
	private failure(
		operation: string,
		response: Response,
	): DesktopBuildRunnerError {
		const requestId = response.headers.get("x-github-request-id") ?? "none";
		return new DesktopBuildRunnerError(
			`GitHub ${operation} answered ${response.status} (request ${requestId})`,
			response.status,
		);
	}
}

function checkedRunId(runId: string): string {
	if (!RUN_ID_PATTERN.test(runId)) {
		throw new DesktopBuildRunnerError("The CI run id is not a number", null);
	}
	return runId;
}

/**
 * The runner of the API process. Null without DESKTOP_BUILD_GITHUB_TOKEN
 * or DESKTOP_BUILD_REPO: `DesktopBuildsService` then answers 503 on create
 * and logs a skipped cancel.
 */
export function desktopBuildRunnerFromEnv(
	v2Env: V2EnvSource,
): DesktopBuildRunner | null {
	const token = v2Env.DESKTOP_BUILD_GITHUB_TOKEN;
	const repo = v2Env.DESKTOP_BUILD_REPO;
	if (token === undefined || repo === undefined) {
		return null;
	}
	return new GithubDesktopBuildRunner({ fetch: globalThis.fetch, repo, token });
}
