/**
 * `EasBuildRunner` on the eas CLI and the EAS GraphQL API (WANDIT-194).
 * The `mobile-build` task calls `start`, `view`, and `cancel`; the mobile
 * builds service calls `cancel`. `start` runs `eas` through `exec`
 * (`hostExec`); `view` and `cancel` POST to `https://api.expo.dev/graphql`.
 */
/*
 * eas-cli facts, read in the v24.8.0 source (packages/eas-cli/src):
 * - commands/project/init.ts: `--account`, `--[no-]icon`, `--json`, and
 *   `--non-interactive` exist. With `--json`, stdout holds one object with
 *   `projectId`.
 * - commands/build/index.ts: `--platform`, `--profile`, `--[no-]wait`,
 *   `--message`, `--json`, and `--non-interactive` exist. With `--no-wait`
 *   and `--json`, build/runBuildAndSubmit.ts prints a JSON array of builds.
 * - utils/json.ts: `--json` moves every other stdout write to stderr and
 *   drops each null key.
 * - api.ts and createGraphqlClient.ts: GraphQL at
 *   `https://api.expo.dev/graphql` with `authorization: Bearer <token>`.
 * - graphql/queries/BuildQuery.ts (`BuildsByIdQuery`) and
 *   commands/build/cancel.ts (`CancelBuildMutation`) hold the two operations.
 * UNVERIFIED: Expo does not document this GraphQL API as a stable contract.
 */
import {
	type EasBuild,
	type EasBuildStatus,
	easBuildCancelResponseSchema,
	easBuildStartOutputSchema,
	easBuildViewResponseSchema,
	easInitOutputSchema,
} from "@wandit/contracts";
import type { z } from "zod";

import {
	type EasBuildRunner,
	type EasBuildStartInput,
	EasRunnerError,
	type EasRunnerStep,
} from "../../domain/ports/eas-build-runner";
import type { SandboxHandle } from "../../domain/ports/sandbox-provider";
import type { V2EnvSource } from "../env/v2-env";
import { hostExec } from "./host-exec";

// `eas init` makes one or two GraphQL calls to create or link the project.
// 3 min also covers a slow Expo API.
const EAS_INIT_TIMEOUT_MS = 3 * 60_000;

// `eas build` packs and uploads the project, then queues the build. 15 min
// covers a large upload on a slow link.
const EAS_BUILD_TIMEOUT_MS = 15 * 60_000;

// One GraphQL round trip gets 30 s, like the other API clients here.
const GRAPHQL_TIMEOUT_MS = 30_000;

const EAS_GRAPHQL_URL = "https://api.expo.dev/graphql";

// `mobile_builds.error_message` holds at most 500 characters.
const ERROR_MESSAGE_MAX_CHARS = 500;

// A GraphQL error text from Expo is cut to this length in a thrown message.
const GRAPHQL_ERROR_MAX_CHARS = 200;

// Only the fields of `easBuildSchema` are selected.
const BUILD_BY_ID_QUERY = `query BuildsByIdQuery($buildId: ID!) {
  builds {
    byId(buildId: $buildId) {
      id
      status
      error { errorCode message }
      artifacts { buildUrl }
    }
  }
}`;

const CANCEL_BUILD_MUTATION = `mutation CancelBuildMutation($buildId: ID!) {
  build {
    cancelBuild(buildId: $buildId) { id status }
  }
}`;

// A build in one of these statuses cannot change any more.
const ENDED_EAS_STATUSES: readonly EasBuildStatus[] = [
	"FINISHED",
	"ERRORED",
	"CANCELED",
];

/** Settings of `EasCliBuildRunner`. `easBuildRunnerFromEnv` fills them in production. */
export type EasCliBuildRunnerOptions = {
	/** `EXPO_TOKEN`: an Expo access token. Only the eas process and the GraphQL header get it. */
	token: string;
	/** `EXPO_ACCOUNT`: the Expo organization that owns every wandit EAS project. */
	account: string;
	/** Runs one child process. Default `hostExec`; specs pass a fake. */
	exec?: SandboxHandle["exec"];
	/** Default `globalThis.fetch`; specs pass a fake. */
	fetch?: typeof globalThis.fetch;
};

/** The GraphQL answer fields that `requestGraphql` reads before the caller reads `data`. */
type GraphqlAnswer = { errors?: { message: string }[] | undefined };

/**
 * Runs the eas CLI in a prepared project folder and reads builds over
 * GraphQL. It carries no Nest decorators: the Trigger task composes it by
 * hand, and the module binds `easBuildRunnerFromEnv`.
 */
export class EasCliBuildRunner implements EasBuildRunner {
	private readonly token: string;
	private readonly account: string;
	private readonly exec: SandboxHandle["exec"];
	private readonly fetch: typeof globalThis.fetch;

	constructor(options: EasCliBuildRunnerOptions) {
		this.token = options.token;
		this.account = options.account;
		this.exec = options.exec ?? hostExec;
		this.fetch = options.fetch ?? globalThis.fetch;
	}

	async start(input: EasBuildStartInput): Promise<EasBuild> {
		// `--no-icon`: the icon upload reads the file that app.json names,
		// and a user file must never leave the worker through that path.
		const init = await this.runEas(
			"init",
			[
				"init",
				"--non-interactive",
				"--json",
				"--account",
				this.account,
				"--no-icon",
			],
			input.projectDir,
			EAS_INIT_TIMEOUT_MS,
		);
		this.parseStdout("init", init, easInitOutputSchema);

		const build = await this.runEas(
			"build",
			[
				"build",
				"--platform",
				"android",
				"--profile",
				"apk",
				"--non-interactive",
				"--no-wait",
				"--json",
				"--message",
				`wandit ${input.buildId}`,
			],
			input.projectDir,
			EAS_BUILD_TIMEOUT_MS,
		);
		const [started] = this.parseStdout(
			"build",
			build,
			easBuildStartOutputSchema,
		);
		// The schema asks for at least one build; this check satisfies the type.
		if (started === undefined) {
			throw this.runnerError("build", "eas build printed no build", build);
		}
		return started;
	}

