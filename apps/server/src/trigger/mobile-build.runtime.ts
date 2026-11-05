/**
 * Mobile-build runtime (WANDIT-194): builds one Android APK of a V2 mobile
 * app on EAS and moves its `mobile_builds` row to a terminal status.
 * `mobile-build.task.ts` calls `runMobileBuild`; the spec runs it on fakes.
 * It calls the builds, backends, and project liveness repositories, the
 * credit hold of build-credit-hold.ts, the git store, the workspace preparer,
 * and the EAS runner.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	type EasBuild,
	type MobileBuildErrorCode,
	supabaseProjectUrl,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import {
	easIdentityFor,
	mobileBuildHoldKey,
} from "../modules/app-builder/domain/mobile-build";
import {
	type EasBuildRunner,
	EasRunnerError,
} from "../modules/app-builder/domain/ports/eas-build-runner";
import type { GitStore } from "../modules/app-builder/domain/ports/git-store";
import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import type {
	MobileBuildWorkspaceInput,
	MobileBuildWorkspaceResult,
} from "../modules/app-builder/infrastructure/eas/mobile-build-workspace";
import type {
	AppBackendRow,
	AppBackendsRepository,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type {
	MobileBuildRow,
	MobileBuildsRepository,
} from "../modules/app-builder/infrastructure/persistence/mobile-builds.repository";
import type { ProjectLivenessRepository } from "../modules/app-builder/infrastructure/persistence/project-liveness.repository";
import { MOBILE_BUILD_CREDITS } from "../modules/metering/domain/operation-registry";

import {
	type BuildCreditHoldInput,
	createBuildCreditHold,
} from "./build-credit-hold";

// Security: the read credential lives only as long as the fetch of one
// commit needs.
const GIT_CREDENTIAL_TTL_SECONDS = 600;

// One EAS status read every 30 s. A Trigger wait above 5 s frees the
// machine, so the wait costs no compute.
const POLL_INTERVAL_MS = 30_000;

// LIMIT: the poll gives up 2 h after EAS start, also when EAS still queues the build. Upgrade: a ceiling per Expo plan.
const POLL_CEILING_MS = 2 * 60 * 60_000;

/** Payload of one `mobile-build` run, plus the Trigger run id. */
export type MobileBuildInput = {
	/** `mobile_builds.id`. The API reserved the hold `mobile_build:<buildId>` for it. */
	buildId: string;
	/** Project of the build. The run skips a row of another project. */
	projectId: string;
	/** `ctx.run.id` of this run. The claim writes it to `mobile_builds.trigger_run_id`. */
	triggerRunId: string;
};

/** Everything `runMobileBuild` calls. The task wires the real ones; the spec passes fakes. */
export type MobileBuildDeps = {
	/** Reads the `mobile_builds` row. Every status change is a compare-and-set. */
	builds: Pick<
		MobileBuildsRepository,
		"findById" | "setEasBuildId" | "transition"
	>;
	/** Reads the `app_backends` row. An active, paused, or restoring backend gives the APK its Supabase env. */
	backends: Pick<AppBackendsRepository, "findByProjectId">;
	/** Tells whether the project still has a row that is not soft-deleted. */
	projects: Pick<ProjectLivenessRepository, "listLiveIds">;
	/** Leases, settles, and refunds the `mobile_build:<buildId>` hold of the API. */
	metering: BuildCreditHoldInput["metering"];
	/** Mints the read-only code.storage credential of the clone. */
	gitStore: Pick<GitStore, "issueCredential">;
	/** The EAS runner and its account. Null when the worker env lacks EXPO_TOKEN or EXPO_ACCOUNT: the run fails `unconfigured`. */
	eas: {
		runner: EasBuildRunner;
		/** `EXPO_ACCOUNT`: the Expo owner that `easIdentityFor` writes into app.json. */
		account: string;
	} | null;
	/** `prepareMobileBuildWorkspace` bound to `hostExec` in production. */
	prepareWorkspace: (
		input: MobileBuildWorkspaceInput,
	) => Promise<MobileBuildWorkspaceResult>;
	/** Folder of the trusted template files: `resolve(TEMPLATE_ARCHIVE_DIR, "mobile-app")`. */
	templateDir: string;
	/** `GENERATION_BILLING_MODE === "off"`: the API made no hold. An existing hold still settles or refunds. */
	billingDisabled: boolean;
	/** `wait.for` in production; the spec adds the ms to a fake clock. */
	sleep: (ms: number) => Promise<void>;
	/** `Date.now` in production; the spec reads a fake clock. */
	now: () => number;
	/** `Sentry.captureException` with the run tags. `failure` is the error code or `settle_failed`. */
	captureException: (
		error: unknown,
		tags: {
			buildId: string;
			projectId: string;
			failure: MobileBuildErrorCode | "settle_failed";
		},
	) => void;
	/** `Sentry.logger` in production; the spec records lines. */
	logger: SandboxLogger;
};

