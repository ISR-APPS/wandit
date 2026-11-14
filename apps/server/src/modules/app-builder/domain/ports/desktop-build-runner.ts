/**
 * Port: the CI of desktop builds, one GitHub Actions workflow per
 * platform in the private repo `DESKTOP_BUILD_REPO` (docs/v2/desktop-apps.md
 * section 9), for each shell engine. The `desktop-build` task dispatches and polls runs; the desktop
 * builds service cancels them. `infrastructure/desktop/github-desktop-build-runner.ts`
 * implements it. Specs pass a fake.
 */
import type { DesktopEngine, GithubWorkflowRun } from "@wandit/contracts";

/** Nest token for the `DesktopBuildRunner` implementation. */
export const DESKTOP_BUILD_RUNNER = Symbol.for(
	"app-builder.desktop-build-runner",
);

// The inputs that both workflows declare.
type DesktopBuildDispatchBase = {
	/** `desktop_builds.id`. The workflow checks that it is a uuid. */
	buildId: string;
	/** Presigned GET URL of `desktop-input.tar.gz`, valid 2 h. */
	inputUrl: string;
	/** Lowercase hex SHA-256 of the input archive. The workflow checks the download with it. */
	inputSha256: string;
};

/**
 * The inputs of one workflow. `engine` and `platform` select the file:
 * `build.yml` and `build-macos.yml` (tauri), `build-electron.yml` and
 * `build-electron-macos.yml` (electron). The URLs are credentials: never log them.
 */
export type DesktopBuildDispatchInput =
	| (DesktopBuildDispatchBase & {
			platform: "windows";
			/** `projects.desktop_engine` of the build. Null there means `tauri`. */
			engine: DesktopEngine;
			/** Presigned PUT URL of the staged setup exe, valid 2 h. */
			outputUrl: string;
	  })
	| (DesktopBuildDispatchBase & {
			platform: "macos";
			engine: "tauri";
			/** Presigned PUT URL of the staged disk image, valid 2 h. */
			outputUrl: string;
			/** Presigned PUT URL of the staged `.app.tar.gz`, valid 2 h. */
			updateUrl: string;
	  })
	| (DesktopBuildDispatchBase & {
			platform: "macos";
			/** An Electron app updates from the disk image, so the workflow has no `update_url` input. */
			engine: "electron";
			/** Presigned PUT URL of the staged disk image, valid 2 h. */
			outputUrl: string;
	  });

/** The run that one dispatch started. */
export type DesktopBuildDispatch = {
	/** GitHub workflow run id as decimal text: the `desktop_builds.ci_run_id` value. */
	runId: string;
	/** Run page on github.com, for support. */
	runUrl: string;
};

/**
 * A failed GitHub call. The message holds the operation, the HTTP status,
 * and the GitHub request id. It never holds the token, a URL input, or the
 * answer body.
 */
export class DesktopBuildRunnerError extends Error {
	constructor(
		message: string,
		/** HTTP status of the GitHub answer; null when no answer came. */
		readonly status: number | null,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = "DesktopBuildRunnerError";
	}
}

/** Starts, reads, and cancels one desktop build run of the desktop CI. */
export interface DesktopBuildRunner {
	/** Dispatches the workflow of `input.platform` and answers the new run. Throws `DesktopBuildRunnerError`. */
	dispatch(input: DesktopBuildDispatchInput): Promise<DesktopBuildDispatch>;
	/** Reads the current state of one run. Throws `DesktopBuildRunnerError`. */
	getRun(runId: string): Promise<GithubWorkflowRun>;
	/**
	 * True when the self-test step of the workflow failed in this run. The 4
	 * workflow files use the same step name. The task asks after a failed run only. Throws `DesktopBuildRunnerError`.
	 */
	hasFailedSelfTest(runId: string): Promise<boolean>;
	/** Cancels one run. A run that already ended counts as done. */
	cancel(runId: string): Promise<void>;
}