	async view(easBuildId: string): Promise<EasBuild> {
		const answer = await this.requestGraphql(
			BUILD_BY_ID_QUERY,
			easBuildId,
			easBuildViewResponseSchema,
		);
		const build = answer.data?.builds.byId;
		if (build === undefined) {
			throw new Error("EAS GraphQL answered no build data");
		}
		return build;
	}

	async cancel(easBuildId: string): Promise<void> {
		const build = await this.view(easBuildId);
		// EAS cannot cancel an ended build. An ended build counts as done.
		if (ENDED_EAS_STATUSES.includes(build.status)) {
			return;
		}
		const answer = await this.requestGraphql(
			CANCEL_BUILD_MUTATION,
			easBuildId,
			easBuildCancelResponseSchema,
		);
		if (answer.data === null || answer.data === undefined) {
			throw new Error("EAS GraphQL answered no cancel data");
		}
	}

	// Runs one eas command in `projectDir`. A non-zero exit throws.
	private async runEas(
		step: EasRunnerStep,
		args: string[],
		projectDir: string,
		timeoutMs: number,
	): Promise<{ stdout: string; stderr: string }> {
		const result = await this.exec("eas", args, {
			cwd: projectDir,
			// `exec` adds PATH, HOME, CI=1, and GIT_TERMINAL_PROMPT=0. Only
			// this process gets the token.
			env: {
				EXPO_TOKEN: this.token,
				// Security: without it, eas loads `expo/fingerprint` and the user
				// `fingerprint.config.js` in this process, which holds EXPO_TOKEN.
				// Also, an APK without EAS Update does not need the fingerprint.
				EAS_SKIP_AUTO_FINGERPRINT: "1",
				// The expo CLI that eas starts reads it; eas-cli itself does not.
				EXPO_NO_TELEMETRY: "1",
				// The Expo Go warning checks only a `production` profile. The
				// flag keeps it off if a profile gets that name.
				EAS_BUILD_NO_EXPO_GO_WARNING: "1",
			},
			timeoutMs,
		});
		if (result.exitCode !== 0) {
			throw this.runnerError(
				step,
				`eas ${step} exited with ${result.exitCode}`,
				result,
			);
		}
		return result;
	}

	// Parses the JSON stdout of one eas command. Invalid JSON or an unknown
	// shape throws with the end of stderr.
	private parseStdout<Schema extends z.ZodType>(
		step: EasRunnerStep,
		output: { stdout: string; stderr: string },
		schema: Schema,
	): z.output<Schema> {
		let json: unknown;
		try {
			json = JSON.parse(output.stdout);
		} catch {
			// The SyntaxError text quotes stdout; stderr explains the failure.
			throw this.runnerError(step, `eas ${step} printed no JSON`, output);
		}
		const parsed = schema.safeParse(json);
		if (!parsed.success) {
			throw this.runnerError(
				step,
				`eas ${step} printed an unknown JSON shape`,
				output,
			);
		}
		return parsed.data;
	}

	// A message of at most 500 characters: the reason, then the end of
	// stderr. The token is masked before the cut, so no part of it remains.
	private runnerError(
		step: EasRunnerStep,
		reason: string,
		output: { stderr: string },
	): EasRunnerError {
		const stderr = output.stderr.replaceAll(this.token, "***").trim();
		const room = ERROR_MESSAGE_MAX_CHARS - reason.length - 2;
		const detail = stderr.slice(-room);
		return new EasRunnerError(
			step,
			detail === "" ? reason : `${reason}: ${detail}`,
		);
	}

	// One GraphQL call about one build. A non-2xx answer, a body that fails
	// the schema, or an `errors` entry throws a short Error.
	private async requestGraphql<Answer extends GraphqlAnswer>(
		query: string,
		buildId: string,
		schema: z.ZodType<Answer>,
	): Promise<Answer> {
		const response = await this.fetch(EAS_GRAPHQL_URL, {
			method: "POST",
			headers: {
				authorization: `Bearer ${this.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ query, variables: { buildId } }),
			signal: AbortSignal.timeout(GRAPHQL_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new Error(`EAS GraphQL answered ${response.status}`);
		}
		let json: unknown;
		try {
			json = await response.json();
		} catch {
			// The body is not JSON; its text is not useful in the message.
			throw new Error("EAS GraphQL answered a body that is not JSON");
		}
		const parsed = schema.safeParse(json);
		if (!parsed.success) {
			throw new Error("EAS GraphQL answered an unknown shape");
		}
		const [firstError] = parsed.data.errors ?? [];
		if (firstError !== undefined) {
			throw new Error(
				`EAS GraphQL error: ${firstError.message.slice(0, GRAPHQL_ERROR_MAX_CHARS)}`,
			);
		}
		return parsed.data;
	}
}

/**
 * The runner of the API and the worker, or null when `EXPO_TOKEN` or
 * `EXPO_ACCOUNT` is unset. The API then answers 503 and the task fails
 * the build with `unconfigured`.
 */
export function easBuildRunnerFromEnv(
	source: V2EnvSource,
): EasBuildRunner | null {
	const token = source.EXPO_TOKEN;
	const account = source.EXPO_ACCOUNT;
	if (token === undefined || account === undefined) {
		return null;
	}
	return new EasCliBuildRunner({ token, account });
}
