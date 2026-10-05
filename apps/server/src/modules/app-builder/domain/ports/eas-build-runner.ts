/**
 * Port: the EAS Build service of Expo (WANDIT-194).
 * The `mobile-build` task starts and polls builds; the mobile builds
 * service cancels them. The implementation in `infrastructure/eas/` runs
 * the eas CLI for `start` and calls the EAS GraphQL API for `view` and
 * `cancel`. Specs pass a fake.
 */
import type { EasBuild } from "@wandit/contracts";

/** Nest token for the `EasBuildRunner` implementation. */
export const EAS_BUILD_RUNNER = Symbol.for("app-builder.eas-build-runner");

/** Input of `EasBuildRunner.start`. */
export type EasBuildStartInput = {
	/**
	 * Local folder with the prepared project: the sanitized app.json, the
	 * template eas.json, and the trusted `node_modules`.
	 */
	projectDir: string;
	/** `mobile_builds.id`. The runner sends it as the EAS build message. */
	buildId: string;
};

/** The eas CLI step of `start` that failed. */
export type EasRunnerStep = "init" | "build";

/**
 * A failed eas CLI step. The task maps `step` to the build error code. The
 * message holds the end of stderr, never `EXPO_TOKEN`.
 */
export class EasRunnerError extends Error {
	constructor(
		readonly step: EasRunnerStep,
		message: string,
	) {
		super(message);
		this.name = "EasRunnerError";
	}
}

/** Starts, reads, and cancels one EAS build. */
export interface EasBuildRunner {
	/**
	 * Runs `eas init` to create or link the EAS project of the slug, then
	 * `eas build -p android --profile apk --no-wait`. Answers the queued
	 * build. Throws `EasRunnerError` with the step that failed.
	 */
	start(input: EasBuildStartInput): Promise<EasBuild>;
	/** Reads the current state of one build. */
	view(easBuildId: string): Promise<EasBuild>;
	/** Cancels one build. A build that already ended counts as done. */
	cancel(easBuildId: string): Promise<void>;
}