/**
 * Outcome of one run. `canceled`: the API or EAS canceled the build, or the
 * project was deleted. `skipped`: the run did not claim the row.
 */
export type MobileBuildResult = {
	outcome: "finished" | "failed" | "canceled" | "skipped";
	/** The stored error code on `failed`, else null. */
	errorCode: MobileBuildErrorCode | null;
};

const SKIPPED: MobileBuildResult = { outcome: "skipped", errorCode: null };
const CANCELED: MobileBuildResult = { outcome: "canceled", errorCode: null };

/**
 * Runs one build: claim the queued row, lease the credit hold, prepare the
 * workspace, start EAS, poll it, then settle or refund. Never throws for a
 * handled failure; every failure exit goes through `fail`.
 */
export async function runMobileBuild(
	deps: MobileBuildDeps,
	input: MobileBuildInput,
): Promise<MobileBuildResult> {
	const { buildId, projectId } = input;
	const logFields = { buildId, projectId };

	const row = await deps.builds.findById(buildId);
	// The payload crossed a queue: a row of another project is never built.
	if (row === null || row.projectId !== projectId) {
		deps.logger.info("mobile-build.skipped", {
			...logFields,
			reason: row === null ? "no-row" : "project-mismatch",
		});
		return SKIPPED;
	}
	// The claim fails when the API canceled the row or another run claimed it.
	const claimed = await deps.builds.transition(buildId, {
		to: "building",
		triggerRunId: input.triggerRunId,
	});
	if (claimed === null) {
		deps.logger.info("mobile-build.skipped", {
			...logFields,
			reason: "not-queued",
		});
		return SKIPPED;
	}

	// The hold row names its payer (workspaces-sharing.md 4): `user_id` of
	// the build is the actor, so the run passes only the row columns.
	const hold = createBuildCreditHold({
		billingDisabled: deps.billingDisabled,
		build: row,
		holdKey: mobileBuildHoldKey(buildId),
		logFields,
		logPrefix: "mobile-build",
		logger: deps.logger,
		metering: deps.metering,
		operation: "mobile_build",
	});
	// Set once `eas build` answers, so a later failure can cancel EAS.
	let easBuildId: string | null = null;
	// Set once minted, so no stored message can hold it.
	let credentialPassword: string | null = null;

	// Security: a stored failure text never holds the git credential.
	const masked = (text: string): string =>
		credentialPassword === null
			? text
			: text.replaceAll(credentialPassword, "***");

	/**
	 * Settles a still-reserved hold at the fixed price. The row is already
	 * `finished`, so a failed settle is logged and captured, never thrown.
	 */
	const settleHold = async (finishedEasBuildId: string): Promise<void> => {
		try {
			await hold.settle({
				costUsdMicros: null,
				finalCredits: MOBILE_BUILD_CREDITS,
				pricing: "direct",
				pricingSnapshot: {
					creditsPerUnit: MOBILE_BUILD_CREDITS,
					mode: "fixed",
					operation: "mobile_build",
					source: "operation_registry",
					unit: "operation",
					units: 1,
				},
				provider: "eas",
				rawUsage: { easBuildId: finishedEasBuildId },
			});
		} catch (error) {
			deps.captureException(error, { ...logFields, failure: "settle_failed" });
			deps.logger.error("mobile-build.settle-failed", {
				...logFields,
				error: getErrorMessage(error),
			});
		}
	};

	/** False when the project is soft-deleted: nobody can see or cancel its build. */
	const isProjectLive = async (): Promise<boolean> =>
		(await deps.projects.listLiveIds([projectId])).has(projectId);

	/** Cancels the EAS build. Best effort: a failure only logs. */
	const cancelEas = async (
		runner: EasBuildRunner,
		id: string,
	): Promise<void> => {
		try {
			await runner.cancel(id);
		} catch (error) {
			deps.logger.warn("mobile-build.eas-cancel-failed", {
				...logFields,
				easBuildId: id,
				error: getErrorMessage(error),
			});
		}
	};

	/**
	 * Ends the build of a deleted project: cancels EAS, cancels the row, and
	 * refunds the hold. A hard delete removes the row (cascade), and a soft
	 * delete keeps it; in both cases nobody else ends this build.
	 */
	const endForDeletedProject = async (
		startedEasBuildId: string | null,
		/** True when the row is gone, so no compare-and-set can run. */
		rowGone: boolean,
	): Promise<MobileBuildResult> => {
		if (startedEasBuildId !== null && deps.eas !== null) {
			await cancelEas(deps.eas.runner, startedEasBuildId);
		}
		const canceled = rowGone
			? null
			: await deps.builds.transition(buildId, { to: "canceled" });
		// A lost compare-and-set means the API ended the row and refunded.
		if (rowGone || canceled !== null) {
			await hold.refund("mobile_build_canceled");
		}
		deps.logger.info("mobile-build.project-deleted", logFields);
		return CANCELED;
	};

	/**
	 * One exit for every failure. Only a won compare-and-set refunds the
	 * hold, captures to Sentry, and logs. A lost one means the API canceled
	 * the row and refunded the hold first.
	 */
	const fail = async (
		errorCode: MobileBuildErrorCode,
		error: unknown,
	): Promise<MobileBuildResult> => {
		const errorMessage = masked(getErrorMessage(error));
		const failed = await deps.builds.transition(buildId, {
			to: "failed",
			errorCode,
			errorMessage,
		});
		if (failed === null) {
			deps.logger.info("mobile-build.fail-lost", { ...logFields, errorCode });
			return CANCELED;
		}
		await hold.refund("mobile_build_failed");
		// Sentry keeps the original stack, unless the text holds the credential.
		deps.captureException(
			errorMessage === getErrorMessage(error) ? error : new Error(errorMessage),
			{ ...logFields, failure: errorCode },
		);
		deps.logger.error("mobile-build.failed", { ...logFields, errorCode });
		return { outcome: "failed", errorCode };
	};

	try {
		const lease = await hold.lease();
		if (lease === "hold_mismatch") {
			return await fail(
				"internal",
				new Error("credit hold is missing or does not match the build"),
			);
		}
		if (lease === "not_reserved") {
			return await fail("internal", new Error("credit hold is not reserved"));
		}

		// A soft-deleted project gets no build: nobody can see, cancel, or
		// download it any more, so it must not cost credits.
		if (!(await isProjectLive())) {
			return await endForDeletedProject(null, false);
		}

		if (deps.eas === null) {
			return await fail(
				"unconfigured",
				new Error("worker env lacks EXPO_TOKEN or EXPO_ACCOUNT"),
			);
		}
		const { runner } = deps.eas;

		// The clone, the install, and `eas build` use one temp folder. The
		// `finally` removes it before the first wait: a Trigger checkpoint
		// may not keep the disk.
		const rootDir = await mkdtemp(join(tmpdir(), "wandit-mobile-build-"));
		let started: EasBuild;
		try {
			const credential = await deps.gitStore.issueCredential(
				projectId,
				GIT_CREDENTIAL_TTL_SECONDS,
				"read",
			);
			credentialPassword = credential.password;
			const workspace = await deps.prepareWorkspace({
				appEnv: appEnvOf(await deps.backends.findByProjectId(projectId)),
				commitSha: row.commitSha,
				credential,
				identity: easIdentityFor(projectId, deps.eas.account),
				rootDir,
				templateDir: deps.templateDir,
			});
			if (workspace.kind === "failed") {
				return await fail(
					workspace.errorCode,
					new Error(workspace.errorMessage),
				);
			}
			await hold.heartbeat();
			try {
				started = await runner.start({
					buildId,
					projectDir: workspace.projectDir,
				});
			} catch (error) {
				if (error instanceof EasRunnerError) {
					return await fail(
						error.step === "init" ? "eas_init_failed" : "eas_start_failed",
						error,
					);
				}
				throw error;
			}
		} finally {
			try {
				await rm(rootDir, { force: true, recursive: true });
			} catch (error) {
				// The folder holds no credential; the worker disk is discarded
				// with the machine.
				deps.logger.warn("mobile-build.cleanup-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
			}
		}
		easBuildId = started.id;

		// False: the API canceled the row while `eas build` ran. EAS then
		// builds for nobody, so the run cancels it.
		if (!(await deps.builds.setEasBuildId(buildId, started.id))) {
			await cancelEas(runner, started.id);
			deps.logger.info("mobile-build.canceled-before-poll", {
				...logFields,
				easBuildId: started.id,
			});
			return CANCELED;
		}
		await hold.heartbeat();

		const easStartedAt = deps.now();
		let build = started;
		// The loop ends on a terminal EAS status, on a row that left
		// `building`, on a deleted project, on a lost credit hold, or on the
		// poll ceiling. Never through its header.
		while (true) {
			if (build.status === "FINISHED") {
				const artifactUrl = build.artifacts?.buildUrl;
				if (!artifactUrl) {
					return await fail(
						"artifact_missing",
						new Error(`EAS build ${build.id} finished without an APK URL`),
					);
				}
				const finished = await deps.builds.transition(buildId, {
					to: "finished",
					artifactUrl,
				});
				if (finished === null) {
					// The API cancel won the race and refunded the hold.
					deps.logger.info("mobile-build.finish-lost", logFields);
					return CANCELED;
				}
				await settleHold(build.id);
				deps.logger.info("mobile-build.finished", {
					...logFields,
					easBuildId: build.id,
				});
				return { outcome: "finished", errorCode: null };
			}
			if (build.status === "ERRORED") {
				return await fail(
					"eas_errored",
					new Error(build.error?.message ?? `EAS build ${build.id} errored`),
				);
			}
			if (build.status === "CANCELED") {
				// Someone canceled the build on EAS itself, not through the API.
				const canceled = await deps.builds.transition(buildId, {
					to: "canceled",
				});
				if (canceled !== null) {
					await hold.refund("mobile_build_canceled");
				}
				return CANCELED;
			}
			if (deps.now() - easStartedAt >= POLL_CEILING_MS) {
				await cancelEas(runner, build.id);
				return await fail(
					"timeout",
					new Error(
						`EAS build ${build.id} did not end before the poll ceiling`,
					),
				);
			}
			await deps.sleep(POLL_INTERVAL_MS);

			let current: MobileBuildRow | null;
			let projectLive: boolean;
			try {
				current = await deps.builds.findById(buildId);
				projectLive = current !== null && (await isProjectLive());
			} catch (error) {
				// A failed DB read does not end a healthy EAS build: the next
				// poll reads again, and the ceiling still applies.
				deps.logger.warn("mobile-build.row-read-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
				continue;
			}
			if (current === null || !projectLive) {
				return await endForDeletedProject(build.id, current === null);
			}
			if (current.status !== "building") {
				// The API canceled the row and refunded the hold. Its EAS cancel
				// is best effort, so the run asks EAS again.
				await cancelEas(runner, build.id);
				deps.logger.info("mobile-build.row-left-building", {
					...logFields,
					status: current.status,
				});
				return CANCELED;
			}
			await hold.heartbeat();
			try {
				build = await runner.view(build.id);
			} catch (error) {
				// One failed read does not end the build: the next poll reads
				// again, and the ceiling still applies.
				deps.logger.warn("mobile-build.view-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
			}
		}
	} catch (error) {
		// EAS would build for nobody after this failure.
		if (easBuildId !== null && deps.eas !== null) {
			await cancelEas(deps.eas.runner, easBuildId);
		}
		return await fail("internal", error);
	} finally {
		await hold.release();
	}
}

// D18: a backend that serves the app gives the APK its public URL and anon
// key. The pause sweep pauses an idle backend, but a pause keeps both values.
// The builder wakes the project on its next turn. A `creating`, `deleting`,
// or `error` row gives the APK no backend env.
const APP_ENV_BACKEND_STATUSES: AppBackendRow["status"][] = [
	"active",
	"paused",
	"restoring",
];

// Both values are public: the APK bundle holds them in clear text.
function appEnvOf(backend: AppBackendRow | null): Record<string, string> {
	if (
		backend === null ||
		!APP_ENV_BACKEND_STATUSES.includes(backend.status) ||
		backend.ref === null ||
		backend.anonKey === null
	) {
		return {};
	}
	return {
		EXPO_PUBLIC_SUPABASE_ANON_KEY: backend.anonKey,
		EXPO_PUBLIC_SUPABASE_URL: supabaseProjectUrl(backend.ref),
	};
}
