import {
	chmodSync,
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { EasBuild, EasBuildStatus } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { statusesThatMayMoveTo } from "../modules/app-builder/domain/mobile-build";
import {
	type EasBuildRunner,
	type EasBuildStartInput,
	EasRunnerError,
} from "../modules/app-builder/domain/ports/eas-build-runner";
import type { GitCredentialAccess } from "../modules/app-builder/domain/ports/git-store";
import type {
	MobileBuildWorkspaceInput,
	MobileBuildWorkspaceResult,
} from "../modules/app-builder/infrastructure/eas/mobile-build-workspace";
import type { AppBackendRow } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type {
	MobileBuildRow,
	MobileBuildTransition,
} from "../modules/app-builder/infrastructure/persistence/mobile-builds.repository";
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import type {
	ExecutionLeaseHeartbeat,
	MeteringService,
} from "../modules/metering/application/services/metering.service";
import type { AiUsageEvent } from "../modules/metering/domain/metering";
import { MOBILE_BUILD_CREDITS } from "../modules/metering/domain/operation-registry";
import { type MobileBuildDeps, runMobileBuild } from "./mobile-build.runtime";

const BUILD_ID = "0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10";
const PROJECT_ID = "7b1e2d3c-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const COMMIT_SHA = "a".repeat(40);
const EAS_BUILD_ID = "eas-build-1";
const APK_URL = "https://expo.dev/artifacts/eas/abc.apk";
const HOLD_ID = "11111111-1111-4111-8111-111111111111";
const GIT_PASSWORD = "jwt-read-secret";
const TEMPLATE_DIR = "/templates/mobile-app";
const RUN_ID = "run_123";
const POLL_INTERVAL_MS = 30_000;
const POLL_CEILING_MS = 2 * 60 * 60_000;

const INPUT = {
	actorIsLimitExempt: true,
	buildId: BUILD_ID,
	projectId: PROJECT_ID,
	triggerRunId: RUN_ID,
};

function buildRow(overrides: Partial<MobileBuildRow> = {}): MobileBuildRow {
	return {
		artifactUrl: null,
		commitSha: COMMIT_SHA,
		completedAt: null,
		createdAt: new Date("2026-09-26T00:00:00.000Z"),
		easBuildId: null,
		errorCode: null,
		errorMessage: null,
		id: BUILD_ID,
		kind: "apk",
		organizationId: "org-1",
		platform: "android",
		projectId: PROJECT_ID,
		requestKey: "c0ffee00-0000-4000-8000-000000000001",
		status: "queued",
		triggerRunId: null,
		updatedAt: new Date("2026-09-26T00:00:00.000Z"),
		userId: "user-1",
		...overrides,
	};
}

function holdEvent(status: AiUsageEvent["status"]): AiUsageEvent {
	return {
		attemptRef: BUILD_ID,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date("2026-09-26T00:00:00.000Z"),
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: null,
		id: HOLD_ID,
		idempotencyKey: `mobile_build:${BUILD_ID}`,
		inputTokens: null,
		messageId: null,
		model: null,
		nextReconcileAttemptAt: null,
		operation: "mobile_build",
		organizationId: "org-1",
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: null,
		projectId: PROJECT_ID,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: MOBILE_BUILD_CREDITS,
		settledAt: null,
		status,
		userId: "user-1",
	};
}

function backendRow(status: AppBackendRow["status"] = "active"): AppBackendRow {
	return {
		anonKey: "anon-key-1",
		dbHost: "db.abcdefghijklmnopqrst.supabase.co",
		failureCode: null,
		id: "backend-1",
		orgId: "supabase-org",
		organizationId: "org-1",
		projectId: PROJECT_ID,
		ref: "abcdefghijklmnopqrst",
		region: "eu-west-3",
		requestKey: "req-1",
		status,
		triggerRunId: null,
		userId: "user-1",
	};
}

function easBuild(
	status: EasBuildStatus,
	overrides: Partial<EasBuild> = {},
): EasBuild {
	return { id: EAS_BUILD_ID, status, ...overrides };
}

// In-memory `mobile_builds` repository. `transition` applies the same
// status rule as the real compare-and-set.
function createBuildsFake(initial: MobileBuildRow | null) {
	const state = { row: initial, failReads: false };
	const transitions: MobileBuildTransition[] = [];
	const easIds: string[] = [];
	return {
		state,
		transitions,
		easIds,
		async findById(id: string): Promise<MobileBuildRow | null> {
			if (state.failReads) {
				throw new Error("database is down");
			}
			return state.row?.id === id ? state.row : null;
		},
		async transition(
			id: string,
			change: MobileBuildTransition,
		): Promise<MobileBuildRow | null> {
			transitions.push(change);
			if (
				state.row === null ||
				state.row.id !== id ||
				!statusesThatMayMoveTo(change.to).includes(state.row.status)
			) {
				return null;
			}
			state.row = { ...state.row, status: change.to };
			return state.row;
		},
		async setEasBuildId(id: string, easBuildId: string): Promise<boolean> {
			easIds.push(easBuildId);
			if (
				state.row?.id !== id ||
				state.row.status !== "building" ||
				state.row.easBuildId !== null
			) {
				return false;
			}
			state.row = { ...state.row, easBuildId };
			return true;
		},
	};
}

// Records every metering call in order. The hold moves to `settled` or
// `refunded` like the real service.
class FakeMetering {
	hold: AiUsageEvent | null = holdEvent("reserved");
	heartbeatAnswer: ExecutionLeaseHeartbeat = "renewed";
	acquireSucceeds = true;
	settleError: Error | null = null;
	refundError: Error | null = null;
	readonly calls: string[] = [];
	readonly subjects: MeteringSubject[] = [];
	readonly keys: string[] = [];
	readonly settleCalls: Parameters<MeteringService["settle"]>[] = [];
	readonly refundCalls: { eventId: string; reason: string }[] = [];

	/** Every call except the hold lookup: the lease and money writes. */
	get writeCalls(): string[] {
		return this.calls.filter((name) => name !== "findByIdempotencyKey");
	}

	async findByIdempotencyKey(
		key: string,
		subject: MeteringSubject,
	): Promise<AiUsageEvent | null> {
		this.calls.push("findByIdempotencyKey");
		this.keys.push(key);
		this.subjects.push(subject);
		return this.hold;
	}

	async acquireExecutionLease(
		_eventId: string,
		_token: string,
		_ttlMs: number,
	): Promise<AiUsageEvent | null> {
		this.calls.push("acquireExecutionLease");
		return this.acquireSucceeds ? this.hold : null;
	}

	async heartbeatExecutionLease(
		_eventId: string,
		_token: string,
		_ttlMs: number,
	): Promise<ExecutionLeaseHeartbeat> {
		this.calls.push("heartbeatExecutionLease");
		return this.heartbeatAnswer;
	}

	async releaseExecutionLease(_eventId: string, _token: string): Promise<void> {
		this.calls.push("releaseExecutionLease");
	}

	async settle(
		...args: Parameters<MeteringService["settle"]>
	): Promise<AiUsageEvent> {
		this.calls.push("settle");
		this.settleCalls.push(args);
		if (this.settleError !== null) {
			throw this.settleError;
		}
		this.hold = holdEvent("settled");
		return this.hold;
	}

	async refund(
		eventId: string,
		reason = "ai_usage_refund",
	): Promise<AiUsageEvent> {
		this.calls.push("refund");
		this.refundCalls.push({ eventId, reason });
		if (this.refundError !== null) {
			throw this.refundError;
		}
		this.hold = holdEvent("refunded");
		return this.hold;
	}
}

// Scripted EAS runner: each `view` shifts one answer; the last one repeats.
function createRunnerFake(
	start: EasBuild | Error,
	views: (EasBuild | Error)[],
) {
	const startInputs: EasBuildStartInput[] = [];
	const cancels: string[] = [];
	const runner: EasBuildRunner = {
		async start(input) {
			startInputs.push(input);
			if (start instanceof Error) {
				throw start;
			}
			return start;
		},
		async view() {
			const answer = views.length > 1 ? views.shift() : views[0];
			if (answer === undefined) {
				throw new Error("no fake view answer");
			}
			if (answer instanceof Error) {
				throw answer;
			}
			return answer;
		},
		async cancel(easBuildId) {
			cancels.push(easBuildId);
		},
	};
	return { runner, startInputs, cancels };
}

// The API cancel: the row leaves `building` while the run still works.
function cancelRow(builds: ReturnType<typeof createBuildsFake>): void {
	if (builds.state.row !== null) {
		builds.state.row = { ...builds.state.row, status: "canceled" };
	}
}

// The log messages of one run, in order.
function messagesOf(ctx: ReturnType<typeof setup>): string[] {
	return ctx.logs.map((line) => line.message);
}

type SetupOptions = {
	row?: MobileBuildRow | null;
	backend?: AppBackendRow | null;
	workspace?: MobileBuildWorkspaceResult | Error;
	start?: EasBuild | Error;
	views?: (EasBuild | Error)[];
	unconfigured?: boolean;
	billingDisabled?: boolean;
};

function setup(options: SetupOptions = {}) {
	let fakeNow = 0;
	const sleeps: number[] = [];
	const logs: {
		level: "error" | "info" | "warn";
		message: string;
		fields: Record<string, string>;
	}[] = [];
	const captures: {
		error: unknown;
		tags: Parameters<MobileBuildDeps["captureException"]>[1];
	}[] = [];
	const workspaceInputs: MobileBuildWorkspaceInput[] = [];
	const credentialCalls: {
		projectId: string;
		ttlSeconds: number;
		access: GitCredentialAccess | undefined;
	}[] = [];
	// `rootDir` existence when prepare ran and at the first sleep.
	const disk: {
		existedDuringPrepare: boolean;
		existedAtFirstSleep: boolean | null;
	} = { existedDuringPrepare: false, existedAtFirstSleep: null };
	const hooks: { onSleep: () => void } = { onSleep: () => undefined };
	// False: the project row is soft-deleted.
	const project = { live: true };
	const builds = createBuildsFake(
		options.row === undefined ? buildRow() : options.row,
	);
	const metering = new FakeMetering();
	const eas = createRunnerFake(
		options.start ?? easBuild("IN_QUEUE"),
		options.views ?? [
			easBuild("FINISHED", { artifacts: { buildUrl: APK_URL } }),
		],
	);
	const deps = {
		backends: { findByProjectId: async () => options.backend ?? null },
		billingDisabled: options.billingDisabled ?? false,
		builds,
		captureException: (error, tags) => {
			captures.push({ error, tags });
		},
		eas: options.unconfigured
			? null
			: { account: "wandit", runner: eas.runner },
		gitStore: {
			issueCredential: async (projectId, ttlSeconds, access) => {
				credentialCalls.push({ projectId, ttlSeconds, access });
				return {
					expiresAt: new Date(ttlSeconds * 1000),
					password: GIT_PASSWORD,
					remoteUrl: "https://git.code.storage/wandit/project.git",
					username: "t",
				};
			},
		},
		logger: {
			error: (message, fields) =>
				logs.push({ level: "error", message, fields }),
			info: (message, fields) => logs.push({ level: "info", message, fields }),
			warn: (message, fields) => logs.push({ level: "warn", message, fields }),
		},
		metering,
		now: () => fakeNow,
		projects: {
			listLiveIds: async (projectIds) =>
				new Set(project.live ? projectIds : []),
		},
		prepareWorkspace: async (input) => {
			workspaceInputs.push(input);
			disk.existedDuringPrepare = existsSync(input.rootDir);
			if (options.workspace instanceof Error) {
				throw options.workspace;
			}
			return (
				options.workspace ?? {
					kind: "ready",
					projectDir: join(input.rootDir, "app"),
				}
			);
		},
		sleep: async (ms) => {
			const rootDir = workspaceInputs[0]?.rootDir;
			if (disk.existedAtFirstSleep === null && rootDir !== undefined) {
				disk.existedAtFirstSleep = existsSync(rootDir);
			}
			sleeps.push(ms);
			fakeNow += ms;
			hooks.onSleep();
		},
		templateDir: TEMPLATE_DIR,
	} satisfies MobileBuildDeps;
	return {
		builds,
		captures,
		credentialCalls,
		deps,
		disk,
		eas,
		hooks,
		logs,
		metering,
		project,
		sleeps,
		workspaceInputs,
	};
}

describe("runMobileBuild", () => {
	it("clones, starts EAS, polls to FINISHED, stores the APK URL, and settles once", async () => {
		const ctx = setup({
			backend: backendRow(),
			views: [
				easBuild("IN_PROGRESS"),
				easBuild("FINISHED", { artifacts: { buildUrl: APK_URL } }),
			],
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "finished", errorCode: null });
		expect(ctx.builds.transitions).toEqual([
			{ to: "building", triggerRunId: RUN_ID },
			{ to: "finished", artifactUrl: APK_URL },
		]);
		expect(ctx.builds.easIds).toEqual([EAS_BUILD_ID]);
		expect(ctx.credentialCalls).toEqual([
			{ access: "read", projectId: PROJECT_ID, ttlSeconds: 600 },
		]);
		expect(ctx.workspaceInputs[0]).toMatchObject({
			appEnv: {
				EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-1",
				EXPO_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
			},
			commitSha: COMMIT_SHA,
			identity: {
				account: "wandit",
				androidPackage: `app.wandit.p${PROJECT_ID.replaceAll("-", "")}`,
				slug: `p${PROJECT_ID.replaceAll("-", "")}`,
			},
			templateDir: TEMPLATE_DIR,
		});
		expect(ctx.eas.startInputs).toEqual([
			{
				buildId: BUILD_ID,
				projectDir: join(ctx.workspaceInputs[0]?.rootDir ?? "", "app"),
			},
		]);
		expect(ctx.metering.keys[0]).toBe(`mobile_build:${BUILD_ID}`);
		expect(ctx.metering.subjects[0]).toEqual({
			actorIsLimitExempt: true,
			actorUserId: "user-1",
			organizationId: "org-1",
		});
		expect(ctx.metering.settleCalls).toEqual([
			[
				HOLD_ID,
				{
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
					rawUsage: { easBuildId: EAS_BUILD_ID },
				},
			],
		]);
		expect(ctx.metering.refundCalls).toEqual([]);
		expect(ctx.metering.calls.at(-1)).toBe("releaseExecutionLease");
		expect(ctx.sleeps).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
	});

	it("removes the temp folder before the first wait", async () => {
		const ctx = setup();

		await runMobileBuild(ctx.deps, INPUT);

		expect(ctx.disk.existedDuringPrepare).toBe(true);
		expect(ctx.disk.existedAtFirstSleep).toBe(false);
	});

	it("builds a personal row with the user as the payer and no backend env", async () => {
		const ctx = setup({ row: buildRow({ organizationId: null }) });

		await runMobileBuild(ctx.deps, INPUT);

		expect(ctx.metering.subjects[0]).toEqual({ actorUserId: "user-1" });
		expect(ctx.workspaceInputs[0]?.appEnv).toEqual({});
	});

	it.each([
		"paused",
		"restoring",
	] as const)("gives the APK the Supabase env of a %s backend", async (status) => {
		const ctx = setup({ backend: backendRow(status) });

		await runMobileBuild(ctx.deps, INPUT);

		expect(ctx.workspaceInputs[0]?.appEnv).toEqual({
			EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-1",
			EXPO_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
		});
	});

	it("gives the APK no Supabase env while the backend is still creating", async () => {
		const ctx = setup({ backend: backendRow("creating") });

		await runMobileBuild(ctx.deps, INPUT);

		expect(ctx.workspaceInputs[0]?.appEnv).toEqual({});
	});

	it("skips a replayed run whose row is no longer queued", async () => {
		const ctx = setup({ row: buildRow({ status: "building" }) });

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", errorCode: null });
		expect(ctx.metering.calls).toEqual([]);
		expect(ctx.workspaceInputs).toEqual([]);
	});

	it("skips a row of another project without a claim", async () => {
		const ctx = setup({
			row: buildRow({ projectId: "99999999-9999-4999-8999-999999999999" }),
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("skipped");
		expect(ctx.builds.transitions).toEqual([]);
	});

	it("fails eas_errored with the EAS message, refunds, and captures", async () => {
		const ctx = setup({
			views: [
				easBuild("ERRORED", {
					error: { errorCode: "GRADLE", message: "Gradle build failed" },
				}),
			],
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "eas_errored" });
		expect(ctx.builds.transitions.at(-1)).toEqual({
			to: "failed",
			errorCode: "eas_errored",
			errorMessage: "Gradle build failed",
		});
		expect(ctx.metering.refundCalls).toEqual([
			{ eventId: HOLD_ID, reason: "mobile_build_failed" },
		]);
		expect(ctx.metering.settleCalls).toEqual([]);
		expect(ctx.captures.map((capture) => capture.tags)).toEqual([
			{ buildId: BUILD_ID, failure: "eas_errored", projectId: PROJECT_ID },
		]);
	});

	it("fails artifact_missing when EAS finishes without an APK URL", async () => {
		const ctx = setup({ views: [easBuild("FINISHED")] });

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({
			outcome: "failed",
			errorCode: "artifact_missing",
		});
		expect(ctx.metering.refundCalls).toHaveLength(1);
		expect(ctx.metering.settleCalls).toEqual([]);
	});

	it("fails with the workspace code, refunds, and never starts EAS", async () => {
		const ctx = setup({
			workspace: {
				kind: "failed",
				errorCode: "plugin_not_allowed",
				errorMessage: 'app.json names the config plugin "./evil"',
			},
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({
			outcome: "failed",
			errorCode: "plugin_not_allowed",
		});
		expect(ctx.metering.refundCalls).toHaveLength(1);
		expect(ctx.eas.startInputs).toEqual([]);
		expect(ctx.disk.existedAtFirstSleep).toBeNull();
		expect(existsSync(ctx.workspaceInputs[0]?.rootDir ?? "")).toBe(false);
	});

	it.each([
		["init", "eas_init_failed"],
		["build", "eas_start_failed"],
	] as const)("maps an EasRunnerError of step %s to %s", async (step, errorCode) => {
		const ctx = setup({
			start: new EasRunnerError(step, `eas ${step} exited with 1`),
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode });
		expect(ctx.builds.transitions.at(-1)).toEqual({
			to: "failed",
			errorCode,
			errorMessage: `eas ${step} exited with 1`,
		});
		expect(ctx.metering.refundCalls).toHaveLength(1);
	});

	it("fails unconfigured without EAS settings and refunds", async () => {
		const ctx = setup({ unconfigured: true });

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "unconfigured" });
		expect(ctx.metering.refundCalls).toHaveLength(1);
		expect(ctx.workspaceInputs).toEqual([]);
	});

	it("ends without money calls and cancels EAS again when the API cancels the row during the poll", async () => {
		const ctx = setup({ views: [easBuild("IN_PROGRESS")] });
		ctx.hooks.onSleep = () => {
			cancelRow(ctx.builds);
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.metering.settleCalls).toEqual([]);
		expect(ctx.metering.refundCalls).toEqual([]);
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
	});

	it("cancels the row and refunds without an EAS build when the project is deleted before the build", async () => {
		const ctx = setup();
		ctx.project.live = false;

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.eas.startInputs).toEqual([]);
		expect(ctx.builds.state.row?.status).toBe("canceled");
		expect(ctx.metering.refundCalls).toHaveLength(1);
	});

	it("cancels EAS and the row and refunds when the project is deleted during the poll", async () => {
		const ctx = setup({ views: [easBuild("IN_PROGRESS")] });
		ctx.hooks.onSleep = () => {
			ctx.project.live = false;
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.builds.state.row?.status).toBe("canceled");
		expect(ctx.metering.refundCalls).toHaveLength(1);
		expect(ctx.metering.settleCalls).toEqual([]);
	});

	it("cancels EAS but does not refund when the API cancel came before the project delete", async () => {
		const ctx = setup({ views: [easBuild("IN_PROGRESS")] });
		ctx.hooks.onSleep = () => {
			cancelRow(ctx.builds);
			ctx.project.live = false;
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.metering.refundCalls).toEqual([]);
	});

	it("still stops at the poll ceiling when every row read fails", async () => {
		const ctx = setup({ views: [easBuild("IN_PROGRESS")] });
		ctx.hooks.onSleep = () => {
			ctx.builds.state.failReads = true;
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "timeout" });
		expect(ctx.sleeps).toHaveLength(POLL_CEILING_MS / POLL_INTERVAL_MS);
	});

	it("keeps polling after a failed row read", async () => {
		const ctx = setup();
		let sleepCount = 0;
		ctx.hooks.onSleep = () => {
			sleepCount += 1;
			// Only the first poll read fails.
			ctx.builds.state.failReads = sleepCount === 1;
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "finished", errorCode: null });
		expect(ctx.eas.cancels).toEqual([]);
		expect(messagesOf(ctx)).toContain("mobile-build.row-read-failed");
	});

	it("cancels the EAS build when the API canceled the row before setEasBuildId", async () => {
		const ctx = setup();
		ctx.eas.runner.start = async () => {
			cancelRow(ctx.builds);
			return easBuild("IN_QUEUE");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.metering.refundCalls).toEqual([]);
		expect(ctx.sleeps).toEqual([]);
	});

	it("cancels EAS and fails timeout at the poll ceiling, with a refund", async () => {
		const ctx = setup({ views: [easBuild("IN_QUEUE")] });

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "timeout" });
		expect(ctx.sleeps).toHaveLength(POLL_CEILING_MS / POLL_INTERVAL_MS);
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.metering.refundCalls).toHaveLength(1);
	});

	it("marks the row canceled and refunds when EAS reports CANCELED", async () => {
		const ctx = setup({ views: [easBuild("CANCELED")] });

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.builds.transitions.at(-1)).toEqual({ to: "canceled" });
		expect(ctx.metering.refundCalls).toEqual([
			{ eventId: HOLD_ID, reason: "mobile_build_canceled" },
		]);
	});

	it("cancels EAS and refunds when the row disappears during the poll", async () => {
		const ctx = setup({ views: [easBuild("IN_PROGRESS")] });
		ctx.hooks.onSleep = () => {
			ctx.builds.state.row = null;
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("canceled");
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.metering.refundCalls).toHaveLength(1);
	});

	it("keeps polling after a failed EAS read", async () => {
		const ctx = setup({
			views: [
				new Error("EAS GraphQL answered 502"),
				easBuild("FINISHED", { artifacts: { buildUrl: APK_URL } }),
			],
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("finished");
		expect(messagesOf(ctx)).toContain("mobile-build.view-failed");
	});

	it("fails internal without a refund when the hold is not reserved", async () => {
		const ctx = setup();
		ctx.metering.hold = holdEvent("refunded");

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "internal" });
		expect(ctx.builds.transitions.at(-1)).toMatchObject({
			errorMessage: "credit hold is not reserved",
		});
		expect(ctx.metering.writeCalls).toEqual([]);
		expect(ctx.workspaceInputs).toEqual([]);
	});

	it("fails internal when the lease cannot be acquired", async () => {
		const ctx = setup();
		ctx.metering.acquireSucceeds = false;

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "internal" });
		expect(ctx.metering.refundCalls).toEqual([]);
		expect(ctx.workspaceInputs).toEqual([]);
	});

	it("makes no lease or money call with billing off and no hold", async () => {
		const ctx = setup({ billingDisabled: true });
		ctx.metering.hold = null;

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("finished");
		expect(ctx.metering.calls).toEqual(["findByIdempotencyKey"]);
		expect(messagesOf(ctx)).toContain("billing.off");
	});

	it("re-acquires the lease when a heartbeat answers lost", async () => {
		const ctx = setup();
		ctx.metering.heartbeatAnswer = "lost";

		await runMobileBuild(ctx.deps, INPUT);

		expect(
			ctx.metering.calls.filter((name) => name === "acquireExecutionLease"),
		).toHaveLength(1 + 3);
	});

	it("keeps the build finished and captures when the settle throws", async () => {
		const ctx = setup();
		ctx.metering.settleError = new Error("ledger is locked");

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("finished");
		expect(ctx.captures.map((capture) => capture.tags.failure)).toEqual([
			"settle_failed",
		]);
		expect(ctx.metering.refundCalls).toEqual([]);
	});

	it("masks the git credential in a stored internal error", async () => {
		const ctx = setup({
			workspace: new Error(`fetch https://t:${GIT_PASSWORD}@git failed`),
		});

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "internal" });
		expect(ctx.builds.transitions.at(-1)).toEqual({
			to: "failed",
			errorCode: "internal",
			errorMessage: "fetch https://t:***@git failed",
		});
		expect(String(ctx.captures[0]?.error)).not.toContain(GIT_PASSWORD);
		expect(existsSync(ctx.workspaceInputs[0]?.rootDir ?? "")).toBe(false);
	});

	it("cancels EAS when an error is thrown after the start", async () => {
		const ctx = setup({ views: [easBuild("IN_PROGRESS")] });
		ctx.builds.setEasBuildId = async () => {
			throw new Error("database is down");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "internal" });
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.metering.refundCalls).toHaveLength(1);
	});

	it("does not refund when the API cancel wins over the failure", async () => {
		const ctx = setup();
		ctx.eas.runner.view = async () => {
			cancelRow(ctx.builds);
			return easBuild("ERRORED");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.metering.refundCalls).toEqual([]);
		expect(ctx.captures).toEqual([]);
	});

	it("does not settle when the API cancel wins over the finish", async () => {
		const ctx = setup();
		ctx.eas.runner.view = async () => {
			cancelRow(ctx.builds);
			return easBuild("FINISHED", { artifacts: { buildUrl: APK_URL } });
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "canceled", errorCode: null });
		expect(ctx.metering.settleCalls).toEqual([]);
	});

	it("warns and builds when billing is on but the API made no hold", async () => {
		const ctx = setup();
		ctx.metering.hold = null;

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("finished");
		expect(ctx.metering.calls).toEqual(["findByIdempotencyKey"]);
		expect(messagesOf(ctx)).toContain("mobile-build.hold-missing");
	});

	it("skips the settle when the hold left reserved during the build", async () => {
		const ctx = setup();
		ctx.eas.runner.start = async () => {
			ctx.metering.hold = holdEvent("refunded");
			return easBuild("IN_QUEUE");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result.outcome).toBe("finished");
		expect(ctx.metering.settleCalls).toEqual([]);
		expect(messagesOf(ctx)).toContain("mobile-build.hold-not-reserved");
	});

	it("cancels EAS and fails internal when a lost lease cannot be acquired again", async () => {
		const ctx = setup();
		ctx.metering.heartbeatAnswer = "lost";
		ctx.eas.runner.start = async () => {
			ctx.metering.acquireSucceeds = false;
			return easBuild("IN_QUEUE");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "internal" });
		expect(ctx.eas.cancels).toEqual([EAS_BUILD_ID]);
		expect(ctx.metering.settleCalls).toEqual([]);
	});

	it("keeps building when the lease re-acquire throws", async () => {
		const ctx = setup();
		ctx.metering.heartbeatAnswer = "lost";
		ctx.eas.runner.start = async () => {
			ctx.metering.acquireExecutionLease = async () => {
				throw new Error("database is down");
			};
			return easBuild("IN_QUEUE");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "finished", errorCode: null });
		expect(messagesOf(ctx)).toContain("mobile-build.lease-renew-failed");
	});

	it("logs a failed refund and still answers the failure", async () => {
		const ctx = setup({ views: [easBuild("ERRORED")] });
		ctx.metering.refundError = new Error("ledger is locked");

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "eas_errored" });
		expect(messagesOf(ctx)).toContain("mobile-build.refund-failed");
	});

	it("logs a failed EAS cancel and still fails timeout", async () => {
		const ctx = setup({ views: [easBuild("IN_QUEUE")] });
		ctx.eas.runner.cancel = async () => {
			throw new Error("EAS GraphQL answered 500");
		};

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "timeout" });
		expect(messagesOf(ctx)).toContain("mobile-build.eas-cancel-failed");
	});

	it("fails internal when the start throws an error that is not an EasRunnerError", async () => {
		const ctx = setup({ start: new Error("spawn failed") });

		const result = await runMobileBuild(ctx.deps, INPUT);

		expect(result).toEqual({ outcome: "failed", errorCode: "internal" });
		expect(ctx.eas.cancels).toEqual([]);
	});

	// A root user can remove a folder without write permission.
	it.skipIf(process.getuid?.() === 0)(
		"logs and goes on when the temp folder cannot be removed",
		async () => {
			const ctx = setup();
			let lockedDir = "";
			ctx.deps.prepareWorkspace = async (input) => {
				lockedDir = join(input.rootDir, "locked");
				mkdirSync(lockedDir);
				writeFileSync(join(lockedDir, "file"), "x");
				// Without write permission on the folder, `rm` cannot unlink the file.
				chmodSync(lockedDir, 0o500);
				return { kind: "ready", projectDir: join(input.rootDir, "app") };
			};
			try {
				const result = await runMobileBuild(ctx.deps, INPUT);

				expect(result.outcome).toBe("finished");
				expect(messagesOf(ctx)).toContain("mobile-build.cleanup-failed");
			} finally {
				chmodSync(lockedDir, 0o700);
				rmSync(dirname(lockedDir), { force: true, recursive: true });
			}
		},
	);
});
